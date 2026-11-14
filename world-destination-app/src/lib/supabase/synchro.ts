/**
 * Version en ligne : chargement de la `Base`, envoi des modifications, temps réel, connexion.
 * Ce module n'est chargé (import dynamique) que si les variables VITE_SUPABASE_* sont définies.
 */
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import type { Base } from '../types';
import { supabase } from './client';
import { BUCKET } from './config';
import {
  ajouterResumes, baseVide, differences, ORDRE_TABLES, versBase,
  type Ligne, type Lignes, type NomTable, type Operation, type ResumePaiement,
} from './correspondance';

/** Double authentification (MFA) d'un administrateur : étape à afficher sur l'écran de connexion. */
export type EtatMfa =
  | { etape: 'aucune' }
  | { etape: 'verification' }                       // code à 6 chiffres demandé
  | { etape: 'enrolement'; obligatoire: boolean };  // première activation (QR code)

/** Ce que store.ts confie à l'adaptateur (évite un import circulaire). */
export interface Pont {
  getBase: () => Base;
  /** Remplace la Base affichée (données venant du serveur). */
  setBase: (b: Base) => void;
  /** Identifiant du compte connecté (ou null). */
  setSession: (id: string | null) => void;
  /** Le serveur a attribué le numéro définitif d'un reçu ou d'un dossier. */
  numeroDefinitif: (id: string, numero: string) => void;
  /** Une écriture a été refusée par le serveur : message à afficher. */
  erreur: (message: string) => void;
  /** Étape de double authentification à afficher (administrateurs). */
  setMfa: (e: EtatMfa) => void;
}

let pont: Pont;
let canal: RealtimeChannel | null = null;
let sessionCourante: Session | null = null;

/* ------------------------------------------------------------------ chargement */

const TABLES_LECTURE: NomTable[] = ORDRE_TABLES;

async function lireTable(t: NomTable): Promise<Ligne[]> {
  const sb = supabase();
  const out: Ligne[] = [];
  // Lecture par pages de 1000 lignes (limite par défaut de l'API Supabase).
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await sb.from(t).select('*').range(debut, debut + 999);
    if (error) throw error;
    out.push(...(data as Ligne[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function lireCompteurs() {
  const annee = new Date().getFullYear();
  const { data } = await supabase().from('compteurs').select('nom, valeur').eq('annee', annee);
  const c = { dossier: 0, recu: 0 };
  for (const r of (data ?? []) as { nom: 'dossier' | 'recu'; valeur: number }[]) c[r.nom] = r.valeur;
  return c;
}

let generation = 0;          // augmente à chaque modification locale
let enAttente = 0;           // écritures en cours d'envoi
let minuterie: ReturnType<typeof setTimeout> | undefined;

export async function recharger(): Promise<void> {
  if (!sessionCourante) { pont.setBase(baseVide()); return; }
  // Des écritures partent : la relecture aura lieu juste après elles.
  if (enAttente > 0) return;
  const gen = generation;
  try {
    const lignes = Object.fromEntries(await Promise.all(TABLES_LECTURE.map(async (t) => [t, await lireTable(t)] as const))) as Lignes;
    const compteurs = await lireCompteurs();
    // Totaux encaissés des dossiers dont l'agent n'a pas la charge (il n'en voit pas le détail).
    const { data: resumes } = await supabase().rpc('paiements_resumes');
    // Une modification locale est arrivée pendant la lecture : on relira après son envoi.
    if (gen !== generation || enAttente > 0) return;
    pont.setBase(ajouterResumes(versBase(lignes, compteurs), (resumes ?? []) as ResumePaiement[]));
    redirigerClient();
  } catch (e) {
    console.error(e);
    pont.erreur('Connexion au serveur impossible. Vérifiez Internet puis rechargez la page.');
  }
}

function rechargerBientot() {
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { void recharger(); }, 400);
}

/* ------------------------------------------------------------------ écritures */

let file: Promise<void> = Promise.resolve();

/** Traduit une erreur PostgREST / trigger en phrase lisible. */
function messageErreur(e: { message?: string; code?: string } | null | undefined): string {
  const m = e?.message ?? '';
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return "Action refusée : vous n'avez pas les droits nécessaires.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Pas de connexion Internet : l'action n'a pas été enregistrée.";
  return m || "L'action n'a pas pu être enregistrée. Réessayez.";
}

async function executer(op: Operation) {
  const sb = supabase();
  if (op.action === 'insert') {
    const avecNumero = op.table === 'paiements' || op.table === 'dossiers';
    const colonne = op.table === 'paiements' ? 'numero_recu' : 'numero';
    const req = sb.from(op.table).insert(op.lignes);
    if (avecNumero) {
      const { data, error } = await req.select(`id, ${colonne}`);
      if (error) throw new Error(messageErreur(error));
      for (const r of (data ?? []) as Ligne[]) pont.numeroDefinitif(String(r.id), String(r[colonne]));
    } else {
      const { error } = await req;
      if (error) throw new Error(messageErreur(error));
    }
    return;
  }
  const { data, error } = await sb.from(op.table).update(op.patch).eq('id', op.id).select('id');
  if (error) throw new Error(messageErreur(error));
  // Aucune ligne modifiée = refus silencieux des règles RLS.
  if (!data || data.length === 0) throw new Error("Action refusée : vous n'avez pas les droits nécessaires.");
}

/** Appelé par store.ts après chaque modification locale (affichage immédiat, envoi en arrière-plan). */
export function envoyer(avant: Base, apres: Base): void {
  const ops = differences(avant, apres);
  if (!ops.length) return;
  generation += 1;
  enAttente += 1;
  file = file.then(async () => {
    try {
      for (const op of ops) await executer(op);
    } catch (e) {
      console.error(e);
      pont.erreur(e instanceof Error ? e.message : String(e));
    } finally {
      enAttente -= 1;
      if (enAttente === 0) {
        // Toujours relire après un envoi (et après un refus) : numéros, journal et dates viennent du serveur.
        rechargerBientot();
      }
    }
  });
}

/** Attend que toutes les écritures en cours soient parties (utile avant de quitter / se déconnecter). */
export function patienter(): Promise<void> {
  return file;
}

/* ------------------------------------------------------------------ temps réel */

function abonnerTempsReel() {
  canal?.unsubscribe();
  const sb = supabase();
  canal = sb.channel('wd-base');
  for (const t of ORDRE_TABLES) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => rechargerBientot());
  }
  canal.subscribe();
}

/* ------------------------------------------------------------------ connexion */

/** Un client connecté est envoyé vers son espace (son dossier le plus récent). */
function redirigerClient() {
  const b = pont.getBase();
  const id = sessionCourante?.user.id;
  if (!id || b.utilisateurs.some((u) => u.id === id)) return; // personnel : rien à faire
  if (location.hash.startsWith('#/espace/') && b.dossiers.some((d) => location.hash === `#/espace/${d.id}`)) return;
  const dernier = [...b.dossiers].sort((x, y) => y.ouvertLe.localeCompare(x.ouvertLe))[0];
  if (dernier) location.hash = `#/espace/${dernier.id}`;
}

let chargePour: string | null = null;   // compte pour lequel la Base est chargée
let mfaReporte = false;                 // « Plus tard » choisi (seulement si la MFA n'est pas obligatoire)

/** Un administrateur doit-il encore saisir (ou activer) son code à 6 chiffres ? */
async function etapeMfa(id: string): Promise<EtatMfa> {
  const sb = supabase();
  const { data: profil } = await sb.from('profils').select('role, actif').eq('id', id).maybeSingle();
  if (!profil || profil.role !== 'admin' || !profil.actif) return { etape: 'aucune' };
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { etape: 'aucune' };
  if (aal?.nextLevel === 'aal2') return { etape: 'verification' };
  const { data: reglage } = await sb.from('securite').select('mfa_admin_obligatoire').eq('id', 1).maybeSingle();
  const obligatoire = !!reglage?.mfa_admin_obligatoire;
  if (!obligatoire && mfaReporte) return { etape: 'aucune' };
  return { etape: 'enrolement', obligatoire };
}

async function appliquerSession(s: Session | null) {
  sessionCourante = s;
  const id = s?.user.id ?? null;
  if (!id) {
    chargePour = null; mfaReporte = false;
    canal?.unsubscribe(); canal = null;
    pont.setMfa({ etape: 'aucune' });
    pont.setSession(null);
    pont.setBase(baseVide());
    return;
  }
  if (chargePour === id) { pont.setSession(id); return; }
  const mfa = await etapeMfa(id);
  pont.setMfa(mfa);
  if (mfa.etape !== 'aucune') {
    // Tant que le code n'est pas saisi, l'application reste sur l'écran de connexion.
    pont.setSession(null);
    return;
  }
  chargePour = id;
  pont.setSession(id);
  abonnerTempsReel();
  await recharger();
}

/* ------------------------------------------------------------------ double authentification (TOTP) */

let facteurEnCours: string | null = null;

/** Vérifie le code à 6 chiffres de l'application d'authentification (Google Authenticator, Microsoft Authenticator…). */
export async function verifierCodeMfa(code: string): Promise<void> {
  const sb = supabase();
  const { data } = await sb.auth.mfa.listFactors();
  const facteur = data?.totp?.[0];
  if (!facteur) throw new Error('Aucune application d\'authentification n\'est activée sur ce compte.');
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: facteur.id, code: code.replace(/\s/g, '') });
  if (error) throw new Error('Code incorrect ou expiré. Saisissez le code affiché en ce moment.');
  await appliquerSession((await sb.auth.getSession()).data.session);
}

/** Première activation : renvoie le QR code (image) et la clé à saisir à la main si besoin. */
export async function commencerEnrolementMfa(): Promise<{ qrCode: string; secret: string }> {
  const sb = supabase();
  // Nettoyer une activation commencée puis abandonnée.
  const { data: liste } = await sb.auth.mfa.listFactors();
  for (const f of liste?.all ?? []) {
    if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `World Destination ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) throw new Error("L'activation n'a pas pu commencer. Réessayez.");
  facteurEnCours = data.id;
  return { qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmerEnrolementMfa(code: string): Promise<void> {
  if (!facteurEnCours) throw new Error("Recommencez l'activation.");
  const sb = supabase();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: facteurEnCours, code: code.replace(/\s/g, '') });
  if (error) throw new Error('Code incorrect. Vérifiez l\'heure du téléphone et saisissez le code affiché.');
  facteurEnCours = null;
  await appliquerSession((await sb.auth.getSession()).data.session);
}

/** « Plus tard » : possible uniquement tant que la MFA n'est pas rendue obligatoire (table securite). */
export async function reporterMfa(): Promise<void> {
  mfaReporte = true;
  await appliquerSession((await supabase().auth.getSession()).data.session);
}

/** Lien reçu par e-mail au format « ?token_hash=…&type=… » (modèles d'e-mail personnalisés). */
async function verifierLienEmail() {
  const p = new URLSearchParams(location.search);
  const tokenHash = p.get('token_hash');
  const type = p.get('type');
  if (!tokenHash || !type) return;
  const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: type as 'magiclink' | 'invite' | 'email' });
  history.replaceState(null, '', location.pathname + location.hash);
  if (error) pont.erreur('Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau.');
}

/**
 * Lien magique / invitation au format « #access_token=… » : les jetons sont retirés de l'adresse
 * (et de l'historique du navigateur) AVANT d'ouvrir la session.
 */
async function lireJetonsDansAdresse() {
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  const access = h.get('access_token');
  const refresh = h.get('refresh_token');
  if (h.get('error_description') || h.get('error')) {
    history.replaceState(null, '', location.pathname + location.search);
    pont.erreur('Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau.');
    return;
  }
  if (!access || !refresh) return;
  history.replaceState(null, '', location.pathname + location.search);
  const { error } = await supabase().auth.setSession({ access_token: access, refresh_token: refresh });
  if (error) pont.erreur('Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau.');
}

export async function demarrer(p: Pont): Promise<void> {
  pont = p;
  const sb = supabase();
  await lireJetonsDansAdresse();
  await verifierLienEmail();
  sb.auth.onAuthStateChange((evt, s) => {
    // Rafraîchissement du jeton : rien à recharger.
    if (evt === 'TOKEN_REFRESHED') { sessionCourante = s; return; }
    if (evt === 'MFA_CHALLENGE_VERIFIED') return; // traité par verifierCodeMfa / confirmerEnrolementMfa
    // Différé : les appels Supabase dans ce rappel sont déconseillés (verrou interne).
    setTimeout(() => { void appliquerSession(s); }, 0);
  });
  const { data } = await sb.auth.getSession();
  await appliquerSession(data.session);
}

/* ------------------------------------------------------------------ actions de connexion */

const retour = () => location.origin + location.pathname;

export async function connexionMotDePasse(email: string, motDePasse: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: motDePasse });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou mot de passe incorrect.' : messageErreur(error));
}

/**
 * Envoie un lien magique. Le compte doit déjà exister (créé par l'agence) : pas d'inscription libre.
 * Réponse volontairement identique, que l'adresse soit connue ou non : on ne révèle pas qui est client.
 */
export async function envoyerLienMagique(email: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: retour() },
  });
  if (!error) return;
  if (/rate|seconds|too many/i.test(error.message)) throw new Error('Patientez une minute avant de redemander un lien.');
  if (/Failed to fetch|NetworkError|network/i.test(error.message)) throw new Error(messageErreur(error));
  // Adresse inconnue (ou autre refus) : même réponse qu'en cas de succès.
}

export async function changerMotDePasse(nouveau: string): Promise<void> {
  const { error } = await supabase().auth.updateUser({ password: nouveau });
  if (error) throw new Error(messageErreur(error));
}

export async function deconnecter(): Promise<void> {
  await patienter().catch(() => undefined);
  await supabase().auth.signOut();
}

/** Crée (ou relie) le compte de l'espace client via l'Edge Function « inviter-client » (clé secrète côté serveur). */
export async function inviterClient(clientId: string, qui: 'client' | 'suivi' = 'client'): Promise<{ email: string; dejaExistant: boolean }> {
  const { data, error } = await supabase().functions.invoke('inviter-client', { body: { clientId, qui } });
  if (error) {
    let message = error.message;
    try {
      const corps = await (error as { context?: Response }).context?.json();
      if (corps?.erreur) message = corps.erreur;
    } catch { /* corps illisible */ }
    throw new Error(message);
  }
  rechargerBientot();
  return data as { email: string; dejaExistant: boolean };
}

/** Consentement écrit du titulaire pour l'accès du parent (retrait = accès du parent coupé). */
export async function enregistrerConsentementSuivi(clientId: string, accorde: boolean): Promise<void> {
  const { error } = await supabase().rpc('enregistrer_consentement_suivi', { p_client: clientId, p_accorde: accorde });
  if (error) throw new Error(messageErreur(error));
  rechargerBientot();
}

/**
 * Purge d'un dossier (administrateur) : efface d'abord TOUS les fichiers du dossier dans Storage
 * (y compris ceux qui ne sont plus référencés), puis les références en base ; anonymise la fiche si demandé.
 * Paiements, reçus et journal sont conservés.
 */
export async function purgerDossier(dossierId: string, anonymiser = false): Promise<number> {
  const sb = supabase();
  const { data: objets, error: errListe } = await sb.storage.from(BUCKET).list(dossierId, { limit: 1000 });
  if (errListe) throw new Error('Impossible de lister les fichiers du dossier.');
  const chemins = (objets ?? []).map((o) => `${dossierId}/${o.name}`);
  if (chemins.length) {
    const { error } = await sb.storage.from(BUCKET).remove(chemins);
    if (error) throw new Error("Les fichiers n'ont pas pu être effacés : rien n'a été modifié. Réessayez.");
  }
  const { data, error } = await sb.rpc('purger_dossier', { p_dossier: dossierId, p_anonymiser: anonymiser });
  if (error) throw new Error(messageErreur(error));
  rechargerBientot();
  return Number(data ?? 0);
}
