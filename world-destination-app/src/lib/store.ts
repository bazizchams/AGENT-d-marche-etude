/**
 * Accès aux données. Les écrans n'utilisent que ce module ; ses exports sont les mêmes dans les deux modes.
 * - Mode démonstration (par défaut) : tout est gardé dans le navigateur (localStorage + IndexedDB).
 * - Version en ligne (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY définies) : la Base est chargée depuis
 *   Supabase ; chaque action s'affiche tout de suite puis est envoyée au serveur, qui revérifie les règles
 *   (voir src/lib/supabase/ et supabase/schema.sql). Les collègues voient les changements en temps réel.
 */
import { useSyncExternalStore } from 'react';
import { donneesDemo } from './demo';
import { enregistrerFichier, idFichier } from './fichiers';
import { MODE_EN_LIGNE } from './supabase/config';
import { baseVide } from './supabase/correspondance';
import {
  creerDossier, evenement, fraisBloquants, maintenant, montant, numeroDossier, numeroRecu, resteEcheance, resteFrais, uid,
} from './regles';
import type {
  Base, Client, Dossier, ModeleDossier, ModePaiement, Paiement, ParametresAgence, StatutDossier, Utilisateur,
} from './types';

const CLE = 'wd-base-v1';
const CLE_SESSION = 'wd-session';

/** Vrai quand l'application fonctionne avec Supabase (version en ligne). */
export const modeEnLigne = MODE_EN_LIGNE;

/** Module en ligne, chargé à la demande : le mode démonstration ne télécharge pas Supabase. */
const enLigne = MODE_EN_LIGNE ? import('./supabase/synchro') : null;
const moduleEnLigne = () => {
  if (!enLigne) throw new ErreurMetier('Disponible uniquement dans la version en ligne.');
  return enLigne;
};

function charger(): Base {
  if (MODE_EN_LIGNE) return baseVide(); // remplie après la connexion
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as Base;
  } catch { /* stockage indisponible : on repart des données de démonstration */ }
  const demo = donneesDemo();
  // Enregistrées tout de suite : les identifiants (liens d'espace client, QR codes) restent les mêmes après rechargement.
  try { localStorage.setItem(CLE, JSON.stringify(demo)); } catch { /* stockage indisponible */ }
  return demo;
}

let base: Base = charger();
let session: string | null = MODE_EN_LIGNE
  ? null
  : (() => { try { return localStorage.getItem(CLE_SESSION); } catch { return null; } })();
let chargement = MODE_EN_LIGNE;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

function sauver() {
  // En ligne, rien n'est gardé dans le navigateur (PC partagé, confidentialité) : le serveur fait foi.
  if (!MODE_EN_LIGNE) {
    try { localStorage.setItem(CLE, JSON.stringify(base)); } catch { /* quota plein ou mode privé */ }
  }
  prevenir();
}

function muter(fn: (b: Base) => void) {
  const avant = base;
  const copie = structuredClone(base);
  fn(copie);
  base = copie;
  sauver();
  if (enLigne) void enLigne.then((m) => m.envoyer(avant, copie));
}

/* ---------------- Version en ligne : branchement ---------------- */

/** Objets renvoyés aux écrans dont le numéro définitif (reçu, dossier) est attribué par le serveur. */
const enAttenteDeNumero = new Map<string, { numeroRecu?: string; numero?: string }>();

function afficherErreur(message: string) {
  // Import différé : components/ui importe lui-même ce module.
  void import('../components/ui').then((ui) => ui.notifier(message, true)).catch(() => alert(message));
}

if (enLigne) {
  void enLigne.then((m) => m.demarrer({
    getBase: () => base,
    setBase: (b) => { base = b; chargement = false; prevenir(); },
    setSession: (id) => { session = id; if (!id) chargement = false; prevenir(); },
    numeroDefinitif: (id, numero) => {
      const o = enAttenteDeNumero.get(id);
      if (!o) return;
      if ('numeroRecu' in o) o.numeroRecu = numero; else o.numero = numero;
      enAttenteDeNumero.delete(id);
      prevenir();
    },
    erreur: afficherErreur,
  })).catch((e) => { console.error(e); chargement = false; afficherErreur('Connexion au serveur impossible.'); prevenir(); });
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useBase(): Base {
  return useSyncExternalStore(abonner, () => base);
}

export function useUtilisateur(): Utilisateur | undefined {
  const b = useBase();
  const s = useSyncExternalStore(abonner, () => session);
  return b.utilisateurs.find((u) => u.id === s && u.actif);
}

export const getBase = () => base;

/** Vrai pendant le premier chargement des données en ligne (toujours faux en démonstration). */
export function useChargement(): boolean {
  return useSyncExternalStore(abonner, () => chargement);
}

/* ---------------- Session ---------------- */

export function connexion(userId: string) {
  if (MODE_EN_LIGNE) {
    // En ligne, on se connecte avec son e-mail (connexionMotDePasse ou envoyerLienMagique).
    console.warn('connexion(userId) est réservée au mode démonstration.');
    return;
  }
  session = userId;
  try { localStorage.setItem(CLE_SESSION, userId); } catch { /* ignore */ }
  abonnes.forEach((f) => f());
}

export function deconnexion() {
  if (enLigne) {
    void enLigne.then((m) => m.deconnecter());
    return;
  }
  session = null;
  try { localStorage.removeItem(CLE_SESSION); } catch { /* ignore */ }
  abonnes.forEach((f) => f());
}

/* Connexion en ligne (personnel : e-mail + mot de passe ou lien magique ; client : lien magique). */

export async function connexionMotDePasse(email: string, motDePasse: string): Promise<void> {
  return (await moduleEnLigne()).connexionMotDePasse(email, motDePasse);
}

export async function envoyerLienMagique(email: string): Promise<void> {
  return (await moduleEnLigne()).envoyerLienMagique(email);
}

export async function changerMotDePasse(nouveau: string): Promise<void> {
  return (await moduleEnLigne()).changerMotDePasse(nouveau);
}

/**
 * Crée le compte de l'espace client (ou de la personne qui suit le dossier) et lui envoie l'invitation
 * par e-mail. Passe par l'Edge Function « inviter-client » : la clé secrète reste sur le serveur.
 */
export async function inviterClient(clientId: string, qui: 'client' | 'suivi' = 'client') {
  try {
    return await (await moduleEnLigne()).inviterClient(clientId, qui);
  } catch (e) {
    throw e instanceof ErreurMetier ? e : new ErreurMetier(e instanceof Error ? e.message : String(e));
  }
}

function moi(): string {
  if (!session) throw new Error('Non connecté');
  return session;
}

function dossierDe(b: Base, id: string): Dossier {
  const d = b.dossiers.find((x) => x.id === id);
  if (!d) throw new Error('Dossier introuvable');
  return d;
}

/* ---------------- Clients et dossiers ---------------- */

export function creerClient(data: Omit<Client, 'id' | 'creeLe' | 'creePar'>): Client {
  const c: Client = { ...data, id: uid(), creeLe: maintenant(), creePar: moi() };
  muter((b) => { b.clients.push(c); });
  return c;
}

export function majClient(id: string, data: Partial<Client>) {
  muter((b) => {
    const c = b.clients.find((x) => x.id === id);
    if (c) Object.assign(c, data);
  });
}

export function ouvrirDossier(clientId: string, modeleId: string, agentId: string, intitule?: string): Dossier {
  let cree!: Dossier;
  muter((b) => {
    const client = b.clients.find((c) => c.id === clientId)!;
    const modele = b.modeles.find((m) => m.id === modeleId)!;
    b.compteurs.dossier += 1;
    cree = creerDossier(modele, client, agentId, numeroDossier(b.compteurs.dossier), intitule);
    cree.journal[0].par = moi();
    b.dossiers.push(cree);
  });
  return cree;
}

export function changerStatut(dossierId: string, statut: StatutDossier, motif?: string) {
  const libelles: Record<StatutDossier, string> = { en_cours: 'rouvert', termine: 'clôturé (procédure terminée)', annule: 'annulé' };
  muter((b) => {
    const d = dossierDe(b, dossierId);
    d.statut = statut;
    d.journal.push(evenement(moi(), 'statut', `Dossier ${libelles[statut]}${motif ? ` – ${motif}` : ''}`));
  });
}

export function changerAgent(dossierId: string, agentId: string) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    d.agentId = agentId;
    const nom = b.utilisateurs.find((u) => u.id === agentId)?.nom ?? '';
    d.journal.push(evenement(moi(), 'statut', `Dossier confié à ${nom}`, true));
  });
}

/* ---------------- Documents ---------------- */

/** Erreur d'envoi de fichier présentée proprement à l'écran (message lisible). */
async function enregistrerFichierMetier(id: string, fichier: Blob) {
  try {
    await enregistrerFichier(id, fichier);
  } catch (e) {
    if (!MODE_EN_LIGNE) throw e;
    throw new ErreurMetier(e instanceof Error ? e.message : "L'envoi du fichier a échoué.");
  }
}

export async function televerserDocument(dossierId: string, docId: string, fichier: File, expiration?: string) {
  const fichierId = idFichier(dossierId, fichier);
  await enregistrerFichierMetier(fichierId, fichier);
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const doc = d.documents.find((x) => x.id === docId)!;
    Object.assign(doc, {
      statut: 'valide', fichierId, nomFichier: fichier.name, typeFichier: fichier.type,
      motifRefus: undefined, majLe: maintenant(), majPar: moi(),
      expiration: expiration || doc.expiration,
    });
    d.journal.push(evenement(moi(), 'document', `${doc.nom} : reçu à l'agence et téléversé ✔`));
  });
}

/** Envoi depuis l'espace client : le document passe « à vérifier ». */
export async function televerserParClient(dossierId: string, docId: string, fichier: File) {
  const fichierId = idFichier(dossierId, fichier);
  await enregistrerFichierMetier(fichierId, fichier);
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const doc = d.documents.find((x) => x.id === docId)!;
    Object.assign(doc, {
      statut: 'envoye', fichierId, nomFichier: fichier.name, typeFichier: fichier.type,
      motifRefus: undefined, majLe: maintenant(), majPar: 'client',
    });
    d.journal.push(evenement('client', 'document', `${doc.nom} : envoyé par le client depuis son espace (à vérifier)`));
  });
}

export function validerDocument(dossierId: string, docId: string) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const doc = d.documents.find((x) => x.id === docId)!;
    Object.assign(doc, { statut: 'valide', motifRefus: undefined, majLe: maintenant(), majPar: moi() });
    d.journal.push(evenement(moi(), 'document', `${doc.nom} : validé ✔`));
  });
}

export function refuserDocument(dossierId: string, docId: string, motif: string) {
  motif = motif.trim();
  if (!motif) throw new ErreurMetier('Le motif du refus est obligatoire : il sera affiché au client.');
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const doc = d.documents.find((x) => x.id === docId)!;
    Object.assign(doc, { statut: 'refuse', motifRefus: motif, majLe: maintenant(), majPar: moi() });
    d.journal.push(evenement(moi(), 'document', `${doc.nom} : refusé – ${motif}`));
  });
}

export function majExpiration(dossierId: string, docId: string, expiration: string) {
  muter((b) => {
    const doc = dossierDe(b, dossierId).documents.find((x) => x.id === docId)!;
    doc.expiration = expiration || undefined;
  });
}

export function ajouterDocument(dossierId: string, nom: string, avecExpiration: boolean) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    d.documents.push({ id: uid(), nom, statut: 'manquant', avecExpiration });
    d.journal.push(evenement(moi(), 'document', `Document demandé en plus : ${nom}`));
  });
}

/* ---------------- Paiements ---------------- */

export class ErreurMetier extends Error {}

export function encaisser(
  dossierId: string, cible: Paiement['cible'], montantRecu: number, mode: ModePaiement,
): Paiement {
  let cree!: Paiement;
  muter((b) => {
    const d = dossierDe(b, dossierId);
    let devise, libelle, reste;
    if (cible.type === 'echeance') {
      const e = d.echeances.find((x) => x.id === cible.id)!;
      devise = e.devise; libelle = e.libelle; reste = resteEcheance(d, e.id);
    } else {
      const f = d.frais.find((x) => x.id === cible.id)!;
      devise = f.devise; libelle = f.nom; reste = resteFrais(d, f);
    }
    if (!(montantRecu > 0)) throw new ErreurMetier('Saisissez un montant supérieur à 0.');
    if (montantRecu > reste) throw new ErreurMetier(`Le montant dépasse le reste à payer (${montant(reste, devise)}).`);
    b.compteurs.recu += 1;
    cree = {
      id: uid(), numeroRecu: numeroRecu(b.compteurs.recu), cible, montant: montantRecu, devise, mode,
      date: maintenant(), par: moi(),
    };
    d.paiements.push(cree);
    d.journal.push(evenement(moi(), 'paiement', `Encaissement ${montant(montantRecu, devise)} – ${libelle} (reçu ${cree.numeroRecu})`));
  });
  // En ligne, le numéro affiché est une prévision ; le serveur attribue le définitif (sans doublon).
  if (MODE_EN_LIGNE) enAttenteDeNumero.set(cree.id, cree);
  return cree;
}

/** Un paiement ne s'efface jamais : il est annulé avec un motif (administrateur uniquement). */
export function annulerPaiement(dossierId: string, paiementId: string, motif: string) {
  muter((b) => {
    const user = b.utilisateurs.find((u) => u.id === moi());
    if (user?.role !== 'admin') throw new ErreurMetier("Seul un administrateur peut annuler un paiement.");
    if (!motif.trim()) throw new ErreurMetier("Le motif d'annulation est obligatoire.");
    const d = dossierDe(b, dossierId);
    const p = d.paiements.find((x) => x.id === paiementId)!;
    p.annule = { le: maintenant(), par: moi(), motif };
    d.journal.push(evenement(moi(), 'paiement', `Paiement ${p.numeroRecu} annulé – ${motif}`));
  });
}

export function marquerVerse(dossierId: string, fraisId: string, verse: boolean) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const f = d.frais.find((x) => x.id === fraisId)!;
    f.verse = verse;
    f.verseLe = verse ? maintenant() : undefined;
    f.versePar = verse ? moi() : undefined;
    d.journal.push(evenement(moi(), 'paiement', verse ? `${f.nom} versé à ${f.organisme}` : `${f.nom} : versement annulé`, true));
  });
}

/* ---------------- Étapes, notes, rendez-vous ---------------- */

export function validerEtape(dossierId: string, etapeId: string) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const e = d.etapes.find((x) => x.id === etapeId)!;
    const bloquants = fraisBloquants(d, e);
    if (bloquants.length) {
      throw new ErreurMetier(`Étape bloquée : frais non encaissés (${bloquants.map((f) => f.nom).join(', ')}). Les frais de procédure se paient à 100 % d'avance.`);
    }
    Object.assign(e, { faite: true, faiteLe: maintenant(), faitePar: moi() });
    d.journal.push(evenement(moi(), 'etape', `Étape terminée : ${e.nom}`));
  });
}

export function rouvrirEtape(dossierId: string, etapeId: string) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    const e = d.etapes.find((x) => x.id === etapeId)!;
    Object.assign(e, { faite: false, faiteLe: undefined, faitePar: undefined });
    d.journal.push(evenement(moi(), 'etape', `Étape rouverte : ${e.nom}`, true));
  });
}

export function ajouterNote(dossierId: string, texte: string, interne: boolean) {
  muter((b) => {
    dossierDe(b, dossierId).journal.push(evenement(moi(), 'note', texte, interne));
  });
}

export function fixerRdv(dossierId: string, dateRdv: string, lieu: string) {
  muter((b) => {
    const d = dossierDe(b, dossierId);
    d.rdv = dateRdv ? { date: dateRdv, lieu } : undefined;
    d.journal.push(evenement(moi(), 'rdv', dateRdv
      ? `Rendez-vous fixé le ${new Date(dateRdv).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} – ${lieu}`
      : 'Rendez-vous supprimé'));
  });
}

export function journaliserMessage(dossierId: string, texte: string) {
  muter((b) => {
    dossierDe(b, dossierId).journal.push(evenement(moi(), 'message', texte, true));
  });
}

/* ---------------- Paramètres (administrateur) ---------------- */

export function enregistrerModele(m: ModeleDossier) {
  muter((b) => {
    const i = b.modeles.findIndex((x) => x.id === m.id);
    if (i >= 0) b.modeles[i] = m; else b.modeles.push(m);
  });
}

export function majParametres(p: ParametresAgence) {
  muter((b) => { b.parametres = p; });
}

export function enregistrerUtilisateur(u: Utilisateur) {
  if (MODE_EN_LIGNE && !base.utilisateurs.some((x) => x.id === u.id)) {
    throw new ErreurMetier("Un nouveau compte du personnel se crée dans Supabase (Authentication › Add user), puis apparaît ici. Voir le guide de mise en ligne.");
  }
  muter((b) => {
    const i = b.utilisateurs.findIndex((x) => x.id === u.id);
    if (i >= 0) b.utilisateurs[i] = u; else b.utilisateurs.push(u);
  });
}

export function reinitialiserDemo() {
  if (MODE_EN_LIGNE) throw new ErreurMetier('Indisponible dans la version en ligne : les données réelles ne sont jamais effacées.');
  base = donneesDemo();
  sauver();
}
