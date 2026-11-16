import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icone, type NomIcone } from './components/Icone';
import { AnneauDefilement, declencherIntroCinetique, EVENEMENT_REJOUER_INTRO } from './components/MotionLeger';
import { ZoneToast } from './components/ui';
import { deconnexion, modeEnLigne, useUtilisateur } from './lib/store';
// Écrans chargés à la demande : le bundle initial ne contient que la coquille.
// GSAP (pièces « signature ») n'est téléchargé qu'avec les écrans qui l'utilisent.
const Caisse = lazy(() => import('./pages/Caisse'));
const Clients = lazy(() => import('./pages/Clients'));
const Connexion = lazy(() => import('./pages/Connexion'));
const DossierDetail = lazy(() => import('./pages/DossierDetail'));
const Dossiers = lazy(() => import('./pages/Dossiers'));
const EspaceClient = lazy(() => import('./pages/EspaceClient'));
const FicheClient = lazy(() => import('./pages/FicheClient'));
const Parametres = lazy(() => import('./pages/Parametres'));
const Recu = lazy(() => import('./pages/Recu'));
const TableauDeBord = lazy(() => import('./pages/TableauDeBord'));
const IntroCinetique = lazy(() => import('./components/Motion').then((m) => ({ default: m.IntroCinetique })));
const CurseurMagnetique = lazy(() => import('./components/Motion').then((m) => ({ default: m.CurseurMagnetique })));

/** L'intro n'est chargée que si elle doit jouer (1re visite de la session) ou si on la redemande. */
function IntroALaDemande() {
  const [charger, setCharger] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && !navigator.webdriver && !sessionStorage.getItem('wd-intro-vue')
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  });
  // Demandée par le bouton avant le chargement du module : l'intro démarre d'elle-même une fois chargée
  // (un événement relancé après un délai fixe arrivait parfois avant la fin du chargement).
  const [demandee, setDemandee] = useState(false);
  useEffect(() => {
    if (charger) return;
    const surRejeu = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setDemandee(true);
      setCharger(true);
    };
    window.addEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
    return () => window.removeEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
  }, [charger]);
  return charger ? <Suspense fallback={null}><IntroCinetique ouvrirAuMontage={demandee} /></Suspense> : null;
}

/** Curseur personnalisé : seulement avec une souris, sans mouvement réduit, sur grand écran. */
function CurseurALaDemande() {
  const [ok] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 861px)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return ok ? <Suspense fallback={null}><CurseurMagnetique /></Suspense> : null;
}

/** Repli pendant le chargement d'un écran : rien de visible avant 150 ms (pas de clignotement). */
function Chargement() {
  return <div className="chargement-ecran" aria-busy="true" />;
}

type Destination = { to: string; lib: string; court: string; icone: NomIcone; admin?: boolean };
const DESTINATIONS: Destination[] = [
  { to: '/', lib: 'Tableau de bord', court: 'Accueil', icone: 'accueil' },
  { to: '/clients', lib: 'Clients', court: 'Clients', icone: 'clients' },
  { to: '/dossiers', lib: 'Dossiers', court: 'Dossiers', icone: 'dossier' },
  { to: '/caisse', lib: 'Caisse', court: 'Caisse', icone: 'caisse', admin: true },
  { to: '/parametres', lib: 'Paramètres', court: 'Réglages', icone: 'reglages', admin: true },
];

type ModeTheme = 'systeme' | 'clair' | 'sombre';
const CLE_THEME = 'wd-theme';
const INFO_THEME: Record<ModeTheme, { lib: string; icone: NomIcone }> = {
  systeme: { lib: 'Auto', icone: 'moniteur' },
  clair: { lib: 'Clair', icone: 'soleil' },
  sombre: { lib: 'Sombre', icone: 'lune' },
};

function lireTheme(): ModeTheme {
  try {
    const v = localStorage.getItem(CLE_THEME);
    if (v === 'light') return 'clair';
    if (v === 'dark') return 'sombre';
  } catch {
    // Stockage local indisponible
  }
  return 'systeme';
}

function appliquerTheme(mode: ModeTheme) {
  try {
    if (mode === 'clair') {
      localStorage.setItem(CLE_THEME, 'light');
      document.documentElement.dataset.theme = 'light';
    } else if (mode === 'sombre') {
      localStorage.setItem(CLE_THEME, 'dark');
      document.documentElement.dataset.theme = 'dark';
    } else {
      localStorage.removeItem(CLE_THEME);
      delete document.documentElement.dataset.theme;
    }
  } catch {
    // Stockage local indisponible
  }
}

function themeSuivant(courant: ModeTheme): ModeTheme {
  if (courant === 'systeme') {
    const osSombre = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return osSombre ? 'clair' : 'sombre';
  }
  const osSombre = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  if (courant === 'sombre') return osSombre ? 'systeme' : 'clair';
  return osSombre ? 'sombre' : 'systeme';
}

const initiales = (nom: string) =>
  nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase() || 'WD';

function Coquille() {
  const user = useUtilisateur();
  const loc = useLocation();
  const [theme, setTheme] = useState<ModeTheme>(lireTheme);

  const changerTheme = () => {
    const suivant = themeSuivant(theme);
    appliquerTheme(suivant);
    setTheme(suivant);
  };

  // Revient en haut de page à chaque changement d'écran.
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  if (loc.pathname.startsWith('/espace/')) return <Suspense fallback={<Chargement />}><Routes><Route path="/espace/:id" element={<EspaceClient />} /></Routes></Suspense>;
  if (!user) return <Suspense fallback={<Chargement />}><Connexion /></Suspense>;
  const admin = user.role === 'admin';
  const liens = DESTINATIONS.filter((d) => !d.admin || admin);
  const infoTheme = INFO_THEME[theme];

  return (
    <div className="app">
      <a className="lien-evitement" href="#contenu" onClick={(e) => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
      <header className="topbar-mobile no-print">
        <span className="logo-medaillon logo-medaillon-sm"><img src="./logo.png" alt="" /></span>
        <b>World Destination</b>
        <button
          type="button"
          onClick={changerTheme}
          aria-label={`Changer le thème (actuel : ${infoTheme.lib})`}
          title={`Thème : ${infoTheme.lib}`}
        >
          <Icone nom={infoTheme.icone} taille={20} />
        </button>
        <button type="button" onClick={deconnexion} aria-label={`Se déconnecter (${user.nom})`} title="Se déconnecter">
          <Icone nom="sortie" taille={22} />
        </button>
      </header>
      <aside className="sidebar no-print">
        <div className="marque">
          <div className="logo-medaillon"><img src="./logo.png" alt="Logo World Destination" /></div>
          <div><b>World Destination</b><span>Gestion des dossiers</span></div>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          {liens.map((d) => (
            <NavLink key={d.to} to={d.to} end={d.to === '/'}><Icone nom={d.icone} /> {d.lib}</NavLink>
          ))}
        </nav>
        <div className="bas">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="avatar"
              aria-hidden="true"
              style={{ background: 'rgba(255, 255, 255, .14)', color: '#fff', borderColor: 'rgba(255, 255, 255, .28)' }}
            >
              {initiales(user.nom)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{user.nom}</b></div>
              <div className="role">{admin ? 'Administrateur' : 'Agent'}</div>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={changerTheme}
            aria-label={`Changer le thème (actuel : ${infoTheme.lib})`}
            title="Basculer l'apparence (Auto / Clair / Sombre)"
          >
            <Icone nom={infoTheme.icone} taille={15} />
            <span>Thème : {infoTheme.lib}</span>
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={declencherIntroCinetique}
            title="Rejouer la séquence d'ouverture"
          >
            <Icone nom="avion" taille={15} />
            <span>Animation d&apos;intro</span>
          </button>
          <button type="button" onClick={deconnexion}><Icone nom="sortie" taille={16} /> Se déconnecter</button>
        </div>
      </aside>
      <main className="contenu" id="contenu" tabIndex={-1}>
        <Suspense fallback={<Chargement />}>
        <Routes>
          <Route path="/" element={<TableauDeBord />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<FicheClient />} />
          <Route path="/dossiers" element={<Dossiers />} />
          <Route path="/dossiers/:id" element={<DossierDetail />} />
          <Route path="/dossiers/:id/recu/:paiementId" element={<Recu />} />
          {admin && <Route path="/caisse" element={<Caisse />} />}
          {admin && <Route path="/parametres" element={<Parametres />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </main>
      <nav className="barre-onglets no-print" aria-label="Navigation principale (mobile)">
        {liens.map((d) => (
          <NavLink key={d.to} to={d.to} end={d.to === '/'} aria-label={d.court === d.lib ? undefined : `${d.court} – ${d.lib}`}><Icone nom={d.icone} /><span>{d.court}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <IntroALaDemande />
      <CurseurALaDemande />
      <AnneauDefilement />
      {!modeEnLigne && (
        <div className="bandeau-demo no-print" role="note">
          <Icone nom="alerte" taille={16} /> Version de démonstration — ne saisissez pas de vrais clients
        </div>
      )}
      <Coquille />
      <ZoneToast />
    </HashRouter>
  );
}
