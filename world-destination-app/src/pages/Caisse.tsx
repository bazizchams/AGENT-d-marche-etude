import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { Vide } from '../components/ui';
import { dateHeure, montant, nomClient } from '../lib/regles';
import { useBase } from '../lib/store';
import type { Devise } from '../lib/types';

const MODES = { especes: 'Espèces', ccp: 'CCP', baridimob: 'BaridiMob', virement: 'Virement' };

const debutMois = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Caisse : réservée aux administrateurs. */
export default function Caisse() {
  const base = useBase();
  const [du, setDu] = useState(debutMois());
  const [au, setAu] = useState(aujourdhui());
  const [type, setType] = useState<'tous' | 'echeance' | 'frais'>('tous');

  const lignes = base.dossiers.flatMap((d) => d.paiements.map((p) => ({ d, p })))
    .filter(({ p }) => p.date.slice(0, 10) >= du && p.date.slice(0, 10) <= au && (type === 'tous' || p.cible.type === type))
    .sort((a, b) => b.p.date.localeCompare(a.p.date));

  const totaux = (cible: 'echeance' | 'frais') => {
    const t: Partial<Record<Devise, number>> = {};
    lignes.filter(({ p }) => !p.annule && p.cible.type === cible).forEach(({ p }) => { t[p.devise] = (t[p.devise] ?? 0) + p.montant; });
    const parts = (Object.keys(t) as Devise[]).map((k) => montant(t[k]!, k));
    return parts.length ? parts.join(' + ') : '0';
  };
  const parMode: Record<string, number> = {};
  lignes.filter(({ p }) => !p.annule && p.devise === 'DZD').forEach(({ p }) => { parMode[p.mode] = (parMode[p.mode] ?? 0) + p.montant; });

  return (
    <>
      <div className="entete"><div><h1>Caisse</h1><div className="muted">Encaissements de la période (visible par les administrateurs uniquement)</div></div></div>
      <div className="carte" style={{ marginBottom: 16 }}>
        <div className="grille g3" style={{ gap: 12 }}>
          <div className="champ"><label htmlFor="du">Du</label><input id="du" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></div>
          <div className="champ"><label htmlFor="au">Au</label><input id="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></div>
          <div className="champ"><label htmlFor="ty">Type</label>
            <select id="ty" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="tous">Tout</option><option value="echeance">Honoraires</option><option value="frais">Frais de procédure</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grille g3" style={{ marginBottom: 16 }}>
        <div className="carte kpi ton-neutre"><span className="kpi-icone"><Icone nom="caisse" /></span><div><div className="lib">Honoraires encaissés</div><div className="val" style={{ fontSize: '1.4rem' }}>{totaux('echeance')}</div></div></div>
        <div className="carte kpi"><span className="kpi-icone"><Icone nom="banque" /></span><div><div className="lib">Frais de procédure encaissés</div><div className="val" style={{ fontSize: '1.4rem' }}>{totaux('frais')}</div><div className="petit muted">À reverser aux organismes</div></div></div>
        <div className="carte"><div className="petit muted">Par mode de paiement (DA)</div>
          {Object.keys(parMode).length === 0 ? <div>—</div> : <ul className="liste-simple">{Object.entries(parMode).map(([k, v]) => <li key={k} className="petit" style={{ padding: '6px 0' }}><span>{MODES[k as keyof typeof MODES]}</span><b className="num">{montant(v, 'DZD')}</b></li>)}</ul>}
        </div>
      </div>
      <div className="carte">
        {lignes.length === 0 ? <Vide icone="recu" action={<button type="button" className="btn-petit" onClick={() => { setDu('2000-01-01'); setAu(aujourdhui()); setType('tous'); }}>Afficher toute la période</button>}>Aucun encaissement sur cette période.</Vide> : (
          <div className="table-scroll">
            <table className="table-cartes">
              <thead><tr><th>Reçu</th><th>Date</th><th>Client</th><th>Objet</th><th>Mode</th><th className="num">Montant</th><th>Par</th></tr></thead>
              <tbody>
                {lignes.map(({ d, p }) => {
                  const c = base.clients.find((x) => x.id === d.clientId);
                  const obj = p.cible.type === 'echeance' ? d.echeances.find((e) => e.id === p.cible.id)?.libelle : d.frais.find((f) => f.id === p.cible.id)?.nom;
                  return (
                    <tr key={p.id} className={p.annule ? 'annule' : undefined}>
                      <td className="titre-ligne"><Link to={`/dossiers/${d.id}/recu/${p.id}`}>{p.numeroRecu}</Link></td>
                      <td data-label="Date" className="petit">{dateHeure(p.date)}</td>
                      <td data-label="Client"><Link to={`/dossiers/${d.id}?onglet=paiements`}>{nomClient(c)}</Link></td>
                      <td data-label="Objet" className="petit">{obj}{p.annule && <div style={{ color: 'var(--rouge)' }}>Annulé : {p.annule.motif}</div>}</td>
                      <td data-label="Mode" className="petit">{MODES[p.mode]}</td>
                      <td data-label="Montant" className="num" style={p.annule ? { textDecoration: 'line-through' } : undefined}>{montant(p.montant, p.devise)}</td>
                      <td data-label="Par" className="petit">{base.utilisateurs.find((u) => u.id === p.par)?.nom}</td>
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
