/**
 * Écran de connexion de la version en ligne (personnel et clients).
 * - Personnel : e-mail + mot de passe, ou lien de connexion reçu par e-mail.
 * - Client : lien de connexion par e-mail uniquement (pas de mot de passe).
 * - Administrateur : code à 6 chiffres (double authentification) après le mot de passe ou le lien.
 * À afficher à la place du choix de profil de démonstration quand `modeEnLigne` est vrai :
 *   if (modeEnLigne) return <EcranConnexion />;          (dans src/pages/Connexion.tsx)
 *   if (modeEnLigne && !d) return <EcranConnexion client />;   (dans src/pages/EspaceClient.tsx)
 */
import { useState, type FormEvent } from 'react';
import { Icone } from '../../components/Icone';
import {
  AvionTrajectoire,
  BandeauMarquee,
  declencherIntroCinetique,
  EntreePage,
  SceauRotatif,
  TitreCinetique,
} from '../../components/Motion';
import {
  commencerEnrolementMfa, confirmerEnrolementMfa, connexionMotDePasse, deconnexion, envoyerLienMagique, reporterMfa,
  useChargement, useEtatMfa, verifierCodeMfa,
} from '../store';

const T = {
  fr: {
    titre: 'Gestion des dossiers clients', titreClient: 'Votre espace client', email: 'Adresse e-mail', mdp: 'Mot de passe',
    entrer: 'Se connecter', lien: 'Recevoir un lien de connexion par e-mail', envoye: "Si cette adresse est connue de l'agence, un lien de connexion vient d'être envoyé. Ouvrez votre boîte e-mail (pensez aux courriers indésirables).",
    aideClient: "Saisissez l'adresse e-mail donnée à l'agence : vous recevrez un lien pour ouvrir votre espace, sans mot de passe.",
    chargement: 'Chargement…', emailInvalide: 'Saisissez une adresse e-mail valide.',
    accrocheStaff: 'Espace sécurisé pour le suivi des dossiers, des pièces justificatives et des encaissements.',
    accrocheClient: 'Suivez l’avancement de votre dossier, envoyez vos pièces et consultez vos paiements.',
  },
  ar: {
    titre: '', titreClient: 'فضاء الزبون', email: 'البريد الإلكتروني', mdp: '', entrer: '',
    lien: 'استلام رابط الدخول عبر البريد الإلكتروني', envoye: 'إذا كان هذا البريد معروفًا لدى الوكالة، فقد أُرسل إليه رابط الدخول. افتحوا بريدكم الإلكتروني (تحققوا من الرسائل غير المرغوب فيها).',
    aideClient: 'أدخلوا البريد الإلكتروني الذي قدمتموه للوكالة: ستتلقون رابطًا لفتح فضائكم دون كلمة مرور.',
    chargement: 'جارٍ التحميل…', emailInvalide: 'أدخلوا بريدًا إلكترونيًا صحيحًا.',
    accrocheStaff: '',
    accrocheClient: 'تابعوا تقدّم ملفكم، وأرسلوا وثائقكم، واطّلعوا على مدفوعاتكم بكل سهولة.',
  },
};

/** Étape de double authentification des administrateurs (code à 6 chiffres d'une application sur téléphone). */
function EtapeMfa() {
  const mfa = useEtatMfa();
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<{ qrCode: string; secret: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const agir = async (fn: () => Promise<unknown>) => {
    setErreur(''); setOccupe(true);
    try { await fn(); } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); } finally { setOccupe(false); }
  };
  const valider = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) { setErreur('Saisissez les 6 chiffres affichés.'); return; }
    void agir(() => (mfa.etape === 'verification' ? verifierCodeMfa(code) : confirmerEnrolementMfa(code)));
  };
  const champCode = (
    <div className="champ">
      <label htmlFor="wd-code">Code à 6 chiffres</label>
      <input id="wd-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
    </div>
  );
  return (
    <div className="connexion">
      <EntreePage className="carte" style={{ textAlign: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--esp-3)' }}>
          <span className="logo-medaillon logo-medaillon-sm"><img src="./logo.png" alt="" /></span>
          <h1 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icone nom="bouclier" taille={20} /> Double authentification
          </h1>
        </div>
        {mfa.etape === 'verification' ? (
          <form onSubmit={valider}>
            <p className="muted petit">Ouvrez l'application d'authentification de votre téléphone et saisissez le code « World Destination ».</p>
            {champCode}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            <div className="pied"><button type="button" onClick={deconnexion}>Annuler</button><button type="submit" className="btn-primaire" disabled={occupe}>Valider</button></div>
          </form>
        ) : !qr ? (
          <>
            <p>Pour protéger les dossiers, un administrateur confirme sa connexion avec un code à 6 chiffres affiché par une application gratuite (Google Authenticator, Microsoft Authenticator…).</p>
            {mfa.etape === 'enrolement' && mfa.obligatoire && <div className="alerte alerte-orange"><Icone nom="alerte" /><span>Obligatoire pour les comptes administrateur.</span></div>}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            <div className="pied">
              {mfa.etape === 'enrolement' && !mfa.obligatoire && <button type="button" onClick={() => void agir(reporterMfa)} disabled={occupe}>Plus tard</button>}
              <button type="button" className="btn-primaire" onClick={() => void agir(async () => setQr(await commencerEnrolementMfa()))} disabled={occupe}>Activer maintenant</button>
            </div>
          </>
        ) : (
          <form onSubmit={valider}>
            <p className="petit">1. Dans l'application, choisissez « Ajouter un compte » puis scannez ce code :</p>
            <img src={qr.qrCode} alt="QR code d'activation" width={180} height={180} style={{ display: 'block', margin: '8px auto', background: '#fff', padding: 6, borderRadius: 'var(--rayon-m)' }} />
            <p className="muted petit">Pas d'appareil photo ? Saisissez cette clé : <code dir="ltr">{qr.secret}</code></p>
            <p className="petit">2. Saisissez le code affiché :</p>
            {champCode}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            <div className="pied"><button type="button" onClick={deconnexion}>Annuler</button><button type="submit" className="btn-primaire" disabled={occupe}>Confirmer</button></div>
          </form>
        )}
      </EntreePage>
    </div>
  );
}

export default function EcranConnexion({ client = false }: { client?: boolean }) {
  const chargement = useChargement();
  const mfa = useEtatMfa();
  const [langue, setLangue] = useState<'fr' | 'ar'>('fr');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const t = client ? T[langue] : T.fr;
  const ar = client && langue === 'ar';

  const executer = async (fn: () => Promise<void>, succes = '') => {
    setErreur(''); setMessage('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErreur(t.emailInvalide); return; }
    setOccupe(true);
    try { await fn(); setMessage(succes); } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); } finally { setOccupe(false); }
  };
  const avecMotDePasse = (e: FormEvent) => { e.preventDefault(); void executer(() => connexionMotDePasse(email, mdp)); };
  const parLien = (e?: FormEvent) => { e?.preventDefault(); void executer(() => envoyerLienMagique(email), t.envoye); };

  if (chargement) {
    return (
      <div className="connexion">
        <div className="carte" style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <span className="logo-medaillon"><img src="./logo.png" alt="Logo World Destination" /></span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icone nom="sablier" /><span>{t.chargement}</span></div>
        </div>
      </div>
    );
  }
  if (!client && mfa.etape !== 'aucune') return <EtapeMfa />;

  return (
    <div className={ar ? 'connexion rtl' : 'connexion'} dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'fr'}>
      <EntreePage className="connexion-split">
        <section className="connexion-hero">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 200px' }}>
              <div className="logo-medaillon logo-medaillon-lg" style={{ flexShrink: 0 }}>
                <img src="./logo.png" alt="Logo World Destination" />
              </div>
              <div style={{ minWidth: 0 }}>
                <TitreCinetique as="h1" texte="World Destination" />
                <p>{client ? t.titreClient : t.titre}</p>
              </div>
            </div>
            <SceauRotatif taille={84} />
          </div>
          <AvionTrajectoire className="avion-trajectoire" variant="hero" />
          <BandeauMarquee />
          <p className="petit" style={{ opacity: 0.9 }}>
            {client ? t.accrocheClient : t.accrocheStaff}
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
          {client && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--esp-3)' }}>
              <button type="button" className="btn-petit" onClick={() => setLangue(ar ? 'fr' : 'ar')}>
                <Icone nom="globe" taille={15} /> {ar ? 'Français' : 'العربية'}
              </button>
            </div>
          )}
          <form onSubmit={client ? parLien : avecMotDePasse}>
            {client && <p className="muted petit">{t.aideClient}</p>}
            <div className="champ">
              <label htmlFor="wd-email">{t.email}</label>
              <input id="wd-email" type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {!client && (
              <div className="champ">
                <label htmlFor="wd-mdp">{t.mdp}</label>
                <input id="wd-mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
              </div>
            )}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            {message && <div className="alerte alerte-bleu" role="status"><Icone nom="info" /><span>{message}</span></div>}
            <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 'var(--esp-4)' }}>
              {!client && <button type="submit" className="btn-primaire" style={{ justifyContent: 'center' }} disabled={occupe || !mdp}>{t.entrer}</button>}
              <button type={client ? 'submit' : 'button'} className={client ? 'btn-primaire' : ''} style={{ justifyContent: 'center' }} disabled={occupe} onClick={client ? undefined : () => parLien()}>
                <Icone nom="courriel" taille={16} /> {t.lien}
              </button>
            </div>
          </form>
        </section>
      </EntreePage>
    </div>
  );
}
