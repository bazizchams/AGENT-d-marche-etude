/** Paiements : contrôle du montant, reçus numérotés, étapes bloquées par les frais, 2e tranche. */
const {
  assert, aller, url, re, reMontant, connexion, creerClient, onglet, ligne, visible, attendre, toast,
} = require('./lib.cjs');

/** Ouvre la modale d'encaissement d'une ligne et enregistre `montant` (ou la valeur proposée). */
async function encaisser(page, ligneTexte, montant) {
  await onglet(page, 'Paiements');
  const row = ligne(page, ligneTexte).filter({ has: page.getByRole('button', { name: 'Encaisser' }) }).first();
  await row.getByRole('button', { name: 'Encaisser' }).click();
  const dlg = page.getByRole('dialog', { name: /^Encaisser/ });
  if (montant !== undefined) await dlg.getByLabel(/Montant reçu/).fill(String(montant));
  await dlg.getByRole('button', { name: /Enregistrer l'encaissement/ }).click();
  const ok = page.getByRole('dialog', { name: 'Encaissement enregistré' });
  await ok.waitFor();
  const numero = (await ok.textContent()).match(/R-\d{4}-\d+/)[0];
  return { ok, numero };
}

async function fermer(dlg) { await dlg.getByRole('button', { name: 'Fermer' }).click(); }

/** Encaisse tous les frais de procédure à 100 %. */
async function payerTousLesFrais(page) {
  await onglet(page, 'Paiements');
  const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Organisme' }) });
  for (let i = 0; i < 10; i++) {
    const btn = table.getByRole('button', { name: 'Encaisser' });
    if (!(await btn.count())) break;
    await btn.first().click();
    await page.getByRole('dialog', { name: /^Encaisser/ }).getByRole('button', { name: /Enregistrer l'encaissement/ }).click();
    await fermer(page.getByRole('dialog', { name: 'Encaissement enregistré' }));
  }
}

async function toutesLesEtapes(page) {
  await onglet(page, 'Étapes');
  await page.getByRole('list').first().waitFor();
  for (let i = 0; i < 20; i++) {
    const btn = page.getByRole('button', { name: 'Marquer comme faite' });
    if (!(await btn.count())) break;
    await btn.first().click();
    await page.waitForTimeout(50);
  }
}

module.exports = [
  {
    nom: 'Encaissement : montant supérieur au reste refusé, reçus numérotés à la suite',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await creerClient(page, { prenom: 'Karima', nom: 'Paie', telephone: '0555 00 00 44', type: 'Campus France' });
      await onglet(page, 'Paiements');
      await ligne(page, /50 % au dépôt/).getByRole('button', { name: 'Encaisser' }).click();
      const dlg = page.getByRole('dialog', { name: /^Encaisser/ });
      const champ = dlg.getByLabel(/Montant reçu/);
      assert.equal(await champ.inputValue(), '60000', 'le montant proposé est le reste à payer');
      await champ.fill('60001');
      await visible(dlg.getByText(/Maximum/), 'message d’erreur si le montant dépasse le reste');
      assert.ok(await dlg.getByRole('button', { name: /Enregistrer l'encaissement/ }).isDisabled(), 'enregistrement impossible au-delà du reste');
      await champ.fill('0');
      assert.ok(await dlg.getByRole('button', { name: /Enregistrer l'encaissement/ }).isDisabled(), 'enregistrement impossible à 0');
      await champ.fill('25000');
      await dlg.getByRole('button', { name: /Enregistrer l'encaissement/ }).click();
      const ok1 = page.getByRole('dialog', { name: 'Encaissement enregistré' });
      const n1 = (await ok1.textContent()).match(/R-(\d{4})-(\d+)/);
      assert.ok(n1, 'un numéro de reçu est attribué');
      assert.equal(n1[1], String(new Date().getFullYear()), 'le numéro de reçu contient l’année');
      await fermer(ok1);
      await visible(ligne(page, /50 % au dépôt/).getByText(reMontant(35000)), 'reste mis à jour : 35 000');

      const { ok: ok2, numero: n2 } = await encaisser(page, /50 % au dépôt/, 40000).catch(() => ({}));
      assert.ok(!ok2, 'un 2e encaissement de 40 000 (> reste 35 000) ne doit pas être enregistré');
      const dlg2 = page.getByRole('dialog', { name: /^Encaisser/ });
      await dlg2.getByRole('button', { name: 'Annuler' }).click();

      const r2 = await encaisser(page, /50 % au dépôt/, 35000);
      const num2 = r2.numero.match(/R-\d{4}-(\d+)/)[1];
      assert.equal(Number(num2), Number(n1[2]) + 1, `reçus consécutifs (${n1[0]} puis ${r2.numero})`);
      await r2.ok.getByRole('link', { name: /Imprimer le reçu/ }).click();
      await page.waitForURL(/\/recu\//);
      await visible(page.getByText('REÇU', { exact: true }), 'page de reçu');
      await visible(page.getByText(`N° ${r2.numero}`), 'numéro sur le reçu');
      await visible(page.getByText(/Karima PAIE/), 'nom du client sur le reçu');
      await visible(page.getByRole('img', { name: /QR code/ }), 'QR code d’accès à l’espace client sur le reçu');
      await visible(page.getByRole('cell', { name: reMontant(35000) }), 'montant reçu sur le reçu');
      await page.getByRole('link', { name: /Retour au dossier/ }).click();
      await visible(ligne(page, /50 % au dépôt/).getByText('Payé'), '1re échéance soldée');
      void n2;
    },
  },
  {
    nom: 'Étape bloquée tant que les frais ne sont pas payés à 100 %, puis débloquée',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await creerClient(page, { prenom: 'Bilal', nom: 'Etape', telephone: '0556 00 00 55', type: 'Campus France' });
      await onglet(page, 'Étapes');
      const etape = page.getByRole('listitem').filter({ hasText: 'Test de français' }).first();
      const bloque = etape.getByRole('button', { name: /Frais non encaissés/ });
      await visible(bloque, 'étape « Test de français » signalée comme bloquée');
      assert.ok(await bloque.isDisabled(), 'le bouton de l’étape bloquée est désactivé');

      // Paiement partiel : toujours bloquée
      const r = await encaisser(page, 'Test TCF', 16999);
      await fermer(r.ok);
      await onglet(page, 'Étapes');
      assert.ok(await etape.getByRole('button', { name: /Frais non encaissés/ }).isDisabled(), 'toujours bloquée après un paiement partiel');

      // Solde : débloquée
      const r2 = await encaisser(page, 'Test TCF', 1);
      await fermer(r2.ok);
      await onglet(page, 'Étapes');
      const faire = etape.getByRole('button', { name: 'Marquer comme faite' });
      await visible(faire, 'étape débloquée une fois les frais payés à 100 %');
      await faire.click();
      await visible(etape.getByText(/Fait le .* par Agent Sara/), 'étape marquée faite avec auteur et date');
      await visible(toast(page, 'Étape enregistrée'), 'confirmation');
    },
  },
  {
    nom: '2e tranche exigible seulement quand toutes les étapes sont faites',
    async run({ page }) {
      await connexion(page, 'Agent Sara');
      await creerClient(page, { prenom: 'Lyes', nom: 'Tranche', telephone: '0557 00 00 66', type: 'Visa Schengen' });
      await onglet(page, 'Paiements');
      await visible(ligne(page, /50 % à la fin/).getByText('À la fin de la procédure'), '2e tranche non exigible au départ');
      await payerTousLesFrais(page);
      await onglet(page, 'Étapes');
      await page.getByRole('button', { name: 'Marquer comme faite' }).first().waitFor();
      // Toutes sauf la dernière
      const boutons = page.getByRole('button', { name: 'Marquer comme faite' });
      const total = await boutons.count();
      for (let i = 0; i < total - 1; i++) { await boutons.first().click(); await page.waitForTimeout(50); }
      await onglet(page, 'Paiements');
      await visible(ligne(page, /50 % à la fin/).getByText('À la fin de la procédure'), '2e tranche toujours non exigible s’il reste une étape');
      await toutesLesEtapes(page);
      await visible(page.getByText(/2ᵉ tranche des honoraires \(50 %\) est maintenant exigible/), 'alerte « 2e tranche exigible » dans l’onglet Étapes');
      await onglet(page, 'Paiements');
      await visible(ligne(page, /50 % à la fin/).getByText('À encaisser'), '2e tranche exigible quand toutes les étapes sont faites');
      // Le tableau de bord la liste parmi les impayés
      const id = page.url().match(/dossiers\/([^?]+)/)[1];
      await aller(page, ('/'));
      const item = page.locator('#impayes').getByRole('listitem').filter({ hasText: /Lyes TRANCHE/ });
      await visible(item.getByText(/50 % à la fin/), 'tableau de bord : 2e tranche dans les paiements exigibles');
      void id;
    },
  },
  {
    nom: '2e tranche exigible quand le dossier est clôturé (étapes non terminées)',
    async run({ page }) {
      await connexion(page, 'Agent Karim');
      await creerClient(page, { prenom: 'Mounir', nom: 'Cloture', telephone: '0558 00 00 77', type: 'Visa Schengen' });
      await aller(page, ('/'));
      assert.equal(await page.locator('#impayes').getByRole('listitem').filter({ hasText: /Mounir CLOTURE/ }).filter({ hasText: /50 % à la fin/ }).count(), 0,
        'tableau de bord : 2e tranche absente avant clôture');
      await page.goBack();
      await page.getByRole('button', { name: /Clôturer/ }).first().click();
      const dlg = page.getByRole('dialog', { name: 'Clôturer le dossier' });
      await visible(dlg.getByText(/étape\(s\) ne sont pas marquées comme faites/), 'avertissement : étapes non faites');
      await dlg.getByRole('button', { name: 'Clôturer le dossier' }).click();
      await visible(page.getByText('Terminé').first(), 'dossier « Terminé »');
      await onglet(page, 'Paiements');
      await visible(ligne(page, /50 % à la fin/).getByText('À encaisser'), '2e tranche exigible après clôture');
    },
  },
];
