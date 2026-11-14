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
  },
  ar: {
    titre: '', titreClient: 'فضاء الزبون', email: 'البريد الإلكتروني', mdp: '', entrer: '',
    lien: 'استلام رابط الدخول عبر البريد الإلكتروني', envoye: 'إذا كان هذا البريد معروفًا لدى الوكالة، فقد أُرسل إليه رابط الدخول. افتحوا بريدكم الإلكتروني (تحققوا من الرسائل غير المرغوب فيها).',
    aideClient: 'أدخلوا البريد الإلكتروني الذي قدمتموه للوكالة: ستتلقون رابطًا لفتح فضائكم دون كلمة مرور.',
    chargement: 'جارٍ التحميل…', emailInvalide: 'أدخلوا بريدًا إلكترونيًا صحيحًا.',
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
      <div className="carte" style={{ textAlign: 'left' }}>
        <h1>Double authentification</h1>
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
            {mfa.etape === 'enrolement' && mfa.obligatoire && <div className="alerte alerte-orange">Obligatoire pour les comptes administrateur.</div>}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            <div className="pied">
              {mfa.etape === 'enrolement' && !mfa.obligatoire && <button type="button" onClick={() => void agir(reporterMfa)} disabled={occupe}>Plus tard</button>}
              <button type="button" className="btn-primaire" onClick={() => void agir(async () => setQr(await commencerEnrolementMfa()))} disabled={occupe}>Activer maintenant</button>
            </div>
          </>
        ) : (
          <form onSubmit={valider}>
            <p className="petit">1. Dans l'application, choisissez « Ajouter un compte » puis scannez ce code :</p>
            <img src={qr.qrCode} alt="QR code d'activation" width={180} height={180} style={{ display: 'block', margin: '8px auto', background: '#fff' }} />
            <p className="muted petit">Pas d'appareil photo ? Saisissez cette clé : <code dir="ltr">{qr.secret}</code></p>
            <p className="petit">2. Saisissez le code affiché :</p>
            {champCode}
            {erreur && <div className="erreur" role="alert">{erreur}</div>}
            <div className="pied"><button type="button" onClick={deconnexion}>Annuler</button><button type="submit" className="btn-primaire" disabled={occupe}>Confirmer</button></div>
          </form>
        )}
      </div>
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

  if (chargement) return <div className="connexion"><div className="carte">{t.chargement}</div></div>;
  if (!client && mfa.etape !== 'aucune') return <EtapeMfa />;

  return (
    <div className="connexion" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'fr'}>
      <div className="carte">
        <img src="./logo.png" alt="Logo World Destination" />
        <h1>World Destination</h1>
        <p className="muted">{client ? t.titreClient : t.titre}</p>
        {client && (
          <p>
            <button type="button" className="btn-petit" onClick={() => setLangue(ar ? 'fr' : 'ar')}>{ar ? 'Français' : 'العربية'}</button>
          </p>
        )}
        <form onSubmit={client ? parLien : avecMotDePasse} style={{ textAlign: ar ? 'right' : 'left' }}>
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
          {message && <div className="alerte alerte-bleu" role="status">{message}</div>}
          <div className="pied" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {!client && <button type="submit" className="btn-primaire" disabled={occupe || !mdp}>{t.entrer}</button>}
            <button type={client ? 'submit' : 'button'} className={client ? 'btn-primaire' : ''} disabled={occupe} onClick={client ? undefined : () => parLien()}>{t.lien}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
