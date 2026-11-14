/**
 * Tests de la couche d'accès aux données (mode démonstration).
 * L'environnement vitest est Node : pas de localStorage (le store le tolère) ; IndexedDB est simulé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fichiers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fichiers')>()),
  enregistrerFichier: vi.fn(async () => {}),
}));

import {
  annulerPaiement, changerStatut, connexion, creerClient, deconnexion, encaisser, ErreurMetier, getBase, ouvrirDossier,
  refuserDocument, reinitialiserDemo, televerserDocument, televerserParClient, validerEtape,
} from './store';
import { echeanceExigible, fraisBloquants, resteEcheance } from './regles';

const fichier = () => new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' });

function nouveauDossier(modeleId = 'm-campus') {
  const c = creerClient({ prenom: 'Test', nom: 'Store', telephone: '213550999999', email: '', langue: 'fr' });
  const d = ouvrirDossier(c.id, modeleId, 'u-agent1');
  return getBase().dossiers.find((x) => x.id === d.id)!;
}
const relire = (id: string) => getBase().dossiers.find((x) => x.id === id)!;

beforeEach(() => {
  reinitialiserDemo();
  connexion('u-agent1');
});

describe('session', () => {
  it('refuse toute écriture sans utilisateur connecté', () => {
    deconnexion();
    expect(() => creerClient({ prenom: 'A', nom: 'B', telephone: '213550000123', email: '', langue: 'fr' })).toThrow();
  });
});

describe('dossiers', () => {
  it('ouvre un dossier numéroté avec check-list, étapes, échéances 50/50 et journal', () => {
    const avant = getBase().compteurs.dossier;
    const d = nouveauDossier();
    expect(d.numero).toMatch(new RegExp(`^WD-\\d{4}-${String(avant + 1).padStart(4, '0')}$`));
    expect(d.documents.length).toBeGreaterThan(0);
    expect(d.etapes.length).toBeGreaterThan(0);
    expect(d.echeances).toHaveLength(2);
    expect(d.echeances[0].montant + d.echeances[1].montant).toBe(getBase().modeles.find((m) => m.id === 'm-campus')!.honoraires);
    expect(d.journal[0].par).toBe('u-agent1');
  });
  it('la 2e tranche devient exigible à la clôture', () => {
    const d = nouveauDossier();
    expect(echeanceExigible(d, 'fin')).toBe(false);
    changerStatut(d.id, 'termine');
    expect(echeanceExigible(relire(d.id), 'fin')).toBe(true);
  });
});

describe('documents', () => {
  it('un document téléversé par l’agent est validé, un envoi client est « envoyé »', async () => {
    const d = nouveauDossier();
    await televerserDocument(d.id, d.documents[0].id, fichier());
    await televerserParClient(d.id, d.documents[1].id, fichier());
    const r = relire(d.id);
    expect(r.documents[0].statut).toBe('valide');
    expect(r.documents[0].majPar).toBe('u-agent1');
    expect(r.documents[1].statut).toBe('envoye');
    expect(r.documents[1].majPar).toBe('client');
  });
  it('un refus garde le motif', () => {
    const d = nouveauDossier();
    refuserDocument(d.id, d.documents[0].id, 'Photo floue');
    expect(relire(d.id).documents[0]).toMatchObject({ statut: 'refuse', motifRefus: 'Photo floue' });
  });
  it('un refus sans motif est refusé par la couche de données (pas seulement par l’écran)', () => {
    const d = nouveauDossier();
    expect(() => refuserDocument(d.id, d.documents[0].id, '   ')).toThrow(ErreurMetier);
  });
});

describe('paiements', () => {
  it('refuse un montant nul ou supérieur au reste, sans consommer de numéro de reçu', () => {
    const d = nouveauDossier();
    const e = d.echeances[0];
    const compteur = getBase().compteurs.recu;
    expect(() => encaisser(d.id, { type: 'echeance', id: e.id }, 0, 'especes')).toThrow(ErreurMetier);
    expect(() => encaisser(d.id, { type: 'echeance', id: e.id }, e.montant + 1, 'especes')).toThrow(ErreurMetier);
    expect(getBase().compteurs.recu).toBe(compteur);
    expect(relire(d.id).paiements).toHaveLength(0);
  });
  it('numérote les reçus à la suite et met à jour le reste', () => {
    const d = nouveauDossier();
    const e = d.echeances[0];
    const p1 = encaisser(d.id, { type: 'echeance', id: e.id }, 1000, 'especes');
    const p2 = encaisser(d.id, { type: 'echeance', id: e.id }, 2000, 'ccp');
    const n = (s: string) => Number(s.split('-').pop());
    expect(n(p2.numeroRecu)).toBe(n(p1.numeroRecu) + 1);
    expect(resteEcheance(relire(d.id), e.id)).toBe(e.montant - 3000);
    expect(p1.par).toBe('u-agent1');
  });
  it('un agent ne peut pas annuler un paiement', () => {
    const d = nouveauDossier();
    const p = encaisser(d.id, { type: 'echeance', id: d.echeances[0].id }, 1000, 'especes');
    expect(() => annulerPaiement(d.id, p.id, 'erreur')).toThrow(/administrateur/);
    expect(relire(d.id).paiements[0].annule).toBeUndefined();
  });
  it('un admin annule avec motif obligatoire ; le paiement reste et ne compte plus', () => {
    const d = nouveauDossier();
    const e = d.echeances[0];
    const p = encaisser(d.id, { type: 'echeance', id: e.id }, 1000, 'especes');
    connexion('u-admin1');
    expect(() => annulerPaiement(d.id, p.id, ' ')).toThrow(/motif/);
    annulerPaiement(d.id, p.id, 'Erreur de saisie');
    const r = relire(d.id);
    expect(r.paiements).toHaveLength(1);
    expect(r.paiements[0].annule).toMatchObject({ par: 'u-admin1', motif: 'Erreur de saisie' });
    expect(resteEcheance(r, e.id)).toBe(e.montant);
    expect(r.journal.at(-1)!.texte).toContain('annulé');
  });
});

describe('étapes', () => {
  it('bloque une étape tant que ses frais ne sont pas encaissés à 100 %', () => {
    const d = nouveauDossier();
    const etape = d.etapes.find((e) => e.fraisRequis.length === 1)!;
    const f = d.frais.find((x) => x.id === etape.fraisRequis[0])!;
    expect(() => validerEtape(d.id, etape.id)).toThrow(/bloquée/);
    encaisser(d.id, { type: 'frais', id: f.id }, f.montant - 1, 'especes');
    expect(() => validerEtape(d.id, etape.id)).toThrow(/bloquée/);
    encaisser(d.id, { type: 'frais', id: f.id }, 1, 'especes');
    expect(fraisBloquants(relire(d.id), etape)).toHaveLength(0);
    validerEtape(d.id, etape.id);
    expect(relire(d.id).etapes.find((e) => e.id === etape.id)!.faite).toBe(true);
  });
  it('rend la 2e tranche exigible quand toutes les étapes sont faites', () => {
    const d = nouveauDossier('m-schengen');
    for (const f of d.frais) encaisser(d.id, { type: 'frais', id: f.id }, f.montant, 'especes');
    for (const e of d.etapes) validerEtape(d.id, e.id);
    expect(echeanceExigible(relire(d.id), 'fin')).toBe(true);
  });
});

describe('données de démonstration', () => {
  it('un dossier de démo garde le même identifiant après rechargement (liens, QR codes)', async () => {
    const memoire = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memoire.get(k) ?? null,
      setItem: (k: string, v: string) => { memoire.set(k, v); },
      removeItem: (k: string) => { memoire.delete(k); },
      clear: () => memoire.clear(),
    });
    try {
      vi.resetModules();
      const premier = await import('./store');
      const ids1 = premier.getBase().dossiers.map((d) => d.id);
      vi.resetModules(); // = rechargement de la page, sans aucune modification entre-temps
      const second = await import('./store');
      expect(second.getBase().dossiers.map((d) => d.id)).toEqual(ids1);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
