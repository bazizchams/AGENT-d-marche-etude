import { describe, expect, it } from 'vitest';
import { donneesDemo } from '../demo';
import { creerDossier, evenement } from '../regles';
import type { Base } from '../types';
import { differences, versBase, versLignes } from './correspondance';

const modifier = (b: Base, fn: (c: Base) => void) => { const c = structuredClone(b); fn(c); return c; };

describe('correspondance Base ⇄ tables Supabase', () => {
  const base = donneesDemo();

  it('aller-retour sans perte : relire ce qu’on écrit ne produit aucune différence', () => {
    const relue = versBase(versLignes(base), base.compteurs);
    expect(differences(base, relue)).toEqual([]);
    expect(relue.dossiers).toHaveLength(base.dossiers.length);
    expect(relue.utilisateurs).toEqual(base.utilisateurs);
  });

  it('aucune opération si rien ne change', () => {
    expect(differences(base, structuredClone(base))).toEqual([]);
  });

  it('nouveau dossier : parent puis enfants, sans la ligne de journal « création » (écrite par le serveur)', () => {
    const apres = modifier(base, (b) => {
      b.dossiers.push(creerDossier(b.modeles[1], b.clients[0], 'u-agent1', 'WD-2026-0099'));
    });
    const ops = differences(base, apres);
    expect(ops.map((o) => `${o.action}:${o.table}`)).toEqual(['insert:dossiers', 'insert:documents', 'insert:frais', 'insert:etapes', 'insert:echeances']);
  });

  it('encaissement : insertion du paiement seule ; annulation : mise à jour des seuls champs d’annulation', () => {
    const d0 = base.dossiers[0];
    const apres = modifier(base, (b) => {
      const d = b.dossiers[0];
      d.paiements.push({ id: 'p-test', numeroRecu: 'R-2026-00099', cible: { type: 'frais', id: d.frais[0].id }, montant: 10, devise: d.frais[0].devise, mode: 'especes', date: new Date().toISOString(), par: 'u-agent1' });
      d.journal.push(evenement('u-agent1', 'paiement', 'Encaissement…'));
    });
    const ops = differences(base, apres);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ table: 'paiements', action: 'insert' });
    const ligne = (ops[0] as { lignes: Record<string, unknown>[] }).lignes[0];
    expect(ligne).not.toHaveProperty('annule_le');
    expect(ligne.dossier_id).toBe(d0.id);

    const annule = modifier(apres, (b) => {
      b.dossiers[0].paiements.find((p) => p.id === 'p-test')!.annule = { le: new Date().toISOString(), par: 'u-admin1', motif: 'Erreur' };
    });
    const ops2 = differences(apres, annule);
    expect(ops2).toHaveLength(1);
    expect(ops2[0]).toMatchObject({ table: 'paiements', action: 'update', id: 'p-test' });
    expect(Object.keys((ops2[0] as { patch: object }).patch).sort()).toEqual(['annule_le', 'annule_par', 'motif_annulation']);
  });

  it('note : envoyée au journal (ajout seul), sans auteur ni date (fixés par le serveur)', () => {
    const apres = modifier(base, (b) => { b.dossiers[0].journal.push(evenement('u-agent1', 'note', 'Appel du client', true)); });
    const ops = differences(base, apres);
    expect(ops).toHaveLength(1);
    const l = (ops[0] as { lignes: Record<string, unknown>[] }).lignes[0];
    expect(l).toMatchObject({ type: 'note', texte: 'Appel du client', interne: true });
    expect(l).not.toHaveProperty('par');
  });

  it('envoi par le client : seuls les champs du fichier changent, auteur « client » non transmis', () => {
    const d = base.dossiers.find((x) => x.documents.some((doc) => doc.statut === 'manquant'))!;
    const doc = d.documents.find((x) => x.statut === 'manquant')!;
    const apres = modifier(base, (b) => {
      const cible = b.dossiers.find((x) => x.id === d.id)!.documents.find((x) => x.id === doc.id)!;
      Object.assign(cible, { statut: 'envoye', fichierId: `${d.id}/f.pdf`, nomFichier: 'f.pdf', typeFichier: 'application/pdf', majLe: new Date().toISOString(), majPar: 'client' });
    });
    const ops = differences(base, apres);
    expect(ops).toEqual([{ table: 'documents', action: 'update', id: doc.id, patch: { statut: 'envoye', chemin_fichier: `${d.id}/f.pdf`, nom_fichier: 'f.pdf', type_fichier: 'application/pdf' } }]);
  });

  it('libellés arabes (nomAr) conservés dans les modèles et les documents', () => {
    const apres = modifier(base, (b) => { Object.assign(b.dossiers[0].documents[0], { nomAr: 'جواز السفر' }); });
    const ops = differences(base, apres);
    expect(ops[0]).toMatchObject({ table: 'documents', action: 'update', patch: { nom_ar: 'جواز السفر' } });
    const relue = versBase(versLignes(apres));
    expect((relue.dossiers.find((x) => x.id === apres.dossiers[0].id)!.documents[0] as { nomAr?: string }).nomAr).toBe('جواز السفر');
  });
});
