import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { Barre, BadgeDossier, Modale, Vide, tenter } from '../components/ui';
import { date, formatSoldes, nomClient, progression, soldes } from '../lib/regles';
import { majClient, ouvrirDossier, useBase, useUtilisateur } from '../lib/store';
import type { Client, Langue } from '../lib/types';

export default function FicheClient() {
  const { id } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const [edition, setEdition] = useState(false);
  const [nouveauDossier, setNouveauDossier] = useState(false);
  const c = base.clients.find((x) => x.id === id);
  if (!c) return <Vide icone="clients" action={<Link className="btn btn-petit" to="/clients">Retour à la liste des clients</Link>}>Ce client n'existe pas ou a été supprimé.</Vide>;
  const dossiers = base.dossiers.filter((d) => d.clientId === c.id).sort((a, b) => b.ouvertLe.localeCompare(a.ouvertLe));

  return (
    <>
      <div className="entete">
        <div>
          <Link className="fil" to="/clients"><Icone nom="retour" taille={16} /> Clients</Link>
          <h1>{nomClient(c)}</h1>
          <div className="muted">Client depuis le {date(c.creeLe)}</div>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setEdition(true)}><Icone nom="crayon" taille={16} /> Modifier le client</button>
          <button type="button" className="btn-primaire" onClick={() => setNouveauDossier(true)}><Icone nom="plus" taille={16} /> Nouveau dossier</button>
        </div>
      </div>

      <div className="grille g-1-2">
        <section className="carte">
          <h2>Coordonnées</h2>
          <ul className="liste-simple">
            <li><span className="muted">Téléphone</span><a href={`tel:+${c.telephone}`}>+{c.telephone}</a></li>
            <li><span className="muted">E-mail</span><span>{c.email || '—'}</span></li>
            <li><span className="muted">Naissance</span><span>{date(c.dateNaissance) || '—'}</span></li>
            <li><span className="muted">Adresse</span><span>{c.adresse || '—'}</span></li>
            <li><span className="muted">Langue</span><span lang={c.langue}>{c.langue === 'ar' ? 'العربية (arabe)' : 'Français'}</span></li>
            {c.contactSuivi && <li><span className="muted">Suivi par</span><span>{c.contactSuivi.nom}<br /><span className="petit">+{c.contactSuivi.telephone}</span></span></li>}
          </ul>
          {!c.email && <div className="alerte alerte-orange" style={{ marginTop: 12, marginBottom: 0 }}><Icone nom="alerte" /><div>Ajoutez un e-mail pour que le client puisse accéder à son espace en ligne. <button type="button" className="btn-lien" onClick={() => setEdition(true)}>Ajouter l'e-mail</button></div></div>}
        </section>

        <section className="carte">
          <h2>Dossiers ({dossiers.length})</h2>
          {dossiers.length === 0 ? <Vide icone="dossier" action={<button type="button" className="btn-petit btn-primaire" onClick={() => setNouveauDossier(true)}>Ouvrir un dossier</button>}>Aucun dossier pour ce client.</Vide> : (
            <ul className="liste-simple">
              {dossiers.map((d) => {
                const m = base.modeles.find((x) => x.id === d.modeleId);
                const p = progression(d);
                return (
                  <li key={d.id} className="cliquable" onClick={() => nav(`/dossiers/${d.id}`)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="pastille" style={{ background: m?.couleur }} />
                        <Link to={`/dossiers/${d.id}`}><b>{d.intitule}</b></Link>
                        <span className="petit muted">{d.numero}</span>
                        <BadgeDossier statut={d.statut} />
                      </div>
                      <div className="petit muted" style={{ margin: '4px 0' }}>{p.courante?.nom ?? 'Toutes les étapes sont terminées'}</div>
                      <Barre pourcent={p.pourcent} label={`Avancement ${d.numero}`} />
                    </div>
                    <div className="num petit" style={{ minWidth: 120 }}>Reste : <b>{formatSoldes(soldes(d), 'reste')}</b></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {edition && <EditionClient client={c} onFermer={() => setEdition(false)} />}
      {nouveauDossier && <NouveauDossier clientId={c.id} onFermer={() => setNouveauDossier(false)} />}
    </>
  );
}

function EditionClient({ client, onFermer }: { client: Client; onFermer: () => void }) {
  const [f, setF] = useState({
    prenom: client.prenom, nom: client.nom, telephone: client.telephone, email: client.email,
    dateNaissance: client.dateNaissance ?? '', adresse: client.adresse ?? '', langue: client.langue,
    suiviNom: client.contactSuivi?.nom ?? '', suiviTel: client.contactSuivi?.telephone ?? '', suiviEmail: client.contactSuivi?.email ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    tenter(() => {
      majClient(client.id, {
        prenom: f.prenom.trim(), nom: f.nom.trim(), telephone: f.telephone.replace(/\D/g, '').replace(/^0/, '213'),
        email: f.email.trim(), dateNaissance: f.dateNaissance || undefined, adresse: f.adresse || undefined, langue: f.langue as Langue,
        contactSuivi: f.suiviNom ? { nom: f.suiviNom, telephone: f.suiviTel.replace(/\D/g, '').replace(/^0/, '213'), email: f.suiviEmail } : undefined,
      });
      onFermer();
    }, 'Client mis à jour');
  };
  const ch = (k: keyof typeof f, lib: string, type = 'text') => (
    <div className="champ"><label htmlFor={k}>{lib}</label><input id={k} type={type} value={f[k]} onChange={set(k)} /></div>
  );
  return (
    <Modale titre="Modifier le client" onFermer={onFermer} large>
      <form onSubmit={enregistrer}>
        <div className="grille g2" style={{ gap: '0 16px' }}>
          {ch('prenom', 'Prénom')}{ch('nom', 'Nom')}
          {ch('telephone', 'Téléphone (WhatsApp)', 'tel')}{ch('email', 'E-mail', 'email')}
          {ch('dateNaissance', 'Date de naissance', 'date')}
          <div className="champ"><label htmlFor="langue">Langue</label>
            <select id="langue" value={f.langue} onChange={set('langue')}><option value="fr">Français</option><option value="ar">العربية (arabe)</option></select>
          </div>
        </div>
        {ch('adresse', 'Adresse')}
        <h3>Personne qui suit le dossier (parent…)</h3>
        <div className="grille g3" style={{ gap: '0 16px' }}>
          {ch('suiviNom', 'Nom et lien')}{ch('suiviTel', 'Téléphone', 'tel')}{ch('suiviEmail', 'E-mail', 'email')}
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire">Enregistrer les modifications</button></div>
      </form>
    </Modale>
  );
}

export function NouveauDossier({ clientId, onFermer }: { clientId: string; onFermer: () => void }) {
  const base = useBase();
  const user = useUtilisateur()!;
  const nav = useNavigate();
  const modeles = base.modeles.filter((m) => m.actif);
  const [modeleId, setModeleId] = useState(modeles[0]?.id ?? '');
  const [agentId, setAgentId] = useState(user.id);
  const [intitule, setIntitule] = useState('');
  const m = base.modeles.find((x) => x.id === modeleId);
  return (
    <Modale titre="Nouveau dossier" onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); tenter(() => { const d = ouvrirDossier(clientId, modeleId, agentId, intitule); nav(`/dossiers/${d.id}`); }, 'Dossier ouvert'); }}>
        <div className="champ"><label htmlFor="m">Type de dossier</label>
          <select id="m" value={modeleId} onChange={(e) => setModeleId(e.target.value)}>{modeles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>
        </div>
        <div className="champ"><label htmlFor="a">Agent responsable</label>
          <select id="a" value={agentId} onChange={(e) => setAgentId(e.target.value)}>{base.utilisateurs.filter((u) => u.actif && u.role !== 'client').map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}</select>
        </div>
        <div className="champ"><label htmlFor="i">Précision (facultatif)</label><input id="i" value={intitule} onChange={(e) => setIntitule(e.target.value)} /></div>
        {m && <div className="alerte alerte-bleu"><Icone nom="info" /><div>Seront créés : {m.documents.length} documents à fournir, {m.etapes.length} étapes, 2 échéances d'honoraires (50 % / 50 %) et {m.frais.length} frais de procédure.</div></div>}
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire" disabled={!modeleId}>Ouvrir le dossier</button></div>
      </form>
    </Modale>
  );
}
