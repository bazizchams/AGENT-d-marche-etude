/**
 * Correspondance entre l'objet `Base` utilisé par les écrans et les tables Supabase.
 * Module PUR (aucun appel réseau) : il est testé dans correspondance.test.ts.
 *
 * Principe de la synchronisation : chaque action de store.ts modifie une copie de la `Base`
 * (exactement le même code qu'en démonstration) ; on compare ensuite l'avant et l'après,
 * table par table et colonne par colonne, et on n'envoie au serveur que ce qui a changé.
 * Les règles sensibles (montants, étapes, numéros, journal) sont revérifiées par les triggers SQL.
 */
import type {
  Base, Client, DocumentDossier, Dossier, Echeance, EtapeDossier, Evenement, FraisDossier, ModeleDossier,
  Paiement, ParametresAgence, TypeEvenement, Utilisateur,
} from '../types';

export type Ligne = Record<string, unknown>;
export type NomTable =
  | 'profils' | 'parametres' | 'modeles' | 'clients' | 'dossiers' | 'documents'
  | 'frais' | 'etapes' | 'echeances' | 'paiements' | 'journal';
export type Lignes = Record<NomTable, Ligne[]>;

/** Ordre d'écriture : les parents avant les enfants (clés étrangères). */
export const ORDRE_TABLES: NomTable[] = [
  'profils', 'parametres', 'modeles', 'clients', 'dossiers', 'documents', 'frais', 'etapes', 'echeances', 'paiements', 'journal',
];

/** Types d'événements écrits AUTOMATIQUEMENT par les triggers du serveur : le navigateur ne les envoie pas. */
export const EVENEMENTS_SERVEUR: TypeEvenement[] = ['creation', 'document', 'paiement', 'etape', 'statut', 'rdv'];

/** Colonnes jamais envoyées en modification (gérées par le serveur ou immuables). */
const COLONNES_FIGEES: Partial<Record<NomTable, string[]>> = {
  profils: ['email'],
  dossiers: ['numero'],
  paiements: ['numero_recu', 'date', 'par'],
  documents: ['maj_le', 'maj_par'],
  etapes: ['faite_le', 'faite_par'],
  frais: ['verse_le', 'verse_par'],
};

/** Colonnes non envoyées à la création (le serveur les fixe lui-même). */
const COLONNES_SERVEUR_CREATION: Partial<Record<NomTable, string[]>> = {
  paiements: ['annule_le', 'annule_par', 'motif_annulation'],
  documents: ['maj_le', 'maj_par'],
};

/* ------------------------------------------------------------------ outils */

const PAS_UN_UUID = new Set(['client', '']);
/** Auteur → uuid du compte, ou null (« client » est remplacé côté serveur par le compte connecté). */
const auteur = (v?: string) => (v && !PAS_UN_UUID.has(v) ? v : null);
const vide = (v?: string | null) => (v === undefined || v === null || v === '' ? null : v);
const ar = (o: object) => vide((o as { nomAr?: string }).nomAr);
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const avecNomAr = <T extends object>(o: T, v: unknown): T => (v ? Object.assign(o, { nomAr: String(v) }) : o);

/* ------------------------------------------------------------------ Base → lignes */

export function versLignes(b: Base): Lignes {
  const l: Lignes = {
    profils: [], parametres: [], modeles: [], clients: [], dossiers: [], documents: [],
    frais: [], etapes: [], echeances: [], paiements: [], journal: [],
  };
  for (const u of b.utilisateurs) l.profils.push({ id: u.id, nom: u.nom, email: u.email, role: u.role, actif: u.actif });
  const p = b.parametres;
  l.parametres.push({
    id: 1, nom: p.nom, telephone: p.telephone, whatsapp: p.whatsapp, adresse: p.adresse, email: p.email,
    jours_alerte_expiration: p.joursAlerteExpiration,
  });
  for (const m of b.modeles) {
    l.modeles.push({
      id: m.id, nom: m.nom, nom_ar: ar(m), couleur: m.couleur, honoraires: m.honoraires,
      devise_honoraires: m.deviseHonoraires, documents: m.documents, etapes: m.etapes, frais: m.frais, actif: m.actif,
    });
  }
  for (const c of b.clients) {
    l.clients.push({
      id: c.id, nom: c.nom, prenom: c.prenom, telephone: c.telephone ?? '', email: c.email ?? '',
      date_naissance: vide(c.dateNaissance), adresse: vide(c.adresse), langue: c.langue,
      contact_suivi: c.contactSuivi ?? null, cree_le: c.creeLe, cree_par: auteur(c.creePar),
    });
  }
  for (const d of b.dossiers) {
    l.dossiers.push({
      id: d.id, numero: d.numero, client_id: d.clientId, modele_id: vide(d.modeleId), intitule: d.intitule,
      agent_id: auteur(d.agentId), statut: d.statut, ouvert_le: d.ouvertLe,
      rdv_date: d.rdv?.date ? d.rdv.date : null, rdv_lieu: d.rdv ? vide(d.rdv.lieu) : null,
    });
    d.documents.forEach((x, i) => l.documents.push({
      id: x.id, dossier_id: d.id, ordre: i, nom: x.nom, nom_ar: ar(x), statut: x.statut, avec_expiration: x.avecExpiration,
      expiration: vide(x.expiration), chemin_fichier: vide(x.fichierId), nom_fichier: vide(x.nomFichier),
      type_fichier: vide(x.typeFichier), motif_refus: vide(x.motifRefus), maj_le: vide(x.majLe), maj_par: auteur(x.majPar),
    }));
    d.frais.forEach((x, i) => l.frais.push({
      id: x.id, dossier_id: d.id, ordre: i, nom: x.nom, nom_ar: ar(x), organisme: x.organisme ?? '', montant: x.montant,
      devise: x.devise, verse: x.verse, verse_le: vide(x.verseLe), verse_par: auteur(x.versePar),
    }));
    d.etapes.forEach((x, i) => l.etapes.push({
      id: x.id, dossier_id: d.id, ordre: i, nom: x.nom, nom_ar: ar(x), frais_requis: x.fraisRequis, faite: x.faite,
      faite_le: vide(x.faiteLe), faite_par: auteur(x.faitePar),
    }));
    d.echeances.forEach((x, i) => l.echeances.push({
      id: x.id, dossier_id: d.id, ordre: i, libelle: x.libelle, moment: x.moment, montant: x.montant, devise: x.devise,
    }));
    for (const x of d.paiements) l.paiements.push({
      id: x.id, dossier_id: d.id, numero_recu: x.numeroRecu, cible_type: x.cible.type, cible_id: x.cible.id,
      montant: x.montant, devise: x.devise, mode: x.mode, date: x.date, par: auteur(x.par),
      annule_le: x.annule?.le ?? null, annule_par: auteur(x.annule?.par), motif_annulation: x.annule?.motif ?? null,
    });
    for (const x of d.journal) l.journal.push({
      id: x.id, dossier_id: d.id, date: x.date, par: auteur(x.par), type: x.type, texte: x.texte, interne: !!x.interne,
    });
  }
  return l;
}

/* ------------------------------------------------------------------ lignes → Base */

export const PARAMETRES_PAR_DEFAUT: ParametresAgence = {
  nom: 'World Destination', telephone: '', whatsapp: '', adresse: '', email: '', joursAlerteExpiration: 60,
};

export function baseVide(): Base {
  return {
    version: 1, utilisateurs: [], clients: [], modeles: [], dossiers: [],
    parametres: { ...PARAMETRES_PAR_DEFAUT }, compteurs: { dossier: 0, recu: 0 },
  };
}

const parOrdre = (a: Ligne, b: Ligne) => num(a.ordre) - num(b.ordre);
const parDate = (a: Ligne, b: Ligne) => String(a.date).localeCompare(String(b.date));

export function versBase(l: Partial<Lignes>, compteurs: { dossier: number; recu: number } = { dossier: 0, recu: 0 }): Base {
  const b = baseVide();
  b.compteurs = { ...compteurs };
  // Seuls l'administrateur et l'agent apparaissent comme « utilisateurs » (comme en démonstration).
  b.utilisateurs = (l.profils ?? [])
    .filter((p) => p.role === 'admin' || p.role === 'agent')
    .map((p): Utilisateur => ({ id: String(p.id), nom: String(p.nom ?? ''), email: String(p.email ?? ''), role: p.role as Utilisateur['role'], actif: !!p.actif }));
  const personnel = new Set(b.utilisateurs.map((u) => u.id));
  /** Auteur d'une action : membre du personnel, sinon « client ». */
  const qui = (v: unknown) => (v ? (personnel.has(String(v)) ? String(v) : 'client') : undefined);

  const p = (l.parametres ?? [])[0];
  if (p) {
    b.parametres = {
      nom: String(p.nom ?? ''), telephone: String(p.telephone ?? ''), whatsapp: String(p.whatsapp ?? ''),
      adresse: String(p.adresse ?? ''), email: String(p.email ?? ''), joursAlerteExpiration: num(p.jours_alerte_expiration),
    };
  }
  b.modeles = (l.modeles ?? []).map((m) => avecNomAr<ModeleDossier>({
    id: String(m.id), nom: String(m.nom), couleur: String(m.couleur ?? ''), honoraires: num(m.honoraires),
    deviseHonoraires: m.devise_honoraires as ModeleDossier['deviseHonoraires'],
    documents: (m.documents ?? []) as ModeleDossier['documents'], etapes: (m.etapes ?? []) as ModeleDossier['etapes'],
    frais: (m.frais ?? []) as ModeleDossier['frais'], actif: !!m.actif,
  }, m.nom_ar));
  b.clients = (l.clients ?? []).map((c): Client => {
    const out: Client = {
      id: String(c.id), nom: String(c.nom), prenom: String(c.prenom), telephone: String(c.telephone ?? ''),
      email: String(c.email ?? ''), langue: c.langue === 'ar' ? 'ar' : 'fr', creeLe: String(c.cree_le), creePar: qui(c.cree_par) ?? '',
    };
    if (c.date_naissance) out.dateNaissance = String(c.date_naissance);
    if (c.adresse) out.adresse = String(c.adresse);
    if (c.contact_suivi) out.contactSuivi = c.contact_suivi as Client['contactSuivi'];
    return out;
  });

  // Regroupement des lignes enfants par dossier.
  const groupe = (rows: Ligne[] | undefined, tri: (a: Ligne, b: Ligne) => number) => {
    const m = new Map<string, Ligne[]>();
    for (const r of [...(rows ?? [])].sort(tri)) {
      const k = String(r.dossier_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return (id: string) => m.get(id) ?? [];
  };
  const docs = groupe(l.documents, parOrdre);
  const frais = groupe(l.frais, parOrdre);
  const etapes = groupe(l.etapes, parOrdre);
  const echeances = groupe(l.echeances, parOrdre);
  const paiements = groupe(l.paiements, parDate);
  const journal = groupe(l.journal, parDate);

  b.dossiers = (l.dossiers ?? []).map((d): Dossier => {
    const id = String(d.id);
    const out: Dossier = {
      id, numero: String(d.numero), clientId: String(d.client_id), modeleId: String(d.modele_id ?? ''),
      intitule: String(d.intitule), agentId: String(d.agent_id ?? ''), statut: d.statut as Dossier['statut'],
      ouvertLe: String(d.ouvert_le),
      documents: docs(id).map((x) => {
        const o: DocumentDossier = { id: String(x.id), nom: String(x.nom), statut: x.statut as DocumentDossier['statut'], avecExpiration: !!x.avec_expiration };
        if (x.expiration) o.expiration = String(x.expiration);
        if (x.chemin_fichier) o.fichierId = String(x.chemin_fichier);
        if (x.nom_fichier) o.nomFichier = String(x.nom_fichier);
        if (x.type_fichier) o.typeFichier = String(x.type_fichier);
        if (x.motif_refus) o.motifRefus = String(x.motif_refus);
        if (x.maj_le) o.majLe = String(x.maj_le);
        if (x.maj_par) o.majPar = qui(x.maj_par);
        return avecNomAr(o, x.nom_ar);
      }),
      frais: frais(id).map((x) => {
        const o: FraisDossier = { id: String(x.id), nom: String(x.nom), organisme: String(x.organisme ?? ''), montant: num(x.montant), devise: x.devise as FraisDossier['devise'], verse: !!x.verse };
        if (x.verse_le) o.verseLe = String(x.verse_le);
        if (x.verse_par) o.versePar = qui(x.verse_par);
        return avecNomAr(o, x.nom_ar);
      }),
      etapes: etapes(id).map((x) => {
        const o: EtapeDossier = { id: String(x.id), nom: String(x.nom), fraisRequis: ((x.frais_requis ?? []) as unknown[]).map(String), faite: !!x.faite };
        if (x.faite_le) o.faiteLe = String(x.faite_le);
        if (x.faite_par) o.faitePar = qui(x.faite_par);
        return avecNomAr(o, x.nom_ar);
      }),
      echeances: echeances(id).map((x): Echeance => ({
        id: String(x.id), libelle: String(x.libelle), moment: x.moment as Echeance['moment'], montant: num(x.montant), devise: x.devise as Echeance['devise'],
      })),
      paiements: paiements(id).map((x) => {
        const o: Paiement = {
          id: String(x.id), numeroRecu: String(x.numero_recu), cible: { type: x.cible_type as Paiement['cible']['type'], id: String(x.cible_id) },
          montant: num(x.montant), devise: x.devise as Paiement['devise'], mode: x.mode as Paiement['mode'], date: String(x.date), par: qui(x.par) ?? '',
        };
        if (x.annule_le) o.annule = { le: String(x.annule_le), par: qui(x.annule_par) ?? '', motif: String(x.motif_annulation ?? '') };
        return o;
      }),
      journal: journal(id).map((x): Evenement => ({
        id: String(x.id), date: String(x.date), par: qui(x.par) ?? '', type: x.type as TypeEvenement, texte: String(x.texte), interne: !!x.interne,
      })),
    };
    if (d.rdv_date) out.rdv = { date: String(d.rdv_date), lieu: str(d.rdv_lieu) ?? '' };
    return out;
  }).sort((a, b) => a.ouvertLe.localeCompare(b.ouvertLe));
  return b;
}

/* ------------------------------------------------------------------ paiements résumés (agents) */

/** Préfixe des paiements « résumés » : totaux sans détail, pour les dossiers dont l'agent n'a pas la charge. */
export const PREFIXE_RESUME = 'resume-';

export interface ResumePaiement { dossier_id: string; cible_type: 'echeance' | 'frais'; cible_id: string; devise: string; total: number | string }

/**
 * Un agent ne lit que les paiements de ses dossiers (règle M-1). Pour les autres, le serveur donne seulement
 * le total encaissé par échéance ou frais : on l'ajoute sous forme d'une ligne « résumé » pour que le reste à payer
 * et le blocage des étapes restent justes. Cette ligne n'est jamais renvoyée au serveur.
 */
export function ajouterResumes(b: Base, resumes: ResumePaiement[]): Base {
  for (const r of resumes) {
    const d = b.dossiers.find((x) => x.id === String(r.dossier_id));
    if (!d) continue;
    const visible = d.paiements
      .filter((p) => !p.annule && p.cible.type === r.cible_type && p.cible.id === String(r.cible_id))
      .reduce((s, p) => s + p.montant, 0);
    const manque = Math.round((num(r.total) - visible) * 100) / 100;
    if (manque <= 0) continue;
    d.paiements.unshift({
      id: `${PREFIXE_RESUME}${r.cible_id}`, numeroRecu: '—', cible: { type: r.cible_type, id: String(r.cible_id) },
      montant: manque, devise: r.devise as Paiement['devise'], mode: 'especes', date: d.ouvertLe, par: '',
    });
  }
  return b;
}

/* ------------------------------------------------------------------ différences */

export type Operation =
  | { table: NomTable; action: 'insert'; lignes: Ligne[] }
  | { table: NomTable; action: 'update'; id: string | number; patch: Ligne };

const egal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Opérations à envoyer au serveur pour passer de `avant` à `apres`.
 * Jamais de suppression (l'application n'efface rien). Les compteurs ne sont jamais envoyés.
 */
export function differences(avant: Base, apres: Base): Operation[] {
  const la = versLignes(avant);
  const lb = versLignes(apres);
  const ops: Operation[] = [];
  for (const t of ORDRE_TABLES) {
    const anciens = new Map(la[t].map((r) => [String(r.id), r]));
    const nouveaux: Ligne[] = [];
    for (const r of lb[t]) {
      if (t === 'paiements' && String(r.id).startsWith(PREFIXE_RESUME)) continue; // ligne de résumé locale
      const ancien = anciens.get(String(r.id));
      if (!ancien) {
        if (t === 'journal' && EVENEMENTS_SERVEUR.includes(r.type as TypeEvenement)) continue;
        if (t === 'profils') continue; // un compte se crée dans Supabase Auth, pas ici
        const ligne = { ...r };
        for (const c of COLONNES_SERVEUR_CREATION[t] ?? []) delete ligne[c];
        if (t === 'journal') { delete ligne.par; delete ligne.date; }
        nouveaux.push(ligne);
        continue;
      }
      if (t === 'journal') continue; // le journal est en ajout seul
      const patch: Ligne = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === 'id' || (COLONNES_FIGEES[t] ?? []).includes(k)) continue;
        if (!egal(v, ancien[k])) patch[k] = v ?? null;
      }
      if (Object.keys(patch).length) ops.push({ table: t, action: 'update', id: r.id as string | number, patch });
    }
    if (nouveaux.length) ops.push({ table: t, action: 'insert', lignes: nouveaux });
  }
  return ops;
}
