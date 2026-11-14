import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { Barre, BadgeDossier, Vide } from '../components/ui';
import { compteDocuments, impayesExigibles, nomClient, progression } from '../lib/regles';
import { useBase } from '../lib/store';
import type { StatutDossier } from '../lib/types';
import { normaliser } from './Clients';

export default function Dossiers() {
  const base = useBase();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const type = params.get('type') ?? '';
  const statut = (params.get('statut') ?? 'en_cours') as StatutDossier | 'tous';
  const agent = params.get('agent') ?? '';
  const filtre = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const client = (id: string) => base.clients.find((c) => c.id === id);
  const n = normaliser(q.trim());

  const liste = base.dossiers
    .filter((d) => (statut === 'tous' || d.statut === statut) && (!type || d.modeleId === type) && (!agent || d.agentId === agent))
    .filter((d) => !n || normaliser(`${d.numero} ${nomClient(client(d.clientId))} ${d.intitule}`).includes(n))
    .sort((a, b) => b.ouvertLe.localeCompare(a.ouvertLe));

  return (
    <>
      <div className="entete"><div><h1>Dossiers</h1><div className="muted">{liste.length} dossier(s) affiché(s)</div></div></div>
      <div className="carte">
        <div className="grille g4" style={{ gap: 12, marginBottom: 8 }}>
          <div className="champ"><label htmlFor="q">Rechercher</label><div className="champ-recherche"><Icone nom="recherche" taille={16} /><input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, client…" /></div></div>
          <div className="champ"><label htmlFor="t">Type</label>
            <select id="t" value={type} onChange={(e) => filtre('type', e.target.value)}>
              <option value="">Tous les types</option>
              {base.modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div className="champ"><label htmlFor="s">Statut</label>
            <select id="s" value={statut} onChange={(e) => filtre('statut', e.target.value)}>
              <option value="en_cours">En cours</option><option value="termine">Terminés</option><option value="annule">Annulés</option><option value="tous">Tous</option>
            </select>
          </div>
          <div className="champ"><label htmlFor="a">Agent</label>
            <select id="a" value={agent} onChange={(e) => filtre('agent', e.target.value)}>
              <option value="">Tous</option>
              {base.utilisateurs.filter((u) => u.role !== 'client').map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </div>
        </div>
        {liste.length === 0 ? <Vide icone="recherche" action={<button type="button" className="btn-petit" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Réinitialiser les filtres</button>}>Aucun dossier ne correspond à ces filtres.</Vide> : (
          <div className="table-scroll">
            <table className="table-cartes">
              <thead><tr><th>Dossier</th><th>Client</th><th>Type</th><th>Étape en cours</th><th style={{ width: 140 }}>Avancement</th><th>Documents</th><th>Paiement</th><th>Statut</th></tr></thead>
              <tbody>
                {liste.map((d) => {
                  const p = progression(d);
                  const docs = compteDocuments(d);
                  const imp = impayesExigibles(d);
                  const m = base.modeles.find((x) => x.id === d.modeleId);
                  return (
                    <tr key={d.id} className="cliquable" onClick={() => nav(`/dossiers/${d.id}`)}>
                      <td className="titre-ligne"><Link to={`/dossiers/${d.id}`}>{d.numero}</Link> <span className="muted petit client-mobile" aria-hidden="true">· {nomClient(client(d.clientId))}</span></td>
                      <td data-label="Client" className="col-client">{nomClient(client(d.clientId))}</td>
                      <td data-label="Type" className="petit"><span className="avec-pastille"><span className="pastille" style={{ background: m?.couleur }} />{m?.nom}</span></td>
                      <td data-label="Étape" className="petit">{p.courante?.nom ?? '—'}</td>
                      <td data-label="Avancement" className="cellule-avancement"><div><Barre pourcent={p.pourcent} /><span className="petit muted">{p.faites}/{p.total}</span></div></td>
                      <td data-label="Documents" className="petit">
                        <span className="avec-pastille" style={{ gap: 4 }}><Icone nom="coche" taille={14} />{docs.valide}/{d.documents.length}</span>
                        {docs.envoye > 0 && <span className="badge b-bleu" style={{ marginLeft: 4 }}>{docs.envoye} à vérifier</span>}
                        {docs.refuse > 0 && <span className="badge b-rouge" style={{ marginLeft: 4 }}>{docs.refuse} refusé</span>}
                      </td>
                      <td data-label="Paiement">{imp.length ? <span className="badge b-orange">Impayé</span> : <span className="badge b-vert">À jour</span>}</td>
                      <td data-label="Statut"><BadgeDossier statut={d.statut} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
