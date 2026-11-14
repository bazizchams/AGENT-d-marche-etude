/**
 * Outils communs aux scénarios de bout en bout (Playwright, sans @playwright/test).
 * Sélecteurs : rôles et libellés visibles uniquement (pas de classes CSS).
 */
const assert = require('node:assert/strict');

const BASE = process.env.E2E_BASE || 'http://localhost:4175/';
const url = (hash = '/') => `${BASE}#${hash}`;

/** Échappe une chaîne pour l'utiliser dans une RegExp. */
const re = (s, flags = '') => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
/** Montant « 60 000 » quel que soit l'espace insécable utilisé par Intl. */
const reMontant = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?'));

/**
 * Ouvre un contexte vierge (localStorage vide) et une page qui collecte les erreurs console.
 */
async function nouvellePage(browser, { mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
    deviceScaleFactor: 1,
    hasTouch: mobile,
    isMobile: mobile,
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const erreurs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`console.error : ${m.text()}`);
  });
  page.on('pageerror', (e) => erreurs.push(`exception : ${e.message}`));
  // Les liens WhatsApp / mailto ne doivent pas ouvrir de vraies fenêtres.
  await context.route(/wa\.me|whatsapp\.com/, (r) => r.abort());
  await page.goto(url('/'));
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('wd-fichiers'); });
  await page.reload();
  return { context, page, erreurs };
}

/** Recharge la page (le store relit le localStorage). */
async function recharger(page, hash) {
  if (hash !== undefined) await page.goto(url(hash));
  await page.reload();
}

async function connexion(page, nom) {
  await page.goto(url('/'));
  await page.getByRole('button', { name: re(nom) }).first().click();
  await page.getByRole('heading', { name: re(`Bonjour ${nom}`) }).waitFor();
}

async function deconnexion(page) {
  await page.evaluate(() => localStorage.removeItem('wd-session'));
  await page.reload();
}

/** Lien du menu principal (gère le menu mobile replié). */
function menu(page, nom) {
  return page.getByRole('navigation').getByRole('link', { name: re(nom) });
}

/**
 * Crée un client via le formulaire « Nouveau client ». Renvoie l'id du dossier (ou null).
 */
async function creerClient(page, { prenom, nom, telephone, email = '', type = 'Campus France', langue } = {}) {
  await page.goto(url('/clients?nouveau=1'));
  const dlg = page.getByRole('dialog', { name: 'Nouveau client' });
  await dlg.waitFor();
  await dlg.getByLabel('Prénom', { exact: true }).fill(prenom);
  await dlg.getByLabel('Nom', { exact: true }).fill(nom);
  await dlg.getByLabel(/^Téléphone/).fill(telephone);
  if (email) await dlg.getByLabel(/^E-mail/).fill(email);
  if (langue) await dlg.getByLabel(/Langue/).selectOption(langue);
  if (type) await dlg.getByLabel('Type de dossier').selectOption({ label: type });
  else await dlg.getByLabel('Type de dossier').selectOption('');
  await dlg.getByRole('button', { name: /^Créer le client/ }).click();
  if (!type) { await page.waitForURL(/#\/clients\/[^?]+$/); return null; }
  await page.waitForURL(/#\/dossiers\/[^/?]+/);
  return idDossier(page);
}

function idDossier(page) {
  const m = page.url().match(/#\/dossiers\/([^/?]+)/);
  return m && m[1];
}

async function onglet(page, nom) {
  await page.getByRole('tab', { name: re(nom) }).click();
}

/** Ligne de tableau (ou élément de liste) contenant un texte. */
function ligne(scope, texte) {
  return scope.locator('tr, li').filter({ hasText: typeof texte === 'string' ? re(texte) : texte });
}

/** Choisit un fichier dans le sélecteur ouvert par un clic. */
async function choisirFichier(page, declencheur, { nom = 'scan.pdf', type = 'application/pdf' } = {}) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), declencheur.click()]);
  await fc.setFiles({ name: nom, mimeType: type, buffer: Buffer.from('%PDF-1.4\n% fichier de test\n') });
}

/** Toast / message d'état. */
function toast(page, texte) {
  return page.getByRole('status').filter({ hasText: re(texte) });
}

/** Vérifie qu'aucune largeur n'excède le viewport. */
async function verifierLargeur(page, ecran) {
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    // Repère l'élément le plus large qui dépasse (diagnostic).
    let pire = null;
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      // Ignore les éléments dans un conteneur à défilement horizontal.
      let p = el.parentElement; let dansScroll = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && p.scrollWidth > p.clientWidth - 1) { dansScroll = true; break; }
        p = p.parentElement;
      }
      if (dansScroll) continue;
      const depasse = Math.max(b.right - vw, -b.left);
      if (depasse > 1 && (!pire || depasse > pire.depasse)) {
        pire = { depasse: Math.round(depasse), tag: el.tagName.toLowerCase(), texte: (el.textContent || '').trim().slice(0, 50) };
      }
    }
    return { vw, sw, pire };
  });
  if (r.sw > r.vw + 1) {
    const d = r.pire ? ` ; élément fautif probable : <${r.pire.tag}> « ${r.pire.texte} » (+${r.pire.depasse}px)` : '';
    throw new assert.AssertionError({ message: `Débordement horizontal sur « ${ecran} » : largeur ${r.sw}px > viewport ${r.vw}px${d}` });
  }
}

/** Attend qu'une condition soit vraie (sondage). */
async function attendre(fn, message, delai = 5000) {
  const fin = Date.now() + delai;
  let dernier;
  while (Date.now() < fin) {
    try { if (await fn()) return; } catch (e) { dernier = e; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new assert.AssertionError({ message: `${message}${dernier ? ` (${dernier.message})` : ''}` });
}

async function visible(loc, message) {
  try { await loc.first().waitFor({ state: 'visible', timeout: 5000 }); } catch {
    throw new assert.AssertionError({ message });
  }
}

async function absent(loc, message) {
  await attendre(async () => (await loc.count()) === 0 || !(await loc.first().isVisible()), message, 2000);
}

module.exports = {
  assert, BASE, url, re, reMontant, nouvellePage, recharger, connexion, deconnexion, menu, creerClient, idDossier,
  onglet, ligne, choisirFichier, toast, verifierLargeur, attendre, visible, absent,
};
