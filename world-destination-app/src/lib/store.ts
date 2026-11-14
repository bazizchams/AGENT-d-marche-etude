/**
 * Accès aux données.
 * Mode démonstration : tout est gardé dans le navigateur (localStorage).
 * La version en ligne remplacera ce module par Supabase (voir supabase/schema.sql),
 * sans changer les écrans.
 */
import { useSyncExternalStore } from 'react';
import { donneesDemo } from './demo';
import { enregistrerFichier } from './fichiers';
import {
  creerDossier, evenement, fraisBloquants, maintenant, montant, numeroDossier, numeroRecu, resteEcheance, resteFrais, uid,
} from './regles';
import type {
  Base, Client, Dossier, ModeleDossier, ModePaiement, Paiement, ParametresAgence, StatutDossier, Utilisateur,
} from './types';

const CLE = 'wd-base-v1';
const CLE_SESSION = 'wd-session';

function charger(): Base {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as Base;
  } catch { /* stockage indisponible : on repart des données de démonstration */ }
  return donneesDemo();
}

let base: Base = charger();
let session: string | null = (() => { try { return localStorage.getItem(CLE_SESSION); } catch { return null; } })();
const abonnes = new Set<() => void>();

function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(base)); } catch { /* quota plein ou mode privé */ }
  abonnes.forEach((f) => f());
}

function muter(fn: (b: Base) => void) {
  const copie = structuredClone(base);
  fn(copie);
  base = copie;
  sauver();
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

/* ---------------- Session ---------------- */

export function connexion(userId: string) {
  session = userId;
  try { localStorage.setItem(CLE_SESSION, userId); } catch { /* ignore */ }
  abonnes.forEach((f) => f());
}

export function deconnexion() {
  session = null;
  try { localStorage.removeItem(CLE_SESSION); } catch { /* ignore */ }
  abonnes.forEach((f) => f());
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

export async function televerserDocument(dossierId: string, docId: string, fichier: File, expiration?: string) {
  const fichierId = uid();
  await enregistrerFichier(fichierId, fichier);
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
  const fichierId = uid();
  await enregistrerFichier(fichierId, fichier);
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
  muter((b) => {
    const i = b.utilisateurs.findIndex((x) => x.id === u.id);
    if (i >= 0) b.utilisateurs[i] = u; else b.utilisateurs.push(u);
  });
}

export function reinitialiserDemo() {
  base = donneesDemo();
  sauver();
}
