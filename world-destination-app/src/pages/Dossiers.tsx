import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { BandeauMarquee, EntreePage, TitreCinetique } from '../components/Motion';
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
  const reinitialiser = () => {
    setQ('');
    setParams({}, { replace: true });
  };
  const client = (id: string) => base.clients.find((c) => c.id === id);
  const n = normaliser(q.trim());

  const liste = base.dossiers
    .filter((d) => (statut === 'tous' || d.statut === statut) && (!type || d.modeleId === type) && (!agent || d.agentId === agent))
    .filter((d) => !n || normaliser(`${d.numero} ${nomClient(client(d.clientId))} ${d.intitule}`).includes(n))
    .sort((a, b) => b.ouvertLe.localeCompare(a.ouvertLe));

  const filtresStatut: { val: StatutDossier | 'tous'; lib: string; compte: number }[] = [
    { val: 'en_cours', lib: 'En cours', compte: base.dossiers.filter((d) => d.statut === 'en_cours').length },
    { val: 'termine', lib: 'Terminés', compte: base.dossiers.filter((d) => d.statut === 'termine').length },
    { val: 'annule', lib: 'Annulés', compte: base.dossiers.filter((d) => d.statut === 'annule').length },
    { val: 'tous', lib: 'Tous', compte: base.dossiers.length },
  ];
  const aFiltresActifs = Boolean(q.trim() || type || agent || statut !== 'en_cours');

  return (
    <EntreePage>
      <div className="entete">
        <div>
          <TitreCinetique as="h1" texte="Dossiers" />
          <div className="muted">{liste.length} dossier(s) affiché(s)</div>
        </div>
        <div className="pilule-date">
          <Icone nom="dossier" taille={14} />
          <span>{base.dossiers.length} au total</span>
        </div>
      </div>

      <div className="no-print" style={{ marginBottom: 'var(--esp-4)' }}>
        <BandeauMarquee />
      </div>

      <div className="carte-filtres">
        <div className="filtres-grille">
          <div className="champ">
            <label htmlFor="q">Rechercher</label>
            <div className="champ-recherche">
              <Icone nom="recherche" taille={16} />
              <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, client…" />
            </div>
          </div>
          <div className="champ">
            <label htmlFor="t">Type</label>
            <select id="t" value={type} onChange={(e) => filtre('type', e.target.value)}>
              <option value="">Tous les types</option>
              {base.modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="s">Statut</label>
            <select id="s" value={statut} onChange={(e) => filtre('statut', e.target.value)}>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminés</option>
              <option value="annule">Annulés</option>
              <option value="tous">Tous</option>
            </select>
          </div>
          <div className="champ">
            <label htmlFor="a">Agent</label>
            <select id="a" value={agent} onChange={(e) => filtre('agent', e.target.value)}>
              <option value="">Tous</option>
              {base.utilisateurs.filter((u) => u.role !== 'client').map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="actions" role="group" aria-label="Filtre rapide par statut" style={{ justifyContent: 'space-between' }}>
          <div className="actions">
            {filtresStatut.map((f) => (
              <button
                key={f.val}
                type="button"
                className={`pilule-filtre ${statut === f.val ? 'actif' : ''}`}
                aria-pressed={statut === f.val}
                onClick={() => filtre('statut', f.val === 'en_cours' ? '' : f.val)}
              >
                <span>{f.lib}</span>
                <span style={{ opacity: 0.78, fontVariantNumeric: 'tabular-nums' }}>{f.compte}</span>
              </button>
            ))}
          </div>
          {aFiltresActifs && (
            <button type="button" className="btn-petit btn-lien" onClick={reinitialiser}>
              <Icone nom="boucle" taille={14} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="carte">
        {liste.length === 0 ? (
          <Vide
            icone="recherche"
            action={<button type="button" className="btn-petit" onClick={reinitialiser}>Réinitialiser les filtres</button>}
          >
            Aucun dossier ne correspond à ces filtres.
          </Vide>
        ) : (
          <div className="table-scroll">
            <table className="table-cartes">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Étape en cours</th>
                  <th style={{ width: 148 }}>Avancement</th>
                  <th>Documents</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((d) => {
                  const p = progression(d);
                  const docs = compteDocuments(d);
                  const imp = impayesExigibles(d);
                  const m = base.modeles.find((x) => x.id === d.modeleId);
                  return (
                    <tr key={d.id} className="cliquable" data-cursor="Ouvrir ↗" onClick={() => nav(`/dossiers/${d.id}`)}>
                      <td className="titre-ligne">
                        <Link to={`/dossiers/${d.id}`}>{d.numero}</Link>{' '}
                        <span className="muted petit client-mobile" aria-hidden="true">· {nomClient(client(d.clientId))}</span>
                      </td>
                      <td data-label="Client" className="col-client">{nomClient(client(d.clientId))}</td>
                      <td data-label="Type" className="petit">
                        <span className="avec-pastille">
                          <span className="pastille" style={{ background: m?.couleur }} />
                          <span>{m?.nom}</span>
                        </span>
                      </td>
                      <td data-label="Étape" className="petit">{p.courante?.nom ?? '—'}</td>
                      <td data-label="Avancement" className="cellule-avancement">
                        <div>
                          <Barre pourcent={p.pourcent} animee={false} />
                          <span className="petit muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {p.faites}/{p.total} · {p.pourcent} %
                          </span>
                        </div>
                      </td>
                      <td data-label="Documents" className="petit">
                        <span className="avec-pastille" style={{ gap: 4 }}>
                          <Icone nom="coche" taille={14} />
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{docs.valide}/{d.documents.length}</span>
                        </span>
                        {docs.envoye > 0 && <span className="badge b-bleu" style={{ marginInlineStart: 6 }}>{docs.envoye} à vérifier</span>}
                        {docs.refuse > 0 && <span className="badge b-rouge" style={{ marginInlineStart: 6 }}>{docs.refuse} refusé</span>}
                      </td>
                      <td data-label="Paiement">
                        {imp.length ? <span className="badge b-orange">Impayé</span> : <span className="badge b-vert">À jour</span>}
                      </td>
                      <td data-label="Statut"><BadgeDossier statut={d.statut} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </EntreePage>
  );
}
