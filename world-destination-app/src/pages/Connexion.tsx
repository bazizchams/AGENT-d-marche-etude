import { Icone } from '../components/Icone';
import {
  AvionTrajectoire,
  BandeauMarquee,
  declencherIntroCinetique,
  EntreePage,
  SceauRotatif,
  StaggerGrille,
  TitreCinetique,
} from '../components/Motion';
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
      <EntreePage className="connexion-split">
        <section className="connexion-hero" aria-label="Présentation World Destination">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 200px' }}>
              <div className="logo-medaillon logo-medaillon-lg" style={{ flexShrink: 0 }}>
                <img src="./logo.png" alt="Logo World Destination" />
              </div>
              <div style={{ minWidth: 0 }}>
                <TitreCinetique as="h1" texte="World Destination" />
                <p>Gestion des dossiers clients</p>
              </div>
            </div>
            <SceauRotatif taille={84} />
          </div>
          <AvionTrajectoire className="avion-trajectoire" variant="hero" />
          <BandeauMarquee />
          <p className="petit" style={{ opacity: 0.9 }}>
            Suivi centralisé des visas, études à l’étranger, documents clients et encaissements.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="theme-toggle btn-capsule"
              style={{ width: 'fit-content' }}
              onClick={declencherIntroCinetique}
            >
              <span>Animation d&apos;intro</span>
              <span className="capsule-fleche" aria-hidden="true">↗</span>
            </button>
          </div>
        </section>

        <section className="connexion-corps">
          <div className="alerte alerte-bleu">
            <Icone nom="info" />
            <div>
              <b>Version de démonstration.</b> Les données sont fictives et restent dans ce navigateur.
              Dans la version en ligne, chaque membre de l'équipe se connecte avec son e-mail.
            </div>
          </div>
          <div className="choix">
            <h2 className="petit muted" style={{ margin: 0 }}>Se connecter en tant que :</h2>
            <StaggerGrille style={{ display: 'grid', gap: 'var(--esp-2)' }}>
              {base.utilisateurs.filter((u) => u.actif).map((u) => (
                <button
                  type="button"
                  key={u.id}
                  className="choix-carte"
                  data-cursor="Entrer ↗"
                  onClick={() => connexion(u.id)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="avatar" aria-hidden="true">
                      <Icone nom={u.role === 'admin' ? 'bouclier' : 'utilisateur'} taille={16} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nom}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className={`badge ${u.role === 'admin' ? 'b-orange' : 'b-bleu'}`}>
                      {u.role === 'admin' ? 'Administrateur' : 'Agent'}
                    </span>
                    <span className="capsule-fleche" aria-hidden="true">↗</span>
                  </span>
                </button>
              ))}
            </StaggerGrille>
          </div>
        </section>
      </EntreePage>
    </div>
  );
}
