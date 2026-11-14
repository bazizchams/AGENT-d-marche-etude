/** Données FICTIVES de démonstration. Aucune personne réelle. */
import { MODELES_INITIAUX } from './modeles';
import { creerDossier, evenement, montant as fmt, numeroDossier, numeroRecu, uid } from './regles';
import type { Base, Client, Dossier, Paiement } from './types';

const jour = (delta: number) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString();
};
const jourCourt = (delta: number) => jour(delta).slice(0, 10);

export function donneesDemo(): Base {
  const utilisateurs = [
    { id: 'u-admin1', nom: 'Administrateur 1', email: 'admin1@worlddestination.dz', role: 'admin' as const, actif: true },
    { id: 'u-admin2', nom: 'Administrateur 2', email: 'admin2@worlddestination.dz', role: 'admin' as const, actif: true },
    { id: 'u-agent1', nom: 'Agent Sara', email: 'sara@worlddestination.dz', role: 'agent' as const, actif: true },
    { id: 'u-agent2', nom: 'Agent Karim', email: 'karim@worlddestination.dz', role: 'agent' as const, actif: true },
  ];

  const mk = (prenom: string, nom: string, tel: string, langue: 'fr' | 'ar', creeLe: number): Client => ({
    id: uid(), prenom, nom, telephone: tel, email: `${prenom.toLowerCase()}.${nom.toLowerCase()}@exemple.com`,
    langue, creeLe: jour(creeLe), creePar: 'u-agent1',
  });
  const clients = [
    mk('Yacine', 'Benali', '213550000001', 'fr', -60),
    mk('Amina', 'Haddad', '213660000002', 'ar', -45),
    mk('Rayan', 'Meziane', '213770000003', 'fr', -30),
    mk('Lina', 'Boudiaf', '213550000004', 'fr', -12),
    mk('Sofiane', 'Kaci', '213660000005', 'ar', -5),
  ];
  clients[1].contactSuivi = { nom: 'Mère : Fatima Haddad', telephone: '213660000099', email: '' };

  let nDossier = 0;
  let nRecu = 0;
  const modele = (id: string) => MODELES_INITIAUX.find((m) => m.id === id)!;
  const ouvrir = (c: Client, m: string, agent: string, ilYa: number) => {
    const d = creerDossier(modele(m), c, agent, numeroDossier(++nDossier));
    d.ouvertLe = jour(ilYa);
    d.journal[0].date = jour(ilYa);
    return d;
  };
  const payer = (d: Dossier, cible: Paiement['cible'], montant: number, ilYa: number, par = 'u-agent1') => {
    const devise = cible.type === 'echeance'
      ? d.echeances.find((e) => e.id === cible.id)!.devise
      : d.frais.find((f) => f.id === cible.id)!.devise;
    const p: Paiement = { id: uid(), numeroRecu: numeroRecu(++nRecu), cible, montant, devise, mode: 'especes', date: jour(ilYa), par };
    d.paiements.push(p);
    d.journal.push({ ...evenement(par, 'paiement', `Encaissement ${fmt(montant, devise)} (reçu ${p.numeroRecu})`), date: jour(ilYa) });
  };
  const valider = (d: Dossier, n: number, ilYa: number, par = 'u-agent1') => {
    d.documents.slice(0, n).forEach((doc) => {
      doc.statut = 'valide'; doc.majLe = jour(ilYa); doc.majPar = par; doc.nomFichier = `${doc.nom}.pdf`;
    });
  };
  const etapes = (d: Dossier, n: number, ilYa: number, par = 'u-agent1') => {
    d.etapes.slice(0, n).forEach((e, i) => {
      e.faite = true; e.faiteLe = jour(ilYa + i); e.faitePar = par;
      d.journal.push({ ...evenement(par, 'etape', `Étape terminée : ${e.nom}`), date: jour(ilYa + i) });
    });
  };

  // 1. Yacine – Ausbildung bien avancé, 1er acompte payé
  const d1 = ouvrir(clients[0], 'm-ausbildung', 'u-agent1', -60);
  payer(d1, { type: 'echeance', id: d1.echeances[0].id }, d1.echeances[0].montant, -60);
  payer(d1, { type: 'frais', id: d1.frais[0].id }, d1.frais[0].montant, -55);
  d1.frais[0].verse = true;
  valider(d1, 8, -50);
  d1.documents[0].expiration = jourCourt(20); // passeport qui expire bientôt
  etapes(d1, 7, -50); // jusqu'au contrat d'Ausbildung signé
  d1.rdv = { date: jour(9).slice(0, 16), lieu: "Ambassade d'Allemagne / VFS Global Alger" };

  // 2. Amina – Campus France, un document envoyé par le client à vérifier, un refusé
  const d2 = ouvrir(clients[1], 'm-campus', 'u-agent2', -45);
  payer(d2, { type: 'echeance', id: d2.echeances[0].id }, d2.echeances[0].montant, -45, 'u-agent2');
  payer(d2, { type: 'frais', id: d2.frais[1].id }, d2.frais[1].montant, -44, 'u-agent2');
  valider(d2, 5, -40, 'u-agent2');
  d2.documents[5].expiration = jourCourt(400);
  d2.documents[6].statut = 'envoye'; d2.documents[6].nomFichier = 'cv_amina.pdf'; d2.documents[6].majLe = jour(-1);
  d2.documents[7].statut = 'refuse'; d2.documents[7].motifRefus = 'Lettre non signée'; d2.documents[7].majLe = jour(-3);
  etapes(d2, 4, -40, 'u-agent2');

  // 3. Rayan – Schengen, acompte partiel, frais visa non payés (étape bloquée)
  const d3 = ouvrir(clients[2], 'm-schengen', 'u-agent1', -30);
  payer(d3, { type: 'echeance', id: d3.echeances[0].id }, 5000, -30);
  valider(d3, 6, -25);
  d3.documents[0].expiration = jourCourt(700);
  d3.documents[2].expiration = jourCourt(10);
  etapes(d3, 3, -25);

  // 4. Lina – Italie, dossier récent, rien payé
  const d4 = ouvrir(clients[3], 'm-italie', 'u-agent2', -12);
  valider(d4, 2, -10, 'u-agent2');
  etapes(d4, 1, -10, 'u-agent2');

  // 5. Sofiane – Canada, terminé côté étapes : 2e échéance exigible
  const d5 = ouvrir(clients[4], 'm-canada', 'u-agent1', -5);
  d5.ouvertLe = jour(-400);
  payer(d5, { type: 'echeance', id: d5.echeances[0].id }, d5.echeances[0].montant, -400);
  d5.frais.forEach((f) => { payer(d5, { type: 'frais', id: f.id }, f.montant, -380); f.verse = true; });
  valider(d5, d5.documents.length, -380);
  etapes(d5, d5.etapes.length, -380);

  return {
    version: 1,
    utilisateurs,
    clients,
    modeles: structuredClone(MODELES_INITIAUX),
    dossiers: [d1, d2, d3, d4, d5],
    parametres: {
      nom: 'World Destination',
      telephone: '',
      whatsapp: '',
      adresse: '',
      email: '',
      joursAlerteExpiration: 60,
    },
    compteurs: { dossier: nDossier, recu: nRecu },
  };
}
