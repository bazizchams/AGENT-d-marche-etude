/** Affichage téléphone (390 px) : aucune page plus large que l'écran, aucune erreur console. */
const { url, connexion, deconnexion, onglet, verifierLargeur, visible } = require('./lib.cjs');

async function premierDossier(page) {
  await page.goto(url('/dossiers'));
  await page.getByRole('link', { name: /^WD-/ }).first().click();
  await page.waitForURL(/#\/dossiers\/[^/?]+/);
  return page.url().match(/dossiers\/([^/?]+)/)[1];
}

module.exports = [
  {
    nom: 'Mobile 390 px : écrans du personnel (admin) sans débordement',
    mobile: true,
    async run({ page }) {
      const echecs = [];
      const check = async (nom) => { try { await verifierLargeur(page, nom); } catch (e) { echecs.push(e.message); } };
      await check('Connexion');
      await connexion(page, 'Administrateur 1');
      await check('Tableau de bord');
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await visible(page.getByRole('navigation').getByRole('link', { name: /Clients/ }), 'menu mobile ouvert');
      await check('Menu mobile ouvert');
      await page.getByRole('navigation').getByRole('link', { name: /Clients/ }).click();
      await check('Clients');
      await page.goto(url('/clients?nouveau=1'));
      await page.getByRole('dialog').waitFor();
      await check('Nouveau client (modale)');
      await page.keyboard.press('Escape');
      await page.goto(url('/clients'));
      await page.getByRole('link', { name: /BENALI/ }).first().click();
      await page.waitForURL(/#\/clients\//);
      await check('Fiche client');
      const id = await premierDossier(page);
      await check('Dossiers (liste)');
      await page.goto(url(`/dossiers/${id}`));
      for (const o of ['Documents', 'Paiements', 'Étapes', 'Journal']) {
        await onglet(page, o);
        await check(`Dossier – onglet ${o}`);
      }
      await onglet(page, 'Paiements');
      await page.getByRole('link', { name: /Reçu/ }).first().click();
      await page.waitForURL(/\/recu\//);
      await page.getByRole('img', { name: /QR code/ }).waitFor();
      await check('Reçu');
      await page.goto(url(`/dossiers/${id}`));
      await page.getByRole('button', { name: /Prévenir le client/ }).click();
      await check('Menu « Prévenir le client »');
      await page.goto(url('/caisse'));
      await check('Caisse');
      await page.goto(url('/parametres'));
      for (const o of ['Types de dossiers', 'Agence', 'Utilisateurs']) {
        await page.getByRole('tab', { name: o }).click();
        await check(`Paramètres – ${o}`);
      }
      await page.getByRole('tab', { name: 'Types de dossiers' }).click();
      await page.getByRole('button', { name: 'Modifier' }).first().click();
      await page.getByRole('dialog').waitFor();
      await check('Paramètres – édition d’un type (modale)');
      await page.keyboard.press('Escape');
      await deconnexion(page);
      await page.goto(url(`/espace/${id}`));
      await page.reload();
      await check('Espace client');
      await page.getByRole('button', { name: /العربية|Français/ }).click();
      await check('Espace client (autre langue)');
      if (echecs.length) throw new Error(echecs.join('\n'));
    },
  },
  {
    nom: 'Mobile 390 px : espace client arabe sans débordement',
    mobile: true,
    async run({ page }) {
      await connexion(page, 'Agent Karim');
      await page.goto(url('/dossiers'));
      await page.getByLabel('Rechercher').fill('Haddad');
      await page.getByRole('link', { name: /^WD-/ }).first().click();
      await page.waitForURL(/#\/dossiers\/[^/?]+/);
      const id = page.url().match(/dossiers\/([^/?]+)/)[1];
      await deconnexion(page);
      await page.goto(url(`/espace/${id}`));
      await page.reload();
      await page.getByRole('heading', { name: /مرحبًا/ }).waitFor();
      await verifierLargeur(page, 'Espace client (arabe)');
    },
  },
];
