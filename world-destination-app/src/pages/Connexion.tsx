import { Icone } from '../components/Icone';
import EcranConnexion from '../lib/supabase/EcranConnexion';
import { connexion, modeEnLigne, useBase } from '../lib/store';

export default function Connexion() {
  if (modeEnLigne) return <EcranConnexion />;
  return <ConnexionDemo />;
}

function ConnexionDemo() {
  const base = useBase();
  return (
    <div className="connexion">
      <div className="carte">
        <img className="logo" src="./logo.png" alt="Logo World Destination" />
        <h1>World Destination</h1>
        <p className="muted">Gestion des dossiers clients</p>
        <div className="alerte alerte-bleu">
          <Icone nom="info" />
          <div><b>Version de démonstration.</b> Les données sont fictives et restent dans ce navigateur.
          Dans la version en ligne, chaque membre de l'équipe se connecte avec son e-mail.</div>
        </div>
        <div className="choix">
          <h2 className="petit muted" style={{ margin: 0 }}>Se connecter en tant que :</h2>
          {base.utilisateurs.filter((u) => u.actif).map((u) => (
            <button type="button" key={u.id} onClick={() => connexion(u.id)}>
              <span>{u.nom}</span>
              <span className={`badge ${u.role === 'admin' ? 'b-orange' : 'b-bleu'}`}>{u.role === 'admin' ? 'Administrateur' : 'Agent'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
