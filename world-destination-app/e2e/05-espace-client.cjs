/** Espace client en arabe : sens de lecture RTL et bascule FR/AR. */
const { assert, url, connexion, deconnexion, visible, attendre } = require('./lib.cjs');

async function idDossierAmina(page) {
  await connexion(page, 'Agent Sara');
  await page.goto(url('/dossiers'));
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
    nom: 'Espace client arabe : dir=rtl, bascule FR ↔ AR',
    async run({ page }) {
      const id = await idDossierAmina(page);
      await deconnexion(page);
      await page.goto(url(`/espace/${id}`));
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
      await page.goto(url('/espace/inexistant'));
      await visible(page.getByText(/Ce lien n’est pas valide/), 'message pour un lien invalide');
      const id = await idDossierAmina(page);
      await page.getByRole('tab', { name: /^Journal/ }).click();
      await page.getByLabel('Ce qui a été fait').fill('NOTE-SECRETE-INTERNE');
      await page.getByRole('button', { name: 'Ajouter la note' }).click();
      await visible(page.getByText('NOTE-SECRETE-INTERNE'), 'note visible du personnel');
      await deconnexion(page);
      await page.goto(url(`/espace/${id}`));
      await page.reload();
      await visible(page.getByRole('heading', { level: 1 }), 'espace client chargé');
      assert.equal(await page.getByText('NOTE-SECRETE-INTERNE').count(), 0, 'une note interne n’apparaît pas côté client');
    },
  },
];
