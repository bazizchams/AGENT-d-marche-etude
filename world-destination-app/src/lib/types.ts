export type Role = 'admin' | 'agent' | 'client';
export type Langue = 'fr' | 'ar';
export type Devise = 'DZD' | 'EUR' | 'CAD';
export type ModePaiement = 'especes' | 'ccp' | 'virement' | 'baridimob';

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  role: Role;
  actif: boolean;
}

export interface Client {
  id: string;
  nom: string;
  prenom: string;
  telephone: string; // format international conseillé : 213…
  email: string;
  dateNaissance?: string;
  adresse?: string;
  langue: Langue;
  /** Personne qui suit le dossier à la place du client (parent…) */
  contactSuivi?: { nom: string; telephone: string; email: string };
  creeLe: string;
  creePar: string;
}

/* ---------- Modèles de dossier (paramétrables par un administrateur) ---------- */

export interface ModeleDocument {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  avecExpiration: boolean;
}

export interface ModeleFrais {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  organisme: string;
  montant: number;
  devise: Devise;
}

export interface ModeleEtape {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  /** Frais qui doivent être encaissés à 100 % avant de valider l'étape */
  fraisRequis: string[];
}

export interface ModeleDossier {
  id: string;
  nom: string;
  couleur: string;
  honoraires: number;
  deviseHonoraires: Devise;
  documents: ModeleDocument[];
  etapes: ModeleEtape[];
  frais: ModeleFrais[];
  actif: boolean;
}

/* ---------- Dossier client ---------- */

export type StatutDocument = 'manquant' | 'envoye' | 'valide' | 'refuse';

export interface DocumentDossier {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  statut: StatutDocument;
  avecExpiration: boolean;
  expiration?: string;
  fichierId?: string;
  nomFichier?: string;
  typeFichier?: string;
  motifRefus?: string;
  majLe?: string;
  majPar?: string;
}

export interface EtapeDossier {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  fraisRequis: string[];
  faite: boolean;
  faiteLe?: string;
  faitePar?: string;
}

export interface Echeance {
  id: string;
  libelle: string;
  moment: 'depot' | 'fin';
  montant: number;
  devise: Devise;
}

export interface FraisDossier {
  id: string;
  nom: string;
  /** Libellé en arabe (espace client, messages). Repli sur `nom` si absent. */
  nomAr?: string;
  organisme: string;
  montant: number;
  devise: Devise;
  /** L'agence a reversé le montant à l'organisme (Campus France, VFS…) */
  verse: boolean;
  verseLe?: string;
  versePar?: string;
}

export interface Paiement {
  id: string;
  numeroRecu: string;
  /** Échéance d'honoraires ou frais de procédure concerné */
  cible: { type: 'echeance' | 'frais'; id: string };
  montant: number;
  devise: Devise;
  mode: ModePaiement;
  date: string;
  par: string;
  annule?: { le: string; par: string; motif: string };
}

export type TypeEvenement = 'creation' | 'document' | 'paiement' | 'etape' | 'note' | 'rdv' | 'statut' | 'message';

export interface Evenement {
  id: string;
  date: string;
  par: string;
  type: TypeEvenement;
  texte: string;
  /** Version arabe du texte, affichée au client arabophone (sinon libellé générique selon `type`). */
  texteAr?: string;
  interne?: boolean;
}

export type StatutDossier = 'en_cours' | 'termine' | 'annule';

export interface Dossier {
  id: string;
  numero: string;
  clientId: string;
  modeleId: string;
  intitule: string;
  agentId: string;
  statut: StatutDossier;
  ouvertLe: string;
  rdv?: { date: string; lieu: string };
  documents: DocumentDossier[];
  etapes: EtapeDossier[];
  echeances: Echeance[];
  frais: FraisDossier[];
  paiements: Paiement[];
  journal: Evenement[];
}

export interface ParametresAgence {
  nom: string;
  telephone: string;
  whatsapp: string;
  adresse: string;
  email: string;
  joursAlerteExpiration: number;
}

export interface Base {
  version: number;
  utilisateurs: Utilisateur[];
  clients: Client[];
  modeles: ModeleDossier[];
  dossiers: Dossier[];
  parametres: ParametresAgence;
  compteurs: { dossier: number; recu: number };
}
