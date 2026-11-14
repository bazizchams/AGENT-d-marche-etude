import { useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ZoneToast } from './components/ui';
import { deconnexion, useUtilisateur } from './lib/store';
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

function Coquille() {
  const user = useUtilisateur();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  if (loc.pathname.startsWith('/espace/')) return <Routes><Route path="/espace/:id" element={<EspaceClient />} /></Routes>;
  if (!user) return <Connexion />;
  const admin = user.role === 'admin';
  const fermer = () => setMenu(false);
  return (
    <div className="app">
      <div className="topbar-mobile no-print">
        <button aria-label="Ouvrir le menu" onClick={() => setMenu(true)}>☰</button>
        <img src="./logo.png" alt="" />
        <b>World Destination</b>
      </div>
      {menu && <div className="voile" onClick={fermer} />}
      <aside className={`sidebar no-print ${menu ? 'ouverte' : ''}`}>
        <div className="marque">
          <img src="./logo.png" alt="Logo World Destination" />
          <div><b>World Destination</b><span>Gestion des dossiers</span></div>
        </div>
        <nav className="nav" onClick={fermer}>
          <NavLink to="/" end>🏠 Tableau de bord</NavLink>
          <NavLink to="/clients">👥 Clients</NavLink>
          <NavLink to="/dossiers">📁 Dossiers</NavLink>
          {admin && <NavLink to="/caisse">💰 Caisse</NavLink>}
          {admin && <NavLink to="/parametres">⚙️ Paramètres</NavLink>}
        </nav>
        <div className="bas">
          <div><b>{user.nom}</b></div>
          <div style={{ opacity: .8 }}>{admin ? 'Administrateur' : 'Agent'}</div>
          <button onClick={deconnexion}>Se déconnecter</button>
        </div>
      </aside>
      <main className="contenu">
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
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Coquille />
      <ZoneToast />
    </HashRouter>
  );
}
