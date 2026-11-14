import type {
  Base, Client, Devise, Dossier, EtapeDossier, Evenement, FraisDossier, ModeleDossier, Paiement, TypeEvenement,
} from './types';

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export const maintenant = () => new Date().toISOString();

export function evenement(par: string, type: TypeEvenement, texte: string, interne = false): Evenement {
  return { id: uid(), date: maintenant(), par, type, texte, interne };
}

export function numeroDossier(compteur: number, date = new Date()) {
  return `WD-${date.getFullYear()}-${String(compteur).padStart(4, '0')}`;
}

export function numeroRecu(compteur: number, date = new Date()) {
  return `R-${date.getFullYear()}-${String(compteur).padStart(5, '0')}`;
}

/** Crée un dossier à partir d'un modèle : check-list, étapes, échéances 50/50 et frais. */
export function creerDossier(
  modele: ModeleDossier, client: Client, agentId: string, numero: string, intitule?: string,
): Dossier {
  const moitie = Math.round(modele.honoraires / 2);
  const dossier: Dossier = {
    id: uid(),
    numero,
    clientId: client.id,
    modeleId: modele.id,
    intitule: intitule?.trim() || modele.nom,
    agentId,
    statut: 'en_cours',
    ouvertLe: maintenant(),
    documents: modele.documents.map((d) => ({
      id: uid(), nom: d.nom, statut: 'manquant', avecExpiration: d.avecExpiration,
    })),
    frais: modele.frais.map((f) => ({
      id: uid(), nom: f.nom, organisme: f.organisme, montant: f.montant, devise: f.devise, verse: false,
    })),
    etapes: [],
    echeances: [
      { id: uid(), libelle: 'Honoraires – 50 % au dépôt du dossier', moment: 'depot', montant: moitie, devise: modele.deviseHonoraires },
      { id: uid(), libelle: 'Honoraires – 50 % à la fin de la procédure', moment: 'fin', montant: modele.honoraires - moitie, devise: modele.deviseHonoraires },
    ],
    paiements: [],
    journal: [evenement(agentId, 'creation', `Dossier ouvert (${modele.nom})`)],
  };
  // Les étapes référencent les frais du modèle : on traduit vers les identifiants du dossier.
  const correspondance = new Map(modele.frais.map((f, i) => [f.id, dossier.frais[i].id]));
  dossier.etapes = modele.etapes.map((e) => ({
    id: uid(), nom: e.nom, faite: false,
    fraisRequis: e.fraisRequis.map((id) => correspondance.get(id)).filter((x): x is string => !!x),
  }));
  return dossier;
}

/* ---------------- Paiements ---------------- */

export const paiementsValides = (d: Dossier) => d.paiements.filter((p) => !p.annule);

export function totalPaye(d: Dossier, type: Paiement['cible']['type'], id: string) {
  return paiementsValides(d)
    .filter((p) => p.cible.type === type && p.cible.id === id)
    .reduce((s, p) => s + p.montant, 0);
}

export function resteFrais(d: Dossier, f: FraisDossier) {
  return Math.max(0, f.montant - totalPaye(d, 'frais', f.id));
}

export function resteEcheance(d: Dossier, echeanceId: string) {
  const e = d.echeances.find((x) => x.id === echeanceId);
  if (!e) return 0;
  return Math.max(0, e.montant - totalPaye(d, 'echeance', e.id));
}

export function etapesToutesFaites(d: Dossier) {
  return d.etapes.length > 0 && d.etapes.every((e) => e.faite);
}

/** Une échéance est exigible : « dépôt » dès l'ouverture, « fin » quand la procédure est terminée. */
export function echeanceExigible(d: Dossier, moment: 'depot' | 'fin') {
  if (d.statut === 'annule') return false;
  return moment === 'depot' || d.statut === 'termine' || etapesToutesFaites(d);
}

export type Soldes = Partial<Record<Devise, { du: number; paye: number; reste: number }>>;

function ajouter(s: Soldes, devise: Devise, du: number, paye: number) {
  const cur = s[devise] ?? { du: 0, paye: 0, reste: 0 };
  cur.du += du;
  cur.paye += paye;
  cur.reste += Math.max(0, du - paye);
  s[devise] = cur;
}

/** Ce que le client doit à l'agence (honoraires + frais de procédure), par devise. */
export function soldes(d: Dossier): Soldes {
  const s: Soldes = {};
  for (const e of d.echeances) ajouter(s, e.devise, e.montant, totalPaye(d, 'echeance', e.id));
  for (const f of d.frais) ajouter(s, f.devise, f.montant, totalPaye(d, 'frais', f.id));
  return s;
}

/** Montants exigibles non encaissés (échéances exigibles + tous les frais, payables d'avance). */
export function impayesExigibles(d: Dossier): { libelle: string; reste: number; devise: Devise }[] {
  if (d.statut === 'annule') return [];
  const out: { libelle: string; reste: number; devise: Devise }[] = [];
  for (const e of d.echeances) {
    const r = resteEcheance(d, e.id);
    if (r > 0 && echeanceExigible(d, e.moment)) out.push({ libelle: e.libelle, reste: r, devise: e.devise });
  }
  for (const f of d.frais) {
    const r = resteFrais(d, f);
    if (r > 0) out.push({ libelle: f.nom, reste: r, devise: f.devise });
  }
  return out;
}

/* ---------------- Étapes ---------------- */

/** Frais qui bloquent une étape (non encaissés à 100 %). */
export function fraisBloquants(d: Dossier, etape: EtapeDossier): FraisDossier[] {
  return etape.fraisRequis
    .map((id) => d.frais.find((f) => f.id === id))
    .filter((f): f is FraisDossier => !!f && resteFrais(d, f) > 0);
}

export function progression(d: Dossier) {
  const faites = d.etapes.filter((e) => e.faite).length;
  const courante = d.etapes.find((e) => !e.faite);
  return { faites, total: d.etapes.length, courante, pourcent: d.etapes.length ? Math.round((faites / d.etapes.length) * 100) : 0 };
}

/* ---------------- Documents ---------------- */

export function compteDocuments(d: Dossier) {
  const c = { manquant: 0, envoye: 0, valide: 0, refuse: 0 };
  for (const doc of d.documents) c[doc.statut]++;
  return c;
}

export function joursAvant(dateIso: string, ref = new Date()) {
  const a = new Date(dateIso + (dateIso.length === 10 ? 'T00:00:00' : ''));
  const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((a.getTime() - r.getTime()) / 86400000);
}

/* ---------------- Tableau de bord ---------------- */

export function alertes(base: Base, ref = new Date()) {
  const ouverts = base.dossiers.filter((d) => d.statut === 'en_cours');
  const aVerifier = ouverts.flatMap((d) => d.documents.filter((x) => x.statut === 'envoye').map((doc) => ({ d, doc })));
  const expirations = ouverts.flatMap((d) =>
    d.documents
      .filter((x) => x.expiration && x.statut !== 'manquant' && joursAvant(x.expiration, ref) <= base.parametres.joursAlerteExpiration)
      .map((doc) => ({ d, doc, jours: joursAvant(doc.expiration!, ref) })),
  ).sort((a, b) => a.jours - b.jours);
  const impayes = base.dossiers
    .map((d) => ({ d, lignes: impayesExigibles(d) }))
    .filter((x) => x.lignes.length > 0);
  const fraisAVerser = ouverts.flatMap((d) =>
    d.frais.filter((f) => !f.verse && resteFrais(d, f) === 0).map((f) => ({ d, f })),
  );
  const rdv = ouverts
    .filter((d) => d.rdv && joursAvant(d.rdv.date.slice(0, 10), ref) >= 0)
    .sort((a, b) => a.rdv!.date.localeCompare(b.rdv!.date));
  return { ouverts, aVerifier, expirations, impayes, fraisAVerser, rdv };
}

/* ---------------- Format ---------------- */

export function montant(v: number, devise: Devise) {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
  return devise === 'DZD' ? `${n} DA` : `${n} ${devise === 'EUR' ? '€' : '$ CA'}`;
}

export function formatSoldes(s: Soldes, cle: 'du' | 'paye' | 'reste') {
  const parts = (Object.keys(s) as Devise[]).filter((k) => s[k]![cle] > 0).map((k) => montant(s[k]![cle], k));
  return parts.length ? parts.join(' + ') : '0';
}

export function date(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const nomClient = (c?: Client) => (c ? `${c.prenom} ${c.nom.toUpperCase()}` : '—');
