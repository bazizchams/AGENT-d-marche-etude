/** Documents : téléversement agent, envoi client, vérification, refus motivé. */
const {
  assert, aller, url, re, connexion, deconnexion, creerClient, onglet, ligne, choisirFichier, toast, visible, attendre,
} = require('./lib.cjs');

async function premierDocument(page) {
  await page.getByRole('tab', { name: /^Documents/ }).waitFor();
  const rows = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: /Document/i }) }).getByRole('row');
  // ligne 0 = en-tête
  return (await rows.nth(1).getByRole('cell').first().locator('b').textContent()).trim();
}

module.exports = [
  {
    nom: 'Documents : téléversé par l’agent → « Validé » directement',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await creerClient(page, { prenom: 'Ines', nom: 'Upload', telephone: '0552 00 00 11', type: 'Visa Schengen' });
      const nomDoc = await premierDocument(page);
      const row = ligne(page.getByRole('table'), nomDoc).first();
      await visible(row.getByText('Manquant'), 'document initialement manquant');
      await choisirFichier(page, row.getByRole('button', { name: /Téléverser/ }), { nom: 'passeport.pdf' });
      await visible(toast(page, 'Document téléversé et validé'), 'message de confirmation du téléversement');
      await visible(row.getByText('Validé'), 'le document téléversé par un agent est « Validé »');
      await visible(row.getByRole('button', { name: /passeport\.pdf/ }), 'le fichier est consultable depuis la ligne');
      await visible(row.getByRole('button', { name: /Remplacer/ }), 'le bouton devient « Remplacer »');
      await attendre(async () => /\b1\s*\//.test(await page.getByRole('tab', { name: /^Documents/ }).textContent()), 'le compteur de documents passe à 1 validé');
      await onglet(page, 'Journal');
      await visible(page.getByText(re(`${nomDoc} : reçu à l'agence et téléversé`)), 'le journal trace le téléversement');
    },
  },
  {
    nom: 'Documents : envoi client → « À vérifier » au tableau de bord → refus motivé visible côté client',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      const id = await creerClient(page, { prenom: 'Walid', nom: 'Client', telephone: '0553 00 00 22', type: 'Visa Schengen' });
      const nomDoc = await premierDocument(page);

      // Le client (non connecté) ouvre son espace et envoie un document
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      await visible(page.getByRole('heading', { name: /Bonjour Walid/ }), 'l’espace client s’ouvre sans connexion du personnel');
      const li = page.getByRole('listitem').filter({ hasText: re(nomDoc) }).first();
      await choisirFichier(page, li.getByRole('button', { name: /Envoyer/ }), { nom: 'photo.jpg', type: 'image/jpeg' });
      await visible(toast(page, 'Document envoyé'), 'confirmation d’envoi côté client');
      await visible(li.getByText('Reçu, en vérification'), 'côté client : « Reçu, en vérification »');

      // Tableau de bord du personnel
      await connexion(page, 'Agent Karim');
      const kpi = page.getByRole('link', { name: /Documents à vérifier/ });
      assert.ok(Number((await kpi.textContent()).match(/\d+/)[0]) >= 2, 'le compteur « Documents à vérifier » inclut l’envoi (démo : 1 + nouveau)');
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Documents envoyés par les clients/ }) });
      const item = section.getByRole('listitem').filter({ hasText: /Walid CLIENT/ });
      await visible(item.getByText(re(nomDoc)), 'le document envoyé figure dans « Documents envoyés par les clients »');
      await item.getByRole('link', { name: 'Vérifier' }).click();
      await page.waitForURL(re(`/dossiers/${id}`));
      const row = ligne(page.getByRole('table'), nomDoc).first();
      await visible(row.getByText('À vérifier'), 'statut « À vérifier » dans le dossier');

      // Refus : motif obligatoire
      await row.getByRole('button', { name: 'Refuser' }).click();
      const dlg = page.getByRole('dialog', { name: 'Refuser le document' });
      await dlg.getByRole('button', { name: 'Refuser le document' }).click();
      await visible(dlg.getByText(/Indiquez le motif/), 'un refus sans motif est bloqué');
      await visible(row.getByText('À vérifier'), 'le statut ne change pas sans motif');
      await dlg.getByLabel('Motif du refus').fill('Photo floue, merci de renvoyer un scan');
      await dlg.getByRole('button', { name: 'Refuser le document' }).click();
      await visible(row.getByText('Refusé'), 'statut « Refusé »');
      await visible(row.getByText(/Motif : Photo floue/), 'motif affiché au personnel');

      // Le tableau de bord ne le liste plus
      await aller(page, ('/'));
      assert.equal(await page.locator('section').filter({ has: page.getByRole('heading', { name: /Documents envoyés par les clients/ }) })
        .getByRole('listitem').filter({ hasText: /Walid CLIENT/ }).count(), 0, 'un document refusé n’est plus « à vérifier »');

      // Côté client : motif visible + renvoi possible
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      const li2 = page.getByRole('listitem').filter({ hasText: re(nomDoc) }).first();
      await visible(li2.getByText('À renvoyer'), 'côté client : « À renvoyer »');
      await visible(li2.getByText(/Motif : Photo floue, merci de renvoyer un scan/), 'côté client : motif du refus visible');
      await visible(li2.getByRole('button', { name: /Renvoyer/ }), 'côté client : bouton « Renvoyer »');
    },
  },
  {
    nom: 'Documents : validation d’un envoi client par l’agent',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      const id = await creerClient(page, { prenom: 'Sami', nom: 'Valide', telephone: '0554 00 00 33', type: 'Visa Schengen' });
      const nomDoc = await premierDocument(page);
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      await choisirFichier(page, page.getByRole('listitem').filter({ hasText: re(nomDoc) }).first().getByRole('button', { name: /Envoyer/ }));
      await visible(page.getByText('Reçu, en vérification'), 'envoi client enregistré');
      await connexion(page, 'Agent Sara');
      await aller(page, (`/dossiers/${id}`));
      const row = ligne(page.getByRole('table'), nomDoc).first();
      await row.getByRole('button', { name: 'Valider' }).click();
      await visible(row.getByText('Validé'), 'document validé');
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      await visible(page.getByRole('listitem').filter({ hasText: re(nomDoc) }).first().getByText('Validé'), 'côté client : « Validé »');
    },
  },
];
