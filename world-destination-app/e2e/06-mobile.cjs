/** Affichage téléphone (390 px) : aucune page plus large que l'écran, aucune erreur console. */
const {
  aller, url, connexion, deconnexion, creerClient, onglet, verifierLargeur, visible,
} = require('./lib.cjs');

async function premierDossier(page) {
  await aller(page, ('/dossiers'));
  await page.getByLabel('Rechercher').fill('Benali'); // dossier de démo avec des encaissements
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
      // Menu mobile : bouton « Ouvrir le menu » (ancienne version) ou barre d'onglets en bas d'écran
      const burger = page.getByRole('button', { name: /Ouvrir le menu/ });
      if (await burger.count()) { await burger.click(); await check('Menu mobile ouvert'); }
      const lienClients = page.getByRole('navigation').getByRole('link', { name: /Clients/ }).filter({ visible: true }).first();
      await visible(lienClients, 'le menu mobile donne accès à « Clients »');
      await lienClients.click();
      await check('Clients');
      await aller(page, ('/clients?nouveau=1'));
      await page.getByRole('dialog').waitFor();
      await check('Nouveau client (modale)');
      await page.keyboard.press('Escape');
      await aller(page, ('/clients'));
      await page.getByRole('link', { name: /BENALI/ }).first().click();
      await page.waitForURL(/#\/clients\//);
      await check('Fiche client');
      const id = await premierDossier(page);
      await check('Dossiers (liste)');
      await aller(page, (`/dossiers/${id}`));
      for (const o of ['Documents', 'Paiements', 'Étapes', 'Journal']) {
        await onglet(page, o);
        await check(`Dossier – onglet ${o}`);
      }
      await onglet(page, 'Paiements');
      await page.getByRole('link', { name: /Reçu/ }).first().click();
      await page.waitForURL(/\/recu\//);
      await page.getByRole('img', { name: /QR code/ }).waitFor();
      await check('Reçu');
      await aller(page, (`/dossiers/${id}`));
      await page.getByRole('button', { name: /Prévenir le client/ }).click();
      await check('Menu « Prévenir le client »');
      await aller(page, ('/caisse'));
      await check('Caisse');
      await aller(page, ('/parametres'));
      for (const o of ['Types de dossiers', 'Agence', 'Utilisateurs']) {
        await page.getByRole('tab', { name: o }).click();
        await check(`Paramètres – ${o}`);
      }
      await page.getByRole('tab', { name: 'Types de dossiers' }).click();
      await page.getByRole('button', { name: 'Modifier' }).first().click();
      await page.getByRole('dialog').waitFor();
      await check('Paramètres – édition d’un type (modale)');
      await page.keyboard.press('Escape');
      // Dossier créé (enregistré) pour que le lien reste valide après rechargement
      const id2 = await creerClient(page, { prenom: 'Mobile', nom: 'Espace', telephone: '0663 00 11 22', type: 'Ausbildung (Allemagne)' });
      await check('Nouveau dossier');
      await deconnexion(page);
      await aller(page, (`/espace/${id2}`));
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
      const id = await creerClient(page, { prenom: 'Sofia', nom: 'Rtl', telephone: '0664 00 11 22', type: 'Campus France', langue: 'ar' });
      await deconnexion(page);
      await aller(page, (`/espace/${id}`));
      await page.reload();
      await page.getByRole('heading', { name: /مرحبًا/ }).waitFor();
      await verifierLargeur(page, 'Espace client (arabe)');
    },
  },
];
