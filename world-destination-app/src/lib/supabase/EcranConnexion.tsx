/**
 * Écran de connexion de la version en ligne (personnel et clients).
 * - Personnel : e-mail + mot de passe, ou lien de connexion reçu par e-mail.
 * - Client : lien de connexion par e-mail uniquement (pas de mot de passe).
 * À afficher à la place du choix de profil de démonstration quand `modeEnLigne` est vrai :
 *   if (modeEnLigne) return <EcranConnexion />;          (dans src/pages/Connexion.tsx)
 *   if (modeEnLigne && !d) return <EcranConnexion client />;   (dans src/pages/EspaceClient.tsx)
 */
import { useState, type FormEvent } from 'react';
import { connexionMotDePasse, envoyerLienMagique, useChargement } from '../store';

const T = {
  fr: {
    titre: 'Gestion des dossiers clients', titreClient: 'Votre espace client', email: 'Adresse e-mail', mdp: 'Mot de passe',
    entrer: 'Se connecter', lien: 'Recevoir un lien de connexion par e-mail', envoye: 'Lien envoyé. Ouvrez votre boîte e-mail (pensez aux courriers indésirables) et cliquez sur le lien.',
    aideClient: "Saisissez l'adresse e-mail donnée à l'agence : vous recevrez un lien pour ouvrir votre espace, sans mot de passe.",
    chargement: 'Chargement…', emailInvalide: 'Saisissez une adresse e-mail valide.',
  },
  ar: {
    titre: '', titreClient: 'فضاء الزبون', email: 'البريد الإلكتروني', mdp: '', entrer: '',
    lien: 'استلام رابط الدخول عبر البريد الإلكتروني', envoye: 'تم إرسال الرابط. افتحوا بريدكم الإلكتروني (تحققوا من الرسائل غير المرغوب فيها) واضغطوا على الرابط.',
    aideClient: 'أدخلوا البريد الإلكتروني الذي قدمتموه للوكالة: ستتلقون رابطًا لفتح فضائكم دون كلمة مرور.',
    chargement: 'جارٍ التحميل…', emailInvalide: 'أدخلوا بريدًا إلكترونيًا صحيحًا.',
  },
};

export default function EcranConnexion({ client = false }: { client?: boolean }) {
  const chargement = useChargement();
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
