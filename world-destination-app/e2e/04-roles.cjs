/** Rôles : l'agent n'a ni Caisse ni Paramètres ; seul un admin annule un paiement (avec motif). */
const {
  assert, aller, url, re, connexion, menu, visible, absent, attendre, ligne, onglet,
} = require('./lib.cjs');

/** Ouvre le dossier de démo de Yacine BENALI (paiements déjà présents). */
async function dossierYacine(page) {
  await aller(page, ('/dossiers'));
  await page.getByLabel('Rechercher').fill('Benali');
  await page.getByRole('link', { name: /^WD-/ }).first().click();
  await page.waitForURL(/#\/dossiers\/[^/?]+/);
  await onglet(page, 'Paiements');
}

function historique(page) {
  return page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Reçu' }) });
}

module.exports = [
  {
    nom: 'Agent : ni Caisse ni Paramètres (menu et accès direct par URL)',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await visible(menu(page, 'Clients'), 'le menu contient « Clients »');
      assert.equal(await menu(page, 'Caisse').count(), 0, 'pas de lien « Caisse » pour un agent');
      assert.equal(await menu(page, 'Paramètres').count(), 0, 'pas de lien « Paramètres » pour un agent');
      for (const chemin of ['/caisse', '/parametres']) {
        await aller(page, (chemin));
        await page.reload();
        await attendre(async () => !page.url().includes(chemin), `accès direct à ${chemin} : l'agent doit être redirigé`);
        await absent(page.getByRole('heading', { name: /^(Caisse|Paramètres)$/ }), `${chemin} : écran réservé non affiché`);
        await visible(page.getByRole('heading', { name: /Bonjour Agent Sara/ }), `${chemin} : retour au tableau de bord`);
      }
    },
  },
  {
    nom: 'Agent : ne voit pas le total des impayés (montants réservés aux administrateurs)',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      const section = page.locator('#impayes');
      await visible(section.getByRole('listitem').first(), 'la démo contient des impayés');
      const kpi = page.getByRole('link', { name: /Clients avec reste à payer/ });
      assert.doesNotMatch(await kpi.textContent(), /\d[\s ]?\d{3}\s?(DA|€)/, 'pas de total sur la tuile pour un agent');
      // Cahier des charges §11 : montants visibles par les administrateurs seulement
      const texte = await section.textContent();
      assert.doesNotMatch(texte, /\d\s?(DA|€|\$ CA)/, 'cahier §11 : la liste « Paiements exigibles » ne doit pas montrer de montants à un agent');
    },
  },
  {
    nom: 'Agent : ne peut pas annuler un paiement',
    async run({ page }) {
      await connexion(page, 'Agent Karim');
      await dossierYacine(page);
      const h = historique(page);
      await visible(h.getByRole('row').nth(1), 'historique des encaissements présent');
      assert.equal(await h.getByRole('button', { name: /^Annuler$/ }).count(), 0, 'aucun bouton « Annuler » dans l’historique pour un agent');
      await visible(h.getByRole('link', { name: /Reçu/ }), 'l’agent peut ouvrir le reçu');
    },
  },
  {
    nom: 'Admin : Caisse et Paramètres accessibles ; annulation avec motif, paiement barré et conservé',
    async run({ page }) {
      await connexion(page, 'Administrateur 1');
      await menu(page, 'Caisse').click();
      await visible(page.getByRole('heading', { name: 'Caisse' }), 'écran Caisse');
      await menu(page, 'Paramètres').click();
      await visible(page.getByRole('heading', { name: 'Paramètres' }), 'écran Paramètres');

      await dossierYacine(page);
      const h = historique(page);
      await h.getByRole('row').nth(1).waitFor();
      const nbAvant = await h.getByRole('row').count();
      const row = h.getByRole('row').filter({ has: page.getByRole('button', { name: /^Annuler$/ }) }).first();
      const numero = (await row.getByRole('cell').first().textContent()).trim();
      await row.getByRole('button', { name: /^Annuler$/ }).click();
      const dlg = page.getByRole('dialog', { name: re(`Annuler le paiement ${numero}`) });
      const valider = dlg.getByRole('button', { name: 'Annuler ce paiement' });
      assert.ok(await valider.isDisabled(), 'motif obligatoire : bouton désactivé sans motif');
      await dlg.getByLabel(/Motif de l'annulation/).fill('Erreur de saisie');
      await valider.click();
      const barree = ligne(h, numero).first();
      await visible(barree.getByText(/Annulé : Erreur de saisie \(Administrateur 1\)/), 'motif et auteur de l’annulation affichés');
      assert.equal(await h.getByRole('row').count(), nbAvant, 'le paiement annulé reste dans l’historique');
      const deco = await barree.getByRole('cell').nth(4).evaluate((el) => getComputedStyle(el).textDecorationLine);
      assert.match(deco, /line-through/, 'le montant annulé est barré');
      assert.equal(await barree.getByRole('button', { name: /^Annuler$/ }).count(), 0, 'plus de bouton Annuler sur un paiement annulé');
      await onglet(page, 'Journal');
      await visible(page.getByText(re(`Paiement ${numero} annulé – Erreur de saisie`)), 'annulation tracée dans le journal');
    },
  },
];
