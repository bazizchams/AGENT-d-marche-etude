/** Création d'un client et de son dossier ; détection des doublons de téléphone. */
const {
  assert, url, re, reMontant, connexion, creerClient, onglet, ligne, visible, toast,
} = require('./lib.cjs');

module.exports = [
  {
    nom: 'Création client + dossier : check-list, étapes et 2 échéances 50/50',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await page.getByRole('link', { name: /Nouveau client/ }).first().click();
      await page.getByRole('dialog', { name: 'Nouveau client' }).waitFor();
      const id = await creerClient(page, {
        prenom: 'Nadia', nom: 'Testeur', telephone: '0551 23 45 67', email: 'nadia@exemple.com', type: 'Campus France',
      });
      assert.ok(id, 'la création doit ouvrir la page du dossier');
      await visible(toast(page, 'Client créé'), 'le message « Client créé » doit s’afficher');
      await visible(page.getByRole('heading', { name: /Campus France/ }), 'le titre du dossier doit reprendre le type');

      // Check-list : tous les documents à l'état « Manquant »
      const tabDocs = await page.getByRole('tab', { name: /^Documents/ }).textContent();
      const [, valides, totalDocs] = tabDocs.match(/\((\d+)\/(\d+)\)/).map(Number);
      assert.equal(valides, 0, 'aucun document validé à la création');
      assert.ok(totalDocs >= 5, `check-list générée (${totalDocs} documents)`);
      const manquants = page.getByRole('table').getByRole('row').filter({ hasText: 'Manquant' });
      assert.equal(await manquants.count(), totalDocs, 'chaque document de la check-list est « Manquant »');

      // Étapes
      const tabEtapes = await page.getByRole('tab', { name: /^Étapes/ }).textContent();
      const [, faites, totalEtapes] = tabEtapes.match(/\((\d+)\/(\d+)\)/).map(Number);
      assert.equal(faites, 0);
      assert.ok(totalEtapes >= 3, `étapes générées (${totalEtapes})`);
      await onglet(page, 'Étapes');
      assert.equal(await page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /Marquer comme faite|Frais non encaissés/ }) }).count(), totalEtapes,
        'une ligne par étape, chacune avec son action');

      // Échéances 50/50
      await onglet(page, 'Paiements');
      const depot = ligne(page, /50 % au dépôt/);
      const fin = ligne(page, /50 % à la fin/);
      assert.equal(await depot.count(), 1, 'échéance « 50 % au dépôt » générée');
      assert.equal(await fin.count(), 1, 'échéance « 50 % à la fin » générée');
      const montantDe = async (l) => (await l.getByRole('cell').nth(1).textContent()).trim();
      assert.match(await montantDe(depot), reMontant(60000), 'Campus France : 120 000 DA → 60 000 DA au dépôt');
      assert.equal(await montantDe(depot), await montantDe(fin), 'les deux échéances sont égales');
      await visible(depot.getByText('À encaisser'), '1re échéance exigible immédiatement');
      await visible(fin.getByText('À la fin de la procédure'), '2e échéance non exigible à la création');

      // Journal + fiche client
      await onglet(page, 'Journal');
      await visible(page.getByText(/Dossier ouvert \(Campus France\)/), 'le journal trace l’ouverture du dossier');
      await page.getByRole('link', { name: /Nadia TESTEUR/ }).first().click();
      await visible(page.getByText('+213551234567'), 'le téléphone est normalisé au format international');
    },
  },
  {
    nom: 'Création : champs obligatoires et format de téléphone',
    async run({ page }) {
      await connexion(page, 'Agent Karim');
      await page.goto(url('/clients?nouveau=1'));
      const dlg = page.getByRole('dialog', { name: 'Nouveau client' });
      await dlg.getByRole('button', { name: /^Créer le client/ }).click();
      await visible(dlg.getByText('Saisissez le prénom.'), 'erreur prénom');
      await visible(dlg.getByText('Saisissez le nom.'), 'erreur nom');
      await visible(dlg.getByText(/Saisissez un numéro complet/), 'erreur téléphone');
      await dlg.getByLabel(/^E-mail/).fill('pas-un-email');
      await dlg.getByLabel(/^E-mail/).blur();
      await visible(dlg.getByText(/Vérifiez l'adresse e-mail/), 'erreur e-mail');
      assert.ok(page.url().includes('nouveau=1'), 'le formulaire reste ouvert');
    },
  },
  {
    nom: 'Doublon de téléphone détecté (client de démo et client créé)',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      // Client de démonstration : Yacine BENALI, 213550000001
      await page.goto(url('/clients?nouveau=1'));
      let dlg = page.getByRole('dialog', { name: 'Nouveau client' });
      await dlg.getByLabel(/^Téléphone/).fill('0550 00 00 01');
      await visible(dlg.getByText(/existe déjà/), 'alerte doublon pour un numéro saisi au format local');
      await visible(dlg.getByRole('link', { name: /Yacine BENALI/ }), 'le doublon renvoie vers la fiche existante');
      await dlg.getByLabel(/^Téléphone/).fill('+213 550 00 00 01');
      await visible(dlg.getByText(/existe déjà/), 'alerte doublon pour un numéro au format international');
      await dlg.getByLabel(/^Téléphone/).fill('0550 99 88 77');
      assert.equal(await dlg.getByText(/existe déjà/).count(), 0, 'pas d’alerte pour un numéro nouveau');
      await dlg.getByRole('button', { name: 'Annuler' }).click();

      await creerClient(page, { prenom: 'Omar', nom: 'Doublon', telephone: '0770 11 22 33', type: '' });
      await page.goto(url('/clients?nouveau=1'));
      dlg = page.getByRole('dialog', { name: 'Nouveau client' });
      await dlg.getByLabel(/^Téléphone/).fill('213770112233');
      await visible(dlg.getByRole('link', { name: /Omar DOUBLON/ }), 'doublon détecté sur un client créé dans la session');
      await dlg.getByRole('link', { name: /Omar DOUBLON/ }).click();
      await page.waitForURL(/#\/clients\//);
      await visible(page.getByRole('heading', { name: re('Omar DOUBLON') }), 'le lien du doublon ouvre la fiche client');
    },
  },
];
