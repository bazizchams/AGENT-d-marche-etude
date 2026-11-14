#!/usr/bin/env node
/**
 * Lanceur des tests de bout en bout.
 * - démarre `npx vite --port 4175 --strictPort` (sauf si E2E_BASE est fourni) ;
 * - exécute chaque scénario dans un contexte navigateur vierge (localStorage vide) ;
 * - échoue un scénario s'il produit une erreur console ou une exception de page ;
 * - affiche un résumé et arrête le serveur.
 *
 * Usage : npm run e2e            (tous les scénarios)
 *         node e2e/run.cjs paie  (seulement les scénarios dont le nom contient « paie »)
 * Variables : E2E_HEADED=1 pour voir le navigateur, E2E_BASE=http://... pour viser un serveur déjà lancé.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { nouvellePage } = require('./lib.cjs');

const RACINE = path.resolve(__dirname, '..');
const PORT = 4175;
const filtre = process.argv.slice(2).join(' ').toLowerCase();

function attendreServeur(url, delai = 30000) {
  const fin = Date.now() + delai;
  return new Promise((resolve, reject) => {
    const essai = () => {
      http.get(url, (res) => { res.resume(); resolve(); }).on('error', () => {
        if (Date.now() > fin) reject(new Error(`Serveur injoignable : ${url}`));
        else setTimeout(essai, 250);
      });
    };
    essai();
  });
}

function chargerScenarios() {
  return fs.readdirSync(__dirname)
    .filter((f) => /^\d+-.*\.cjs$/.test(f))
    .sort()
    .flatMap((f) => require(path.join(__dirname, f)).map((s) => ({ ...s, fichier: f })))
    .filter((s) => !filtre || `${s.fichier} ${s.nom}`.toLowerCase().includes(filtre));
}

async function main() {
  let serveur = null;
  if (!process.env.E2E_BASE) {
    serveur = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, BROWSER: 'none' },
    });
    let sortie = '';
    serveur.stdout.on('data', (b) => { sortie += b; });
    serveur.stderr.on('data', (b) => { sortie += b; });
    serveur.on('exit', (code) => { if (code) console.error(`vite s'est arrêté (code ${code})\n${sortie}`); });
    process.env.E2E_BASE = `http://localhost:${PORT}/`;
  }
  const arreter = () => { if (serveur && !serveur.killed) { try { process.kill(-serveur.pid, 'SIGTERM'); } catch { /* déjà arrêté */ } } };
  process.on('SIGINT', () => { arreter(); process.exit(130); });

  const resultats = [];
  let browser;
  try {
    await attendreServeur(process.env.E2E_BASE);
    browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
    const scenarios = chargerScenarios();
    console.log(`\n${scenarios.length} scénario(s) – ${process.env.E2E_BASE}\n`);
    for (const s of scenarios) {
      const t0 = Date.now();
      const { context, page, erreurs } = await nouvellePage(browser, { mobile: !!s.mobile });
      let echec = null;
      try {
        await s.run({ page, context, browser, erreurs });
        await page.waitForTimeout(100);
        if (erreurs.length && !s.ignorerConsole) {
          echec = `Erreur(s) dans la console du navigateur :\n      - ${[...new Set(erreurs)].join('\n      - ')}`;
        }
      } catch (e) {
        echec = (e && e.message ? e.message : String(e)).split('\n').slice(0, 6).join('\n      ');
        if (erreurs.length) echec += `\n      (console : ${[...new Set(erreurs)].slice(0, 3).join(' | ')})`;
        try {
          const dossier = path.join(__dirname, 'echecs');
          fs.mkdirSync(dossier, { recursive: true });
          await page.screenshot({ path: path.join(dossier, `${s.fichier.replace('.cjs', '')}-${s.nom.replace(/[^\w]+/g, '_').slice(0, 50)}.png`), fullPage: true });
        } catch { /* capture impossible */ }
      }
      await context.close();
      const ms = Date.now() - t0;
      resultats.push({ ...s, echec, ms });
      console.log(`${echec ? '✗' : '✓'} ${s.nom} (${ms} ms)${echec ? `\n      ${echec}` : ''}`);
    }
  } finally {
    if (browser) await browser.close();
    arreter();
  }

  const ko = resultats.filter((r) => r.echec);
  console.log(`\nRésumé : ${resultats.length - ko.length} réussi(s), ${ko.length} échoué(s) sur ${resultats.length}.`);
  if (ko.length) {
    console.log('\nÉchecs :');
    ko.forEach((r) => console.log(`  - [${r.fichier}] ${r.nom}`));
    console.log('\nCaptures d\'écran : e2e/echecs/');
  }
  process.exit(ko.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
