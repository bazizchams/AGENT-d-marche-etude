import { connexion, useBase } from '../lib/store';

export default function Connexion() {
  const base = useBase();
  return (
    <div className="connexion">
      <div className="carte">
        <img src="./logo.png" alt="Logo World Destination" />
        <h1>World Destination</h1>
        <p className="muted">Gestion des dossiers clients</p>
        <div className="alerte alerte-bleu" style={{ textAlign: 'left' }}>
          <b>Version de démonstration.</b> Les données sont fictives et restent dans ce navigateur.
          Dans la version en ligne, chaque membre de l'équipe se connecte avec son e-mail.
        </div>
        <div className="choix">
          <label>Se connecter en tant que :</label>
          {base.utilisateurs.filter((u) => u.actif).map((u) => (
            <button key={u.id} onClick={() => connexion(u.id)}>
              <span>{u.nom}</span>
              <span className={`badge ${u.role === 'admin' ? 'b-orange' : 'b-bleu'}`}>{u.role === 'admin' ? 'Administrateur' : 'Agent'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
