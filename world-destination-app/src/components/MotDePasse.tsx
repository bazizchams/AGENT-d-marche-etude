import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { changerMotDePasse, modeEnLigne } from '../lib/store';
import { Icone } from './Icone';
import { Modale, notifier } from './ui';

/** Règles imposées aussi par Supabase : au moins 12 caractères, une minuscule, une majuscule, un chiffre. */
function problemes(mdp: string): string[] {
  const p: string[] = [];
  if (mdp.length < 12) p.push('au moins 12 caractères');
  if (!/[a-z]/.test(mdp)) p.push('une minuscule');
  if (!/[A-Z]/.test(mdp)) p.push('une majuscule');
  if (!/[0-9]/.test(mdp)) p.push('un chiffre');
  return p;
}

/**
 * « Mon mot de passe » : permet au personnel de choisir ou changer son mot de passe
 * (après une invitation ou un lien de connexion reçu par e-mail, ou en cas d'oubli).
 * Version en ligne uniquement.
 */
export function BoutonMotDePasse({ icone = false }: { icone?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  // Arrivée par un lien « Mot de passe oublié » : la fenêtre s'ouvre d'elle-même (une seule instance : le bouton texte).
  useEffect(() => {
    if (!modeEnLigne || icone) return;
    try { if (sessionStorage.getItem('wd-mdp-a-choisir')) setOuvert(true); } catch { /* ignore */ }
  }, [icone]);
  if (!modeEnLigne) return null;
  return (
    <>
      {icone ? (
        <button type="button" onClick={() => setOuvert(true)} aria-label="Changer mon mot de passe" title="Mon mot de passe">
          <Icone nom="cadenas" taille={20} />
        </button>
      ) : (
        <button type="button" onClick={() => setOuvert(true)}><Icone nom="cadenas" taille={16} /> Mon mot de passe</button>
      )}
      {ouvert && createPortal(<ModaleMotDePasse onFermer={() => setOuvert(false)} />, document.body)}
    </>
  );
}

function ModaleMotDePasse({ onFermer }: { onFermer: () => void }) {
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [voir, setVoir] = useState(false);
  const [touche, setTouche] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const manque = problemes(mdp);
  const different = confirmation !== '' && confirmation !== mdp;
  const valide = manque.length === 0 && confirmation === mdp;

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouche(true);
    if (!valide) return;
    setOccupe(true);
    setErreur('');
    try {
      await changerMotDePasse(mdp);
      notifier('Mot de passe enregistré. Utilisez-le à votre prochaine connexion.');
      onFermer();
    } catch (err) {
      const m = err instanceof Error ? err.message : '';
      setErreur(/reauth|nonce|recent/i.test(m)
        ? 'Par sécurité, reconnectez-vous avec un lien reçu par e-mail, puis changez votre mot de passe tout de suite.'
        : m || "Le mot de passe n'a pas pu être enregistré. Réessayez.");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Modale titre="Mon mot de passe" onFermer={onFermer}>
      <form onSubmit={enregistrer} noValidate>
        <p className="muted petit">Choisissez un mot de passe que vous êtes seul à connaître. Il vous servira à vous connecter sans lien par e-mail.</p>
        <div className="champ">
          <label htmlFor="mdp-nouveau">Nouveau mot de passe</label>
          <input id="mdp-nouveau" type={voir ? 'text' : 'password'} autoComplete="new-password" value={mdp}
            onChange={(e) => setMdp(e.target.value)} onBlur={() => setTouche(true)} aria-describedby="mdp-regles" aria-invalid={touche && manque.length > 0} />
          <div id="mdp-regles" className={touche && manque.length ? 'erreur' : 'petit muted'}>
            {manque.length ? `Il manque : ${manque.join(', ')}.` : 'Le mot de passe respecte les règles ✓'}
          </div>
        </div>
        <div className="champ">
          <label htmlFor="mdp-confirmation">Confirmer le mot de passe</label>
          <input id="mdp-confirmation" type={voir ? 'text' : 'password'} autoComplete="new-password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} aria-invalid={different} />
          {different && <div className="erreur">Les deux mots de passe ne sont pas identiques.</div>}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
          <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} /> Afficher le mot de passe
        </label>
        {erreur && <div className="alerte alerte-rouge" role="alert" style={{ marginTop: 12 }}>{erreur}</div>}
        <div className="pied">
          <button type="button" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn-primaire" disabled={occupe || !valide}>{occupe ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</button>
        </div>
      </form>
    </Modale>
  );
}
