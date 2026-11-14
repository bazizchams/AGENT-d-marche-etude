import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Modale, Vide, tenter } from '../components/ui';
import { date, formatSoldes, nomClient, soldes } from '../lib/regles';
import { creerClient, ouvrirDossier, useBase, useUtilisateur } from '../lib/store';
import type { Langue } from '../lib/types';

export function normaliser(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function Clients() {
  const base = useBase();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const nouveau = params.get('nouveau') === '1';

  const n = normaliser(q.trim());
  const chiffres = q.replace(/\D/g, '');
  const liste = base.clients
    .filter((c) => {
      if (!n) return true;
      const dossiers = base.dossiers.filter((d) => d.clientId === c.id);
      return normaliser(`${c.prenom} ${c.nom} ${c.email}`).includes(n)
        || (chiffres.length >= 3 && c.telephone.replace(/\D/g, '').includes(chiffres))
        || dossiers.some((d) => normaliser(d.numero).includes(n));
    })
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe));

  return (
    <>
      <div className="entete">
        <div><h1>Clients</h1><div className="muted">{base.clients.length} clients</div></div>
        <button className="btn-primaire" onClick={() => setParams({ nouveau: '1' })}>＋ Nouveau client</button>
      </div>
      <div className="carte">
        <div className="champ recherche">
          <label htmlFor="q">Rechercher</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone ou n° de dossier" />
        </div>
        {liste.length === 0 ? (
          <Vide>{q ? <>Aucun client ne correspond à « {q} ». <button className="btn-petit" onClick={() => setQ('')}>Effacer la recherche</button></> : 'Aucun client pour le moment.'}</Vide>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Client</th><th>Téléphone</th><th>Dossiers</th><th className="num">Reste à payer</th><th>Créé le</th></tr></thead>
              <tbody>
                {liste.map((c) => {
                  const ds = base.dossiers.filter((d) => d.clientId === c.id);
                  const reste: ReturnType<typeof soldes> = {};
                  ds.filter((d) => d.statut !== 'annule').forEach((d) => {
                    const s = soldes(d);
                    for (const k of Object.keys(s) as (keyof typeof s)[]) {
                      reste[k] = { du: 0, paye: 0, reste: (reste[k]?.reste ?? 0) + s[k]!.reste };
                    }
                  });
                  return (
                    <tr key={c.id} className="cliquable" onClick={() => nav(`/clients/${c.id}`)}>
                      <td><Link to={`/clients/${c.id}`}><b>{nomClient(c)}</b></Link>{c.langue === 'ar' && <span className="badge b-gris" style={{ marginLeft: 6 }}>عربي</span>}</td>
                      <td>{c.telephone}</td>
                      <td className="petit">{ds.map((d) => base.modeles.find((m) => m.id === d.modeleId)?.nom).join(', ') || '—'}</td>
                      <td className="num">{formatSoldes(reste, 'reste')}</td>
                      <td className="petit muted">{date(c.creeLe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {nouveau && <NouveauClient onFermer={() => setParams({})} />}
    </>
  );
}

function NouveauClient({ onFermer }: { onFermer: () => void }) {
  const base = useBase();
  const user = useUtilisateur()!;
  const nav = useNavigate();
  const modeles = base.modeles.filter((m) => m.actif);
  const agents = base.utilisateurs.filter((u) => u.actif && u.role !== 'client');
  const [f, setF] = useState({
    prenom: '', nom: '', telephone: '', email: '', dateNaissance: '', adresse: '', langue: 'fr' as Langue,
    modeleId: modeles[0]?.id ?? '', intitule: '', agentId: user.id,
  });
  const [touche, setTouche] = useState<Record<string, boolean>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const erreurs: Record<string, string> = {};
  if (!f.prenom.trim()) erreurs.prenom = 'Saisissez le prénom.';
  if (!f.nom.trim()) erreurs.nom = 'Saisissez le nom.';
  if (f.telephone.replace(/\D/g, '').length < 9) erreurs.telephone = 'Saisissez un numéro complet, par ex. 0550 12 34 56.';
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) erreurs.email = "Vérifiez l'adresse e-mail (exemple : nom@gmail.com).";
  const doublon = base.clients.find((c) => c.telephone.replace(/\D/g, '').slice(-9) === f.telephone.replace(/\D/g, '').slice(-9) && f.telephone.replace(/\D/g, '').length >= 9);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    setTouche({ prenom: true, nom: true, telephone: true, email: true });
    if (Object.keys(erreurs).length) return;
    tenter(() => {
      const tel = f.telephone.replace(/\D/g, '').replace(/^0/, '213');
      const c = creerClient({
        prenom: f.prenom.trim(), nom: f.nom.trim(), telephone: tel, email: f.email.trim(),
        dateNaissance: f.dateNaissance || undefined, adresse: f.adresse || undefined, langue: f.langue,
      });
      if (f.modeleId) {
        const d = ouvrirDossier(c.id, f.modeleId, f.agentId, f.intitule);
        nav(`/dossiers/${d.id}`, { replace: true });
      } else {
        nav(`/clients/${c.id}`, { replace: true });
      }
    }, 'Client créé');
  };

  const Champ = ({ k, lib, type = 'text', aide }: { k: keyof typeof f; lib: string; type?: string; aide?: string }) => (
    <div className="champ">
      <label htmlFor={k}>{lib}</label>
      <input id={k} type={type} value={f[k]} onChange={set(k)} onBlur={() => setTouche({ ...touche, [k]: true })} aria-invalid={!!(touche[k] && erreurs[k])} />
      {touche[k] && erreurs[k] ? <div className="erreur">{erreurs[k]}</div> : aide ? <div className="petit muted">{aide}</div> : null}
    </div>
  );

  return (
    <Modale titre="Nouveau client" onFermer={onFermer} large>
      <form onSubmit={valider} noValidate>
        <div className="grille g2" style={{ gap: '0 16px' }}>
          {Champ({ k: 'prenom', lib: 'Prénom' })}
          {Champ({ k: 'nom', lib: 'Nom' })}
          {Champ({ k: 'telephone', lib: 'Téléphone (WhatsApp)', type: 'tel' })}
          {Champ({ k: 'email', lib: 'E-mail (pour l’accès à l’espace client)', type: 'email', aide: 'Facultatif, mais nécessaire pour l’espace client.' })}
          {Champ({ k: 'dateNaissance', lib: 'Date de naissance', type: 'date' })}
          <div className="champ">
            <label htmlFor="langue">Langue du client</label>
            <select id="langue" value={f.langue} onChange={set('langue')}>
              <option value="fr">Français</option>
              <option value="ar">العربية (arabe)</option>
            </select>
          </div>
        </div>
        {doublon && <div className="alerte alerte-orange">Un client avec ce numéro existe déjà : <Link to={`/clients/${doublon.id}`} onClick={onFermer}>{nomClient(doublon)}</Link>. Pour un nouveau dossier, ouvrez-le depuis sa fiche.</div>}
        <h3 style={{ marginTop: 8 }}>Premier dossier</h3>
        <div className="grille g2" style={{ gap: '0 16px' }}>
          <div className="champ">
            <label htmlFor="modeleId">Type de dossier</label>
            <select id="modeleId" value={f.modeleId} onChange={set('modeleId')}>
              {modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              <option value="">Pas de dossier pour l'instant</option>
            </select>
          </div>
          <div className="champ">
            <label htmlFor="agentId">Agent responsable</label>
            <select id="agentId" value={f.agentId} onChange={set('agentId')}>
              {agents.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </div>
        </div>
        {f.modeleId && Champ({ k: 'intitule', lib: 'Précision (facultatif)', aide: 'Ex. : « Master informatique 2027 », « Visa tourisme Espagne ».' })}
        <div className="pied">
          <button type="button" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn-primaire">{f.modeleId ? 'Créer le client et ouvrir le dossier' : 'Créer le client'}</button>
        </div>
      </form>
    </Modale>
  );
}
