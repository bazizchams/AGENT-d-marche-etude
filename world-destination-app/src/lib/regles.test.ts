import { describe, expect, it } from 'vitest';
import { MODELES_INITIAUX } from './modeles';
import {
  creerDossier, echeanceExigible, fraisBloquants, impayesExigibles, progression, resteEcheance, resteFrais, soldes,
} from './regles';
import type { Client, Dossier, Paiement } from './types';

const client: Client = { id: 'c1', nom: 'Test', prenom: 'Client', telephone: '213550000000', email: '', langue: 'fr', creeLe: '', creePar: 'u' };
const campus = MODELES_INITIAUX.find((m) => m.id === 'm-campus')!;
const payer = (d: Dossier, cible: Paiement['cible'], montant: number, annule = false) =>
  d.paiements.push({ id: String(d.paiements.length), numeroRecu: 'R', cible, montant, devise: 'DZD', mode: 'especes', date: '', par: 'u', ...(annule ? { annule: { le: '', par: 'u', motif: 'x' } } : {}) });

describe('création de dossier', () => {
  it('génère check-list, étapes, frais et deux échéances 50/50', () => {
    const d = creerDossier(campus, client, 'u', 'WD-2026-0001');
    expect(d.documents).toHaveLength(campus.documents.length);
    expect(d.documents.every((x) => x.statut === 'manquant')).toBe(true);
    expect(d.etapes).toHaveLength(campus.etapes.length);
    expect(d.echeances.map((e) => e.montant)).toEqual([60000, 60000]);
    expect(d.echeances.map((e) => e.moment)).toEqual(['depot', 'fin']);
  });
  it('arrondit correctement des honoraires impairs', () => {
    const d = creerDossier({ ...campus, honoraires: 25001 }, client, 'u', 'X');
    expect(d.echeances[0].montant + d.echeances[1].montant).toBe(25001);
  });
  it('relie les frais requis des étapes aux frais du dossier', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    const etape = d.etapes.find((e) => e.nom.startsWith('Paiement des frais Campus'))!;
    expect(etape.fraisRequis).toHaveLength(1);
    expect(d.frais.find((f) => f.id === etape.fraisRequis[0])!.nom).toBe('Frais de dossier Campus France');
  });
});

describe('paiements', () => {
  it('calcule le reste et ignore les paiements annulés', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    const e = d.echeances[0];
    payer(d, { type: 'echeance', id: e.id }, 20000);
    payer(d, { type: 'echeance', id: e.id }, 30000, true);
    expect(resteEcheance(d, e.id)).toBe(40000);
  });
  it('la 2e tranche n’est exigible qu’à la fin de la procédure', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    expect(echeanceExigible(d, 'depot')).toBe(true);
    expect(echeanceExigible(d, 'fin')).toBe(false);
    d.etapes.forEach((e) => { e.faite = true; });
    expect(echeanceExigible(d, 'fin')).toBe(true);
  });
  it('liste les impayés exigibles : 1re tranche + tous les frais', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    expect(impayesExigibles(d)).toHaveLength(1 + campus.frais.length);
    d.statut = 'annule';
    expect(impayesExigibles(d)).toHaveLength(0);
  });
  it('regroupe les soldes par devise', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    const s = soldes(d);
    expect(s.EUR!.du).toBe(50);
    expect(s.DZD!.du).toBe(campus.honoraires + campus.frais.filter((f) => f.devise === 'DZD').reduce((t, f) => t + f.montant, 0));
  });
});

describe('étapes', () => {
  it('bloque une étape tant que ses frais ne sont pas payés à 100 %', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    const etape = d.etapes.find((e) => e.fraisRequis.length === 1)!;
    const f = d.frais.find((x) => x.id === etape.fraisRequis[0])!;
    expect(fraisBloquants(d, etape)).toHaveLength(1);
    payer(d, { type: 'frais', id: f.id }, f.montant - 1);
    expect(fraisBloquants(d, etape)).toHaveLength(1);
    payer(d, { type: 'frais', id: f.id }, 1);
    expect(resteFrais(d, f)).toBe(0);
    expect(fraisBloquants(d, etape)).toHaveLength(0);
  });
  it('calcule la progression et l’étape courante', () => {
    const d = creerDossier(campus, client, 'u', 'X');
    d.etapes[0].faite = true;
    const p = progression(d);
    expect(p.faites).toBe(1);
    expect(p.courante?.id).toBe(d.etapes[1].id);
  });
});
