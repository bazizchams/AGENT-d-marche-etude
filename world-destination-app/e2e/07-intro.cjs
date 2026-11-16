/** Intro de lancement : se passe au clic, et ne s'affiche jamais en mouvement réduit. */
const { assert, connexion, attendre } = require('./lib.cjs');

const intro = (page) => page.getByRole('dialog', { name: "Animation d'ouverture World Destination" });
const rejouer = (page) => page.getByRole('button', { name: /Animation d.intro/ });

module.exports = [
  {
    nom: 'Intro : se lance à la demande et se passe au clic',
    async run({ page }) {
      await connexion(page, 'Administrateur 1');
      await rejouer(page).first().click();
      await attendre(async () => (await intro(page).count()) === 1, "l'intro doit apparaître");
      await intro(page).click({ position: { x: 20, y: 20 } });
      await attendre(async () => (await intro(page).count()) === 0, "l'intro doit disparaître au clic");
    },
  },
  {
    nom: 'Intro : rien en mouvement réduit (prefers-reduced-motion)',
    async run({ page }) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await connexion(page, 'Administrateur 1');
      await rejouer(page).first().click();
      await page.waitForTimeout(600);
      assert.equal(await intro(page).count(), 0, "aucune intro sous mouvement réduit");
    },
  },
];
