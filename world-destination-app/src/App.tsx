import { useEffect } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icone } from './components/Icone';
import type { NomIcone } from './components/Icone';
import { ZoneToast } from './components/ui';
import { deconnexion, modeEnLigne, useUtilisateur } from './lib/store';
import Caisse from './pages/Caisse';
import Clients from './pages/Clients';
import Connexion from './pages/Connexion';
import DossierDetail from './pages/DossierDetail';
import Dossiers from './pages/Dossiers';
import EspaceClient from './pages/EspaceClient';
import FicheClient from './pages/FicheClient';
import Parametres from './pages/Parametres';
import Recu from './pages/Recu';
import TableauDeBord from './pages/TableauDeBord';

type Destination = { to: string; lib: string; court: string; icone: NomIcone; admin?: boolean };
const DESTINATIONS: Destination[] = [
  { to: '/', lib: 'Tableau de bord', court: 'Accueil', icone: 'accueil' },
  { to: '/clients', lib: 'Clients', court: 'Clients', icone: 'clients' },
  { to: '/dossiers', lib: 'Dossiers', court: 'Dossiers', icone: 'dossier' },
  { to: '/caisse', lib: 'Caisse', court: 'Caisse', icone: 'caisse', admin: true },
  { to: '/parametres', lib: 'Paramètres', court: 'Réglages', icone: 'reglages', admin: true },
];

function Coquille() {
  const user = useUtilisateur();
  const loc = useLocation();
  // Revient en haut de page et place le focus sur le contenu à chaque changement d'écran.
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  if (loc.pathname.startsWith('/espace/')) return <Routes><Route path="/espace/:id" element={<EspaceClient />} /></Routes>;
  if (!user) return <Connexion />;
  const admin = user.role === 'admin';
  const liens = DESTINATIONS.filter((d) => !d.admin || admin);
  return (
    <div className="app">
      <a className="lien-evitement" href="#contenu" onClick={(e) => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
      <header className="topbar-mobile no-print">
        <img src="./logo.png" alt="" />
        <b>World Destination</b>
        <button type="button" onClick={deconnexion} aria-label={`Se déconnecter (${user.nom})`} title="Se déconnecter"><Icone nom="sortie" taille={22} /></button>
      </header>
      <aside className="sidebar no-print">
        <div className="marque">
          <img src="./logo.png" alt="Logo World Destination" />
          <div><b>World Destination</b><span>Gestion des dossiers</span></div>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          {liens.map((d) => (
            <NavLink key={d.to} to={d.to} end={d.to === '/'}><Icone nom={d.icone} /> {d.lib}</NavLink>
          ))}
        </nav>
        <div className="bas">
          <div><b>{user.nom}</b></div>
          <div className="role">{admin ? 'Administrateur' : 'Agent'}</div>
          <button type="button" onClick={deconnexion}><Icone nom="sortie" taille={16} /> Se déconnecter</button>
        </div>
      </aside>
      <main className="contenu" id="contenu" tabIndex={-1}>
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
