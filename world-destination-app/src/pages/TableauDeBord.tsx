import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icone, type NomIcone } from '../components/Icone';
import {
  BandeauMarquee,
  CompteurAnime,
  EntreePage,
  EventailCartes,
  SceauRotatif,
  StaggerGrille,
  TitreCinetique,
  type ElementEventail,
} from '../components/Motion';
import { Barre, Vide } from '../components/ui';
import { alertes, compteDocuments, date, dateHeure, impayesExigibles, montant, nomClient, progression } from '../lib/regles';
import { useBase, useUtilisateur } from '../lib/store';
import type { Devise } from '../lib/types';

const BORD_TON: Record<'info' | 'alerte' | 'danger', string> = {
  info: 'var(--c-info-bord)',
  alerte: 'var(--c-alerte-bord)',
  danger: 'var(--c-danger-bord)',
};

/** Carte de section : titre + icône + compteur. */
function Section({
  id,
  titre,
  icone,
  compte,
  ton,
  children,
}: {
  id?: string;
  titre: string;
  icone: NomIcone;
  compte?: number;
  ton?: 'info' | 'alerte' | 'danger';
  children: ReactNode;
}) {
  const actif = compte !== undefined && compte > 0 && ton;
  return (
    <section
      className="carte"
      id={id}
      aria-labelledby={id ? `${id}-titre` : undefined}
      style={actif ? { borderColor: BORD_TON[ton] } : undefined}
    >
      <h2 className="titre-section" id={id ? `${id}-titre` : undefined}>
        <Icone nom={icone} /> {titre}
        {compte !== undefined && <span className={`compteur ${actif ? `ton-${ton}` : ''}`}>{compte}</span>}
      </h2>
      {children}
    </section>
  );
}

export default function TableauDeBord() {
  const base = useBase();
  const user = useUtilisateur()!;
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const admin = user.role === 'admin';
  const a = alertes(base);
  const client = (id: string) => base.clients.find((c) => c.id === id);
  const modele = (id: string) => base.modeles.find((m) => m.id === id);

  const totalImpayes: Partial<Record<Devise, number>> = {};
  a.impayes.forEach(({ lignes }) => lignes.forEach((l) => { totalImpayes[l.devise] = (totalImpayes[l.devise] ?? 0) + l.reste; }));
  const resumeImpayes = (Object.keys(totalImpayes) as Devise[]).map((d) => montant(totalImpayes[d]!, d)).join(' + ');

  const parType = base.modeles.map((m) => ({ m, n: a.ouverts.filter((d) => d.modeleId === m.id).length })).filter((x) => x.n > 0);
  const mesDossiers = a.ouverts.filter((d) => d.agentId === user.id);
  const expirantes = a.expirations.length;
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cartesEventail: ElementEventail[] = a.ouverts.slice(0, 4).map((d) => {
    const p = progression(d);
    const docs = compteDocuments(d);
    const m = modele(d.modeleId);
    return {
      id: d.id,
      numero: d.numero,
      clientNom: nomClient(client(d.clientId)),
      modeleNom: m?.nom ?? d.intitule,
      couleur: m?.couleur,
      etapeNom: p.courante?.nom ?? 'Toutes les étapes sont faites',
      pourcent: p.pourcent,
      faites: p.faites,
      total: p.total,
      docsValides: docs.valide,
      docsTotal: d.documents.length,
      docsEnvoye: docs.envoye,
      impaye: impayesExigibles(d).length > 0,
      to: `/dossiers/${d.id}`,
    };
  });

  // Ses propres dossiers d'abord quand on en a ; sinon en bas de page.
  const blocMesDossiers = (
    <section className="carte" style={mesDossiers.length ? { marginBottom: 'var(--esp-4)' } : { marginTop: 'var(--esp-4)' }} aria-labelledby="mes-dossiers">
      <h2 className="titre-section" id="mes-dossiers">
        <Icone nom="clients" /> Mes dossiers en cours <span className="compteur">{mesDossiers.length}</span>
      </h2>
      {mesDossiers.length === 0 ? (
        <Vide icone="dossier" action={<Link className="btn btn-petit" to="/dossiers">Voir tous les dossiers</Link>}>
          Aucun dossier ne vous est confié pour le moment.
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
                <th style={{ width: 170 }}>Avancement</th>
              </tr>
            </thead>
            <tbody>
              {mesDossiers.map((d) => {
                const p = progression(d);
                const m = modele(d.modeleId);
                return (
                  <tr key={d.id} className="cliquable" onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) nav(`/dossiers/${d.id}`); }}>
                    <td className="titre-ligne"><Link to={`/dossiers/${d.id}`}>{d.numero}</Link></td>
                    <td data-label="Client">{nomClient(client(d.clientId))}</td>
                    <td data-label="Type">
                      <span className="avec-pastille">
                        <span className="pastille" style={{ background: m?.couleur }} />
                        {m?.nom}
                      </span>
                    </td>
                    <td data-label="Étape" className="petit">{p.courante?.nom ?? 'Toutes les étapes sont faites'}</td>
                    <td data-label="Avancement" className="cellule-avancement">
                      <div>
                        <Barre pourcent={p.pourcent} label={`Avancement ${d.numero}`} />
                        <span className="petit muted">{p.faites}/{p.total} étapes</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <EntreePage>
      <header className="entete-hero">
        <div className="entete" style={{ marginBottom: 'var(--esp-4)' }}>
          <div>
            <TitreCinetique as="h1" texte={`Bonjour ${user.nom}`} />
            <div className="actions" style={{ marginTop: 6 }}>
              <span className="pilule-date">
                <Icone nom="calendrier" taille={13} />
                <span style={{ textTransform: 'capitalize' }}>{dateDuJour}</span>
              </span>
              <span className="pilule-date">
                <Icone nom={admin ? 'bouclier' : 'utilisateur'} taille={13} />
                {admin ? 'Administration' : 'Conseiller dossiers'}
              </span>
            </div>
          </div>
          <div className="actions" style={{ alignItems: 'center', gap: 'var(--esp-3)' }}>
            <SceauRotatif taille={74} />
            <Link className="btn btn-primaire" to="/clients?nouveau=1">
              <Icone nom="plus" taille={16} /> Nouveau client
            </Link>
          </div>
        </div>

        {/* Recherche rapide (cahier des charges §11) */}
        <form
          role="search"
          className="champ"
          style={{ maxWidth: 560, marginBottom: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            nav(`/clients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
          }}
        >
          <label htmlFor="recherche-rapide">Recherche rapide</label>
          <div className="actions" style={{ flexWrap: 'nowrap' }}>
            <div className="champ-recherche" style={{ flex: 1, minWidth: 0 }}>
              <Icone nom="recherche" taille={16} />
              <input
                id="recherche-rapide"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, tél. ou n° de dossier"
                enterKeyHint="search"
              />
            </div>
            <button type="submit">Rechercher</button>
          </div>
        </form>

        <div style={{ marginTop: 'var(--esp-4)' }}>
          <BandeauMarquee />
        </div>
      </header>

      <StaggerGrille className="grille g4 g4-mobile-2" style={{ marginBottom: 'var(--esp-4)' }}>
        <Link className="carte kpi ton-neutre kpi-actif" to="/dossiers" data-indice="01" data-cursor="Explorer ↗">
          <span className="kpi-icone"><Icone nom="dossier" /></span>
          <div>
            <div className="val"><CompteurAnime valeur={a.ouverts.length} /></div>
            <div className="lib">Dossiers en cours</div>
          </div>
        </Link>
        <a
          className={`carte kpi ${a.aVerifier.length ? 'ton-info kpi-actif' : 'kpi-calme'}`}
          href="#a-verifier"
          data-indice="02"
          data-cursor="Explorer ↗"
          onClick={(e) => { e.preventDefault(); document.getElementById('a-verifier')?.scrollIntoView({ block: 'start' }); }}
        >
          <span className="kpi-icone"><Icone nom={a.aVerifier.length ? 'envoi' : 'coche'} /></span>
          <div>
            <div className="val"><CompteurAnime valeur={a.aVerifier.length} /></div>
            <div className="lib">Documents à vérifier</div>
          </div>
        </a>
        <a
          className={`carte kpi ${a.impayes.length ? 'ton-alerte kpi-actif' : 'kpi-calme'}`}
          href="#impayes"
          data-indice="03"
          data-cursor="Explorer ↗"
          onClick={(e) => { e.preventDefault(); document.getElementById('impayes')?.scrollIntoView({ block: 'start' }); }}
        >
          <span className="kpi-icone"><Icone nom={a.impayes.length ? 'paiement' : 'coche'} /></span>
          <div>
            <div className="val"><CompteurAnime valeur={a.impayes.length} /></div>
            <div className="lib">Clients avec reste à payer</div>
            {admin && a.impayes.length > 0 && (
              <div className="detail"><CompteurAnime valeur={resumeImpayes} compteDepuisZero /></div>
            )}
          </div>
        </a>
        <a
          className={`carte kpi ${expirantes ? 'ton-danger kpi-actif' : 'kpi-calme'}`}
          href="#expirations"
          data-indice="04"
          data-cursor="Explorer ↗"
          onClick={(e) => { e.preventDefault(); document.getElementById('expirations')?.scrollIntoView({ block: 'start' }); }}
        >
          <span className="kpi-icone"><Icone nom={expirantes ? 'sablier' : 'coche'} /></span>
          <div>
            <div className="val"><CompteurAnime valeur={expirantes} /></div>
            <div className="lib">Documents qui expirent bientôt</div>
          </div>
        </a>
      </StaggerGrille>

      <EventailCartes
        cartes={cartesEventail}
        titre="Dossiers sous les projecteurs"
        sousTitre="Sélectionnez une carte pour inspecter l'avancement"
      />

      {mesDossiers.length > 0 && blocMesDossiers}

      <StaggerGrille className="grille g2">
        <Section id="a-verifier" titre="Documents envoyés par les clients" icone="envoi" compte={a.aVerifier.length} ton="info">
          {a.aVerifier.length === 0 ? (
            <Vide icone="coche">Rien à vérifier : aucun document en attente.</Vide>
          ) : (
            <ul className="liste-simple">
              {a.aVerifier.map(({ d, doc }) => (
                <li key={doc.id}>
                  <div>
                    <b>{doc.nom}</b>
                    <div className="meta">{nomClient(client(d.clientId))} · {d.numero}</div>
                  </div>
                  <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=documents`}>Vérifier</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="impayes" titre="Paiements exigibles non encaissés" icone="paiement" compte={a.impayes.length} ton="alerte">
          {a.impayes.length === 0 ? (
            <Vide icone="coche">Tous les montants exigibles sont encaissés.</Vide>
          ) : (
            <ul className="liste-simple">
              {a.impayes.map(({ d, lignes }) => (
                <li key={d.id}>
                  <div>
                    <b>{nomClient(client(d.clientId))}</b> <span className="meta">{d.numero}</span>
                    <div className="meta">{lignes.map((l) => l.libelle).join(' · ')}</div>
                    {admin && (
                      <div className="petit num" style={{ textAlign: 'start', marginTop: 2 }}>
                        <b>{lignes.map((l) => montant(l.reste, l.devise)).join(' + ')}</b>
                      </div>
                    )}
                  </div>
                  <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=paiements`}>Encaisser</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="expirations" titre={`Documents qui expirent (≤ ${base.parametres.joursAlerteExpiration} jours)`} icone="sablier" compte={expirantes} ton="danger">
          {expirantes === 0 ? (
            <Vide icone="coche">Aucun document n'expire prochainement.</Vide>
          ) : (
            <ul className="liste-simple">
              {a.expirations.map(({ d, doc, jours }) => (
                <li key={doc.id}>
                  <div>
                    <Link to={`/dossiers/${d.id}?onglet=documents`}><b>{doc.nom}</b></Link>
                    <div className="meta">{nomClient(client(d.clientId))} · {d.numero}</div>
                  </div>
                  <span className={`badge ${jours < 0 ? 'b-rouge' : jours <= 30 ? 'b-orange' : 'b-gris'}`}>
                    {jours < 0 ? `Expiré le ${date(doc.expiration)}` : `Expire le ${date(doc.expiration)} (J-${jours})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section titre="Prochains rendez-vous" icone="calendrier" compte={a.rdv.length}>
          {a.rdv.length === 0 ? (
            <Vide icone="calendrier">Aucun rendez-vous programmé. Ajoutez-en un depuis l'onglet Journal d'un dossier.</Vide>
          ) : (
            <ul className="liste-simple">
              {a.rdv.map((d) => (
                <li key={d.id}>
                  <div>
                    <Link to={`/dossiers/${d.id}`}><b>{nomClient(client(d.clientId))}</b></Link>
                    <div className="meta">{d.rdv!.lieu} · {d.intitule}</div>
                  </div>
                  <span className="petit num"><b>{dateHeure(d.rdv!.date)}</b></span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section titre="Frais encaissés à verser aux organismes" icone="banque" compte={a.fraisAVerser.length}>
          {a.fraisAVerser.length === 0 ? (
            <Vide icone="coche">Aucun versement en attente.</Vide>
          ) : (
            <ul className="liste-simple">
              {a.fraisAVerser.map(({ d, f }) => (
                <li key={f.id}>
                  <div>
                    <b>{f.nom}</b> <span className="meta">→ {f.organisme}</span>
                    <div className="meta">
                      {nomClient(client(d.clientId))} · {d.numero}
                      {admin && <> · <b className="num">{montant(f.montant, f.devise)}</b></>}
                    </div>
                  </div>
                  <Link className="btn btn-petit" to={`/dossiers/${d.id}?onglet=paiements`}>Voir le dossier</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section titre="Dossiers en cours par type" icone="graphique">
          {parType.length === 0 ? (
            <Vide icone="dossier" action={<Link className="btn btn-petit" to="/clients?nouveau=1">Ouvrir un dossier</Link>}>
              Aucun dossier en cours.
            </Vide>
          ) : (
            <ul className="liste-simple liste-compteurs">
              {parType.map(({ m, n }) => {
                const part = Math.round((n / Math.max(1, a.ouverts.length)) * 100);
                return (
                  <li key={m.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link className="avec-pastille" to={`/dossiers?type=${m.id}`} style={{ color: 'inherit', fontWeight: 'var(--graisse-forte)' }}>
                        <span className="pastille" style={{ background: m.couleur }} />
                        <span>{m.nom}</span>
                      </Link>
                      <div className="barre-mix" style={{ '--accent-modele': m.couleur } as CSSProperties}>
                        <div style={{ width: `${part}%` }} />
                      </div>
                    </div>
                    <Link to={`/dossiers?type=${m.id}`} aria-label={`${n} dossier(s) ${m.nom}`} className="compteur">
                      {n}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </StaggerGrille>

      {mesDossiers.length === 0 && blocMesDossiers}
    </EntreePage>
  );
}
