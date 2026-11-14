import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
          <div className="champ"><label htmlFor="q">Rechercher</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, client…" /></div>
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
        {liste.length === 0 ? <Vide>Aucun dossier ne correspond à ces filtres. <button className="btn-petit" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Réinitialiser les filtres</button></Vide> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Dossier</th><th>Client</th><th>Type</th><th>Étape en cours</th><th style={{ width: 140 }}>Avancement</th><th>Documents</th><th>Paiement</th><th>Statut</th></tr></thead>
              <tbody>
                {liste.map((d) => {
                  const p = progression(d);
                  const docs = compteDocuments(d);
                  const imp = impayesExigibles(d);
                  const m = base.modeles.find((x) => x.id === d.modeleId);
                  return (
                    <tr key={d.id} className="cliquable" onClick={() => nav(`/dossiers/${d.id}`)}>
                      <td><Link to={`/dossiers/${d.id}`}>{d.numero}</Link></td>
                      <td>{nomClient(client(d.clientId))}</td>
                      <td className="petit"><span className="pastille" style={{ background: m?.couleur }} /> {m?.nom}</td>
                      <td className="petit">{p.courante?.nom ?? '—'}</td>
                      <td><Barre pourcent={p.pourcent} /><span className="petit muted">{p.faites}/{p.total}</span></td>
                      <td className="petit">
                        {docs.valide}/{d.documents.length} ✅
                        {docs.envoye > 0 && <span className="badge b-bleu" style={{ marginLeft: 4 }}>{docs.envoye} à vérifier</span>}
                        {docs.refuse > 0 && <span className="badge b-rouge" style={{ marginLeft: 4 }}>{docs.refuse} refusé</span>}
                      </td>
                      <td>{imp.length ? <span className="badge b-orange">Impayé</span> : <span className="badge b-vert">À jour</span>}</td>
                      <td><BadgeDossier statut={d.statut} /></td>
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
