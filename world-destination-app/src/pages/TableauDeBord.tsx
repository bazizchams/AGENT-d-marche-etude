import { Link, useNavigate } from 'react-router-dom';
import { Barre, Vide } from '../components/ui';
import { alertes, date, dateHeure, montant, nomClient, progression } from '../lib/regles';
import { useBase, useUtilisateur } from '../lib/store';
import type { Devise } from '../lib/types';

export default function TableauDeBord() {
  const base = useBase();
  const user = useUtilisateur()!;
  const nav = useNavigate();
  const admin = user.role === 'admin';
  const a = alertes(base);
  const client = (id: string) => base.clients.find((c) => c.id === id);
  const modele = (id: string) => base.modeles.find((m) => m.id === id);

  const totalImpayes: Partial<Record<Devise, number>> = {};
  a.impayes.forEach(({ lignes }) => lignes.forEach((l) => { totalImpayes[l.devise] = (totalImpayes[l.devise] ?? 0) + l.reste; }));

  const parType = base.modeles.map((m) => ({ m, n: a.ouverts.filter((d) => d.modeleId === m.id).length })).filter((x) => x.n > 0);
  const mesDossiers = a.ouverts.filter((d) => d.agentId === user.id);

  return (
    <>
      <div className="entete">
        <div>
          <h1>Bonjour {user.nom}</h1>
          <div className="muted">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="actions">
          <Link className="btn btn-primaire" to="/clients?nouveau=1">＋ Nouveau client</Link>
        </div>
      </div>

      <div className="grille g4" style={{ marginBottom: 16 }}>
        <Link className="carte kpi" to="/dossiers"><div className="val">{a.ouverts.length}</div><div className="lib">Dossiers en cours</div></Link>
        <a className="carte kpi" href="#a-verifier"><div className="val" style={{ color: a.aVerifier.length ? 'var(--bleu)' : undefined }}>{a.aVerifier.length}</div><div className="lib">Documents à vérifier</div></a>
        <a className="carte kpi" href="#impayes">
          <div className="val" style={{ color: a.impayes.length ? 'var(--orange)' : undefined }}>{a.impayes.length}</div>
          <div className="lib">Clients avec reste à payer</div>
          {admin && a.impayes.length > 0 && <div className="petit" style={{ marginTop: 4 }}>{(Object.keys(totalImpayes) as Devise[]).map((d) => montant(totalImpayes[d]!, d)).join(' + ')}</div>}
        </a>
        <a className="carte kpi" href="#expirations"><div className="val" style={{ color: a.expirations.length ? 'var(--rouge)' : undefined }}>{a.expirations.length}</div><div className="lib">Documents qui expirent bientôt</div></a>
      </div>

      <div className="grille g2">
        <section className="carte" id="a-verifier">
          <h2>📤 Documents envoyés par les clients</h2>
          {a.aVerifier.length === 0 ? <Vide>Aucun document en attente de vérification.</Vide> : (
            <ul className="liste-simple">
              {a.aVerifier.map(({ d, doc }) => (
                <li key={doc.id}>
                  <div><b>{doc.nom}</b><div className="petit muted">{nomClient(client(d.clientId))} · {d.numero}</div></div>
                  <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=documents`}>Vérifier</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="carte" id="impayes">
          <h2>💳 Paiements exigibles non encaissés</h2>
          {a.impayes.length === 0 ? <Vide>Tous les montants exigibles sont encaissés.</Vide> : (
            <ul className="liste-simple">
              {a.impayes.map(({ d, lignes }) => (
                <li key={d.id}>
                  <div>
                    <b>{nomClient(client(d.clientId))}</b> <span className="petit muted">{d.numero}</span>
                    <div className="petit muted">{lignes.map((l) => l.libelle).join(' · ')}</div>
                  </div>
                  <div className="actions">
                    <span className="num petit"><b>{lignes.map((l) => montant(l.reste, l.devise)).join(' + ')}</b></span>
                    <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=paiements`}>Encaisser</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="carte" id="expirations">
          <h2>⏳ Documents qui expirent (≤ {base.parametres.joursAlerteExpiration} jours)</h2>
          {a.expirations.length === 0 ? <Vide>Aucun document n'expire prochainement.</Vide> : (
            <ul className="liste-simple">
              {a.expirations.map(({ d, doc, jours }) => (
                <li key={doc.id}>
                  <div><b>{doc.nom}</b><div className="petit muted">{nomClient(client(d.clientId))} · {d.numero}</div></div>
                  <span className={`badge ${jours < 0 ? 'b-rouge' : jours <= 30 ? 'b-orange' : 'b-gris'}`}>
                    {jours < 0 ? `Expiré le ${date(doc.expiration)}` : `Expire le ${date(doc.expiration)} (J-${jours})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="carte">
          <h2>📅 Prochains rendez-vous</h2>
          {a.rdv.length === 0 ? <Vide>Aucun rendez-vous programmé.</Vide> : (
            <ul className="liste-simple">
              {a.rdv.map((d) => (
                <li key={d.id}>
                  <div><b>{nomClient(client(d.clientId))}</b><div className="petit muted">{d.rdv!.lieu} · {d.intitule}</div></div>
                  <Link to={`/dossiers/${d.id}`} className="petit">{dateHeure(d.rdv!.date)}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="carte">
          <h2>🏦 Frais encaissés à verser aux organismes</h2>
          {a.fraisAVerser.length === 0 ? <Vide>Aucun versement en attente.</Vide> : (
            <ul className="liste-simple">
              {a.fraisAVerser.map(({ d, f }) => (
                <li key={f.id}>
                  <div><b>{f.nom}</b> <span className="petit muted">→ {f.organisme}</span><div className="petit muted">{nomClient(client(d.clientId))} · {d.numero}</div></div>
                  <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=paiements`}>{montant(f.montant, f.devise)}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="carte">
          <h2>📊 Dossiers en cours par type</h2>
          {parType.length === 0 ? <Vide>Aucun dossier en cours.</Vide> : (
            <ul className="liste-simple">
              {parType.map(({ m, n }) => (
                <li key={m.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="pastille" style={{ background: m.couleur }} />{m.nom}</span>
                  <Link to={`/dossiers?type=${m.id}`}><b>{n}</b></Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="carte" style={{ marginTop: 16 }}>
        <h2>Mes dossiers en cours ({mesDossiers.length})</h2>
        {mesDossiers.length === 0 ? <Vide>Aucun dossier ne vous est confié.</Vide> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Dossier</th><th>Client</th><th>Type</th><th>Étape en cours</th><th style={{ width: 160 }}>Avancement</th></tr></thead>
              <tbody>
                {mesDossiers.map((d) => {
                  const p = progression(d);
                  return (
                    <tr key={d.id} className="cliquable" onClick={() => nav(`/dossiers/${d.id}`)}>
                      <td><Link to={`/dossiers/${d.id}`}>{d.numero}</Link></td>
                      <td>{nomClient(client(d.clientId))}</td>
                      <td><span className="pastille" style={{ background: modele(d.modeleId)?.couleur }} /> {modele(d.modeleId)?.nom}</td>
                      <td className="petit">{p.courante?.nom ?? 'Toutes les étapes sont faites'}</td>
                      <td><Barre pourcent={p.pourcent} /><span className="petit muted">{p.faites}/{p.total}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
