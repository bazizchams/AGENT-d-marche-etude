/** Espace client en arabe : sens de lecture RTL et bascule FR/AR. */
const {
  assert, aller, url, re, connexion, deconnexion, creerClient, ligne, visible, attendre,
} = require('./lib.cjs');

async function idDossierAmina(page) {
  await connexion(page, 'Agent Sara');
  await aller(page, ('/dossiers'));
  await page.getByLabel('Rechercher').fill('Haddad');
  await page.getByRole('link', { name: /^WD-/ }).first().click();
  await page.waitForURL(/#\/dossiers\/[^/?]+/);
  return page.url().match(/dossiers\/([^/?]+)/)[1];
}

const dirRacine = (page) => page.evaluate(() => {
  const el = document.querySelector('[dir="rtl"], [dir="ltr"]');
  return el ? { dir: el.getAttribute('dir'), lang: el.getAttribute('lang') } : null;
});

module.exports = [
  {
    nom: 'Lien d’un dossier de démonstration toujours valide après rechargement',
    async run({ page }) {
      const id = await idDossierAmina(page);
      await page.reload();
      await visible(page.getByRole('heading', { name: /Campus France/ }), `le dossier ${id} doit encore exister après rechargement (données de démo non enregistrées ?)`);
      await deconnexion(page);
      await aller(page, `/espace/${id}`);
      await page.reload();
      await visible(page.getByRole('heading', { name: /مرحبًا Amina/ }), 'le lien d’espace client d’un dossier de démo doit rester valide');
    },
  },
  {
    nom: 'Espace client arabe : dir=rtl, bascule FR ↔ AR, motif de refus visible',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      const id = await creerClient(page, { prenom: 'Amina', nom: 'Arabe', telephone: '0661 22 33 44', type: 'Campus France', langue: 'ar' });
      const row = page.getByRole('table').getByRole('row').nth(1);
      // Refus d'un document pour vérifier l'affichage du motif côté client
      const { choisirFichier } = require('./lib.cjs');
      await choisirFichier(page, row.getByRole('button', { name: /Téléverser/ }));
      await row.getByRole('button', { name: 'Refuser' }).click();
      const dlg = page.getByRole('dialog', { name: 'Refuser le document' });
      await dlg.getByLabel('Motif du refus').fill('Lettre non signée');
      await dlg.getByRole('button', { name: 'Refuser le document' }).click();
      await visible(row.getByText('Refusé'), 'document refusé');
      await deconnexion(page);
      await aller(page, `/espace/${id}`);
      await page.reload();
      await visible(page.getByRole('heading', { name: /مرحبًا Amina/ }), 'cliente arabophone : accueil en arabe');
      let r = await dirRacine(page);
      assert.equal(r && r.dir, 'rtl', 'l’espace client arabe est en dir=rtl');
      assert.equal(r.lang, 'ar', 'attribut lang="ar"');
      await visible(page.getByText(/Lettre non signée/), 'le motif de refus est visible côté client');

      await page.getByRole('button', { name: 'Français' }).click();
      await visible(page.getByRole('heading', { name: /Bonjour Amina/ }), 'bascule vers le français');
      r = await dirRacine(page);
      assert.equal(r && r.dir, 'ltr', 'en français : dir=ltr');
      await visible(page.getByText('Vos documents'), 'libellés traduits en français');

      await page.getByRole('button', { name: 'العربية' }).click();
      await attendre(async () => (await dirRacine(page))?.dir === 'rtl', 'retour en arabe : dir=rtl');
      await visible(page.getByText('وثائقكم'), 'libellés en arabe');
    },
  },
  {
    nom: 'Espace client : lien invalide et notes internes invisibles',
    async run({ page }) {
      await aller(page, ('/espace/inexistant'));
      await visible(page.getByText(/Ce lien n’est pas valide/), 'message pour un lien invalide');
      await connexion(page, 'Agent Sara');
      const id = await creerClient(page, { prenom: 'Note', nom: 'Interne', telephone: '0662 22 33 55', type: 'Visa Schengen' });
      await page.getByRole('tab', { name: /^Journal/ }).click();
      await page.getByLabel('Ce qui a été fait').fill('NOTE-SECRETE-INTERNE');
      await page.getByRole('button', { name: 'Ajouter la note' }).click();
      await visible(page.getByText('NOTE-SECRETE-INTERNE'), 'note visible du personnel');
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      await visible(page.getByRole('heading', { level: 1 }), 'espace client chargé');
      assert.equal(await page.getByText('NOTE-SECRETE-INTERNE').count(), 0, 'une note interne n’apparaît pas côté client');
    },
  },
];
