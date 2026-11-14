import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeDoc, BadgeDossier, Barre, Modale, Vide, notifier, tenter } from '../components/ui';
import { ouvrirFichier, TAILLE_MAX, TYPES_ACCEPTES } from '../lib/fichiers';
import { LIBELLES_MESSAGES, lienEspaceClient, lienWhatsApp, rediger, type TypeMessage } from '../lib/messages';
import {
  compteDocuments, date, dateHeure, echeanceExigible, formatSoldes, fraisBloquants, joursAvant, montant, nomClient,
  progression, resteEcheance, resteFrais, soldes, totalPaye,
} from '../lib/regles';
import {
  ajouterDocument, ajouterNote, annulerPaiement, changerAgent, changerStatut, encaisser, fixerRdv, journaliserMessage,
  majExpiration, marquerVerse, refuserDocument, rouvrirEtape, televerserDocument, useBase, useUtilisateur, validerDocument, validerEtape,
} from '../lib/store';
import type { Client, Dossier, ModePaiement, Paiement, TypeEvenement } from '../lib/types';

type Onglet = 'documents' | 'paiements' | 'etapes' | 'journal';

export default function DossierDetail() {
  const { id } = useParams();
  const base = useBase();
  const user = useUtilisateur()!;
  const [params, setParams] = useSearchParams();
  const onglet = (params.get('onglet') ?? 'documents') as Onglet;
  const [wa, setWa] = useState<TypeMessage | null>(null);
  const [cloture, setCloture] = useState<'termine' | 'annule' | null>(null);

  const d = base.dossiers.find((x) => x.id === id);
  if (!d) return <Vide>Ce dossier n'existe pas. <Link to="/dossiers">Retour aux dossiers</Link></Vide>;
  const c = base.clients.find((x) => x.id === d.clientId)!;
  const m = base.modeles.find((x) => x.id === d.modeleId);
  const p = progression(d);
  const docs = compteDocuments(d);
  const s = soldes(d);

  const onglets: [Onglet, string][] = [
    ['documents', `Documents (${docs.valide}/${d.documents.length})`],
    ['paiements', 'Paiements'],
    ['etapes', `Étapes (${p.faites}/${p.total})`],
    ['journal', `Journal (${d.journal.length})`],
  ];

  return (
    <>
      <div className="entete">
        <div>
          <div className="petit"><Link to={`/clients/${c.id}`}>← {nomClient(c)}</Link></div>
          <h1 style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="pastille" style={{ background: m?.couleur, width: 14, height: 14 }} />
            {d.intitule} <BadgeDossier statut={d.statut} />
          </h1>
          <div className="muted">{d.numero} · ouvert le {date(d.ouvertLe)}</div>
        </div>
        <div className="actions">
          <Link className="btn" to={`/espace/${d.id}`} title="Voir ce que le client voit">👁 Espace client</Link>
          <MenuWhatsApp onChoisir={setWa} dossier={d} />
          {d.statut === 'en_cours' ? (
            <>
              <button onClick={() => setCloture('termine')}>✔ Clôturer</button>
              <button className="btn-danger" onClick={() => setCloture('annule')}>Annuler le dossier</button>
            </>
          ) : (
            <button onClick={() => tenter(() => changerStatut(d.id, 'en_cours'), 'Dossier rouvert')}>Rouvrir le dossier</button>
          )}
        </div>
      </div>

      <div className="grille g4" style={{ marginBottom: 16 }}>
        <div className="carte">
          <div className="petit muted">Étape en cours</div>
          <b>{p.courante?.nom ?? 'Toutes les étapes sont faites'}</b>
          <div style={{ marginTop: 8 }}><Barre pourcent={p.pourcent} /></div>
          <div className="petit muted">{p.faites}/{p.total} étapes · {p.pourcent} %</div>
        </div>
        <div className="carte">
          <div className="petit muted">Documents</div>
          <b>{docs.valide} validés / {d.documents.length}</b>
          <div className="petit" style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {docs.manquant > 0 && <span className="badge b-gris">{docs.manquant} manquants</span>}
            {docs.envoye > 0 && <span className="badge b-bleu">{docs.envoye} à vérifier</span>}
            {docs.refuse > 0 && <span className="badge b-rouge">{docs.refuse} refusés</span>}
          </div>
        </div>
        <div className="carte">
          <div className="petit muted">Reste à payer</div>
          <b>{formatSoldes(s, 'reste')}</b>
          <div className="petit muted" style={{ marginTop: 6 }}>Payé : {formatSoldes(s, 'paye')}</div>
        </div>
        <div className="carte">
          <div className="petit muted">Agent responsable</div>
          <select value={d.agentId} aria-label="Agent responsable" onChange={(e) => tenter(() => changerAgent(d.id, e.target.value), 'Agent modifié')} style={{ marginTop: 4 }}>
            {base.utilisateurs.filter((u) => u.role !== 'client').map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </select>
          <div className="petit muted" style={{ marginTop: 6 }}>
            {d.rdv ? <>📅 RDV {dateHeure(d.rdv.date)} – {d.rdv.lieu}</> : 'Aucun rendez-vous'}
          </div>
        </div>
      </div>

      <div className="carte">
        <div className="onglets" role="tablist">
          {onglets.map(([k, lib]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? 'actif' : ''} onClick={() => setParams({ onglet: k }, { replace: true })}>{lib}</button>
          ))}
        </div>
        {onglet === 'documents' && <OngletDocuments d={d} />}
        {onglet === 'paiements' && <OngletPaiements d={d} admin={user.role === 'admin'} />}
        {onglet === 'etapes' && <OngletEtapes d={d} onCloturer={() => setCloture('termine')} />}
        {onglet === 'journal' && <OngletJournal d={d} />}
      </div>

      {wa && <ModaleWhatsApp type={wa} d={d} c={c} onFermer={() => setWa(null)} />}
      {cloture && <ModaleCloture d={d} statut={cloture} onFermer={() => setCloture(null)} />}
    </>
  );
}

/* ====================== Documents ====================== */

function OngletDocuments({ d }: { d: Dossier }) {
  const base = useBase();
  const [refus, setRefus] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cible = useRef<string>('');
  const nom = (uid?: string) => base.utilisateurs.find((u) => u.id === uid)?.nom ?? (uid ? 'Client' : '');

  const choisir = (docId: string) => { cible.current = docId; input.current?.click(); };
  const fichierChoisi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > TAILLE_MAX) { notifier('Fichier trop lourd (10 Mo maximum). Réduisez la qualité du scan ou de la photo.', true); return; }
    await tenter(() => televerserDocument(d.id, cible.current, f), 'Document téléversé et validé');
  };

  return (
    <>
      <input ref={input} type="file" accept={TYPES_ACCEPTES} capture="environment" hidden onChange={fichierChoisi} />
      <div className="alerte alerte-bleu petit">Document remis à l'agence : téléversez le scan ou la photo, il est validé directement. Aucun fichier ne doit rester sur le PC.</div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Document</th><th>Statut</th><th>Fichier</th><th>Expiration</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {d.documents.map((doc) => {
              const j = doc.expiration ? joursAvant(doc.expiration) : null;
              return (
                <tr key={doc.id}>
                  <td>
                    <b>{doc.nom}</b>
                    {doc.statut === 'refuse' && <div className="petit" style={{ color: 'var(--rouge)' }}>Motif : {doc.motifRefus}</div>}
                    {doc.majLe && <div className="petit muted">{dateHeure(doc.majLe)} · {nom(doc.majPar)}</div>}
                  </td>
                  <td><BadgeDoc statut={doc.statut} /></td>
                  <td className="petit">{doc.nomFichier ? (doc.fichierId ? <button className="btn-petit" onClick={() => ouvrirFichier(doc.fichierId!)}>👁 {doc.nomFichier.slice(0, 22)}</button> : <span className="muted">{doc.nomFichier}</span>) : '—'}</td>
                  <td>
                    {doc.avecExpiration ? (
                      <>
                        <input type="date" value={doc.expiration ?? ''} aria-label={`Date d'expiration : ${doc.nom}`} style={{ maxWidth: 160 }}
                          onChange={(e) => majExpiration(d.id, doc.id, e.target.value)} />
                        {j !== null && j <= base.parametres.joursAlerteExpiration && (
                          <div className={`petit`} style={{ color: j < 0 ? 'var(--rouge)' : 'var(--orange)' }}>{j < 0 ? 'Expiré' : `Expire dans ${j} j`}</div>
                        )}
                      </>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {doc.statut === 'envoye' && <>
                        <button className="btn-petit btn-primaire" onClick={() => tenter(() => validerDocument(d.id, doc.id), 'Document validé')}>Valider</button>
                        <button className="btn-petit btn-danger" onClick={() => setRefus(doc.id)}>Refuser</button>
                      </>}
                      {doc.statut === 'valide' && <button className="btn-petit btn-danger" onClick={() => setRefus(doc.id)}>Refuser</button>}
                      <button className="btn-petit" onClick={() => choisir(doc.id)}>{doc.statut === 'manquant' ? '⬆ Téléverser' : '⬆ Remplacer'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}><button onClick={() => setAjout(true)}>＋ Demander un autre document</button></div>
      {refus && <ModaleRefus onFermer={() => setRefus(null)} onValider={(motif) => tenter(() => { refuserDocument(d.id, refus, motif); setRefus(null); }, 'Document refusé : pensez à prévenir le client')} />}
      {ajout && <ModaleAjoutDoc onFermer={() => setAjout(false)} onValider={(n, exp) => tenter(() => { ajouterDocument(d.id, n, exp); setAjout(false); }, 'Document ajouté à la check-list')} />}
    </>
  );
}

const MOTIFS = ['Photo floue ou illisible', 'Document incomplet (pages manquantes)', 'Document expiré', 'Traduction non certifiée', 'Document non signé', 'Mauvais document'];

function ModaleRefus({ onFermer, onValider }: { onFermer: () => void; onValider: (m: string) => void }) {
  const [motif, setMotif] = useState('');
  const [touche, setTouche] = useState(false);
  return (
    <Modale titre="Refuser le document" onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); setTouche(true); if (motif.trim()) onValider(motif.trim()); }}>
        <p className="muted petit">Le motif sera visible par le client dans son espace.</p>
        <div className="actions" style={{ marginBottom: 12 }}>
          {MOTIFS.map((x) => <button type="button" key={x} className="btn-petit" onClick={() => setMotif(x)}>{x}</button>)}
        </div>
        <div className="champ"><label htmlFor="motif">Motif du refus</label>
          <textarea id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} onBlur={() => setTouche(true)} />
          {touche && !motif.trim() && <div className="erreur">Indiquez le motif pour que le client sache quoi corriger.</div>}
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire">Refuser le document</button></div>
      </form>
    </Modale>
  );
}

function ModaleAjoutDoc({ onFermer, onValider }: { onFermer: () => void; onValider: (nom: string, exp: boolean) => void }) {
  const [nom, setNom] = useState('');
  const [exp, setExp] = useState(false);
  return (
    <Modale titre="Demander un autre document" onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (nom.trim()) onValider(nom.trim(), exp); }}>
        <div className="champ"><label htmlFor="n">Nom du document</label><input id="n" value={nom} onChange={(e) => setNom(e.target.value)} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={exp} onChange={(e) => setExp(e.target.checked)} /> Ce document a une date d'expiration</label>
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire" disabled={!nom.trim()}>Ajouter à la check-list</button></div>
      </form>
    </Modale>
  );
}

/* ====================== Paiements ====================== */

const MODES: Record<ModePaiement, string> = { especes: 'Espèces', ccp: 'CCP', baridimob: 'BaridiMob', virement: 'Virement bancaire' };

function OngletPaiements({ d, admin }: { d: Dossier; admin: boolean }) {
  const base = useBase();
  const [encaisse, setEncaisse] = useState<Paiement['cible'] | null>(null);
  const [annul, setAnnul] = useState<Paiement | null>(null);
  const nom = (uid: string) => base.utilisateurs.find((u) => u.id === uid)?.nom ?? '';
  const libelleCible = (p: Paiement) => p.cible.type === 'echeance'
    ? d.echeances.find((e) => e.id === p.cible.id)?.libelle
    : d.frais.find((f) => f.id === p.cible.id)?.nom;

  return (
    <>
      <h3>Honoraires de l'agence <span className="muted petit">(50 % au dépôt, 50 % à la fin de la procédure)</span></h3>
      <div className="table-scroll" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Échéance</th><th className="num">Montant</th><th className="num">Payé</th><th className="num">Reste</th><th>État</th><th></th></tr></thead>
          <tbody>
            {d.echeances.map((e) => {
              const reste = resteEcheance(d, e.id);
              const exig = echeanceExigible(d, e.moment);
              return (
                <tr key={e.id}>
                  <td>{e.libelle}</td>
                  <td className="num">{montant(e.montant, e.devise)}</td>
                  <td className="num">{montant(totalPaye(d, 'echeance', e.id), e.devise)}</td>
                  <td className="num"><b>{montant(reste, e.devise)}</b></td>
                  <td>{reste === 0 ? <span className="badge b-vert">Payé</span> : exig ? <span className="badge b-orange">À encaisser</span> : <span className="badge b-gris">À la fin de la procédure</span>}</td>
                  <td className="num">{reste > 0 && d.statut !== 'annule' && <button className="btn-petit btn-primaire" onClick={() => setEncaisse({ type: 'echeance', id: e.id })}>Encaisser</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Frais de procédure <span className="muted petit">(payés à 100 % d'avance par le client)</span></h3>
      <div className="table-scroll" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Frais</th><th>Organisme</th><th className="num">Montant</th><th>Client</th><th>Versé à l'organisme</th><th></th></tr></thead>
          <tbody>
            {d.frais.map((f) => {
              const reste = resteFrais(d, f);
              return (
                <tr key={f.id}>
                  <td>{f.nom}</td>
                  <td className="petit muted">{f.organisme}</td>
                  <td className="num">{montant(f.montant, f.devise)}</td>
                  <td>{reste === 0 ? <span className="badge b-vert">Encaissé</span> : <span className="badge b-orange">Reste {montant(reste, f.devise)}</span>}</td>
                  <td>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0, color: 'var(--texte)' }}>
                      <input type="checkbox" checked={f.verse} disabled={reste > 0 && !f.verse}
                        onChange={(e) => tenter(() => marquerVerse(d.id, f.id, e.target.checked), e.target.checked ? 'Versement enregistré' : 'Versement annulé')} />
                      {f.verse ? <span className="petit">Oui, le {date(f.verseLe)}</span> : <span className="petit muted">{reste > 0 ? 'Encaisser d’abord' : 'Non'}</span>}
                    </label>
                  </td>
                  <td className="num">{reste > 0 && d.statut !== 'annule' && <button className="btn-petit btn-primaire" onClick={() => setEncaisse({ type: 'frais', id: f.id })}>Encaisser</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Historique des encaissements</h3>
      {d.paiements.length === 0 ? <Vide>Aucun encaissement pour ce dossier.</Vide> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Reçu</th><th>Date</th><th>Objet</th><th>Mode</th><th className="num">Montant</th><th>Par</th><th></th></tr></thead>
            <tbody>
              {[...d.paiements].reverse().map((p) => (
                <tr key={p.id} style={p.annule ? { opacity: .55 } : undefined}>
                  <td>{p.numeroRecu}</td>
                  <td className="petit">{dateHeure(p.date)}</td>
                  <td className="petit">{libelleCible(p)}{p.annule && <div style={{ color: 'var(--rouge)' }}>Annulé : {p.annule.motif} ({nom(p.annule.par)})</div>}</td>
                  <td className="petit">{MODES[p.mode]}</td>
                  <td className="num" style={p.annule ? { textDecoration: 'line-through' } : undefined}>{montant(p.montant, p.devise)}</td>
                  <td className="petit">{nom(p.par)}</td>
                  <td><div className="actions" style={{ justifyContent: 'flex-end' }}>
                    {!p.annule && <Link className="btn btn-petit" to={`/dossiers/${d.id}/recu/${p.id}`}>🧾 Reçu</Link>}
                    {!p.annule && admin && <button className="btn-petit btn-danger" onClick={() => setAnnul(p)}>Annuler</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {encaisse && <ModaleEncaisser d={d} cible={encaisse} onFermer={() => setEncaisse(null)} />}
      {annul && <ModaleAnnulation p={annul} onFermer={() => setAnnul(null)} onValider={(motif) => tenter(() => { annulerPaiement(d.id, annul.id, motif); setAnnul(null); }, 'Paiement annulé')} />}
    </>
  );
}

function ModaleEncaisser({ d, cible, onFermer }: { d: Dossier; cible: Paiement['cible']; onFermer: () => void }) {
  const ech = cible.type === 'echeance' ? d.echeances.find((e) => e.id === cible.id)! : null;
  const fr = cible.type === 'frais' ? d.frais.find((f) => f.id === cible.id)! : null;
  const reste = ech ? resteEcheance(d, ech.id) : resteFrais(d, fr!);
  const devise = (ech ?? fr)!.devise;
  const [val, setVal] = useState(String(reste));
  const [mode, setMode] = useState<ModePaiement>('especes');
  const [recu, setRecu] = useState<Paiement | null>(null);
  const n = Number(val.replace(',', '.').replace(/\s/g, ''));
  const err = !(n > 0) ? 'Saisissez un montant supérieur à 0.' : n > reste ? `Maximum : ${montant(reste, devise)}.` : '';

  if (recu) return (
    <Modale titre="Encaissement enregistré" onFermer={onFermer}>
      <p>Reçu <b>{recu.numeroRecu}</b> : {montant(recu.montant, recu.devise)}.</p>
      <div className="pied"><button onClick={onFermer}>Fermer</button><Link className="btn btn-primaire" to={`/dossiers/${d.id}/recu/${recu.id}`}>🧾 Imprimer le reçu</Link></div>
    </Modale>
  );
  return (
    <Modale titre={`Encaisser – ${(ech?.libelle ?? fr?.nom)}`} onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (err) return; tenter(() => setRecu(encaisser(d.id, cible, n, mode))); }}>
        <p className="muted petit">Reste à payer : <b>{montant(reste, devise)}</b>{fr && ' · les frais de procédure se règlent en totalité avant l’étape concernée.'}</p>
        <div className="champ"><label htmlFor="mt">Montant reçu ({devise})</label>
          <input id="mt" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
          {val !== '' && err && <div className="erreur">{err}</div>}
        </div>
        <div className="champ"><label htmlFor="md">Mode de paiement</label>
          <select id="md" value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)}>
            {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire" disabled={!!err}>Enregistrer l'encaissement</button></div>
      </form>
    </Modale>
  );
}

function ModaleAnnulation({ p, onFermer, onValider }: { p: Paiement; onFermer: () => void; onValider: (m: string) => void }) {
  const [motif, setMotif] = useState('');
  return (
    <Modale titre={`Annuler le paiement ${p.numeroRecu}`} onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (motif.trim()) onValider(motif.trim()); }}>
        <div className="alerte alerte-orange">Le paiement de {montant(p.montant, p.devise)} restera visible dans l'historique, barré, avec votre nom et le motif.</div>
        <div className="champ"><label htmlFor="mo">Motif de l'annulation</label><textarea id="mo" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : erreur de saisie, remboursement…" /></div>
        <div className="pied"><button type="button" onClick={onFermer}>Garder le paiement</button><button type="submit" className="btn-primaire" disabled={!motif.trim()}>Annuler ce paiement</button></div>
      </form>
    </Modale>
  );
}

/* ====================== Étapes ====================== */

function OngletEtapes({ d, onCloturer }: { d: Dossier; onCloturer: () => void }) {
  const base = useBase();
  const p = progression(d);
  const nom = (uid?: string) => base.utilisateurs.find((u) => u.id === uid)?.nom ?? '';
  return (
    <>
      {p.faites === p.total && d.statut === 'en_cours' && (
        <div className="alerte alerte-orange">Toutes les étapes sont faites : la 2ᵉ tranche des honoraires (50 %) est maintenant exigible. <button className="btn-petit" onClick={onCloturer}>Clôturer le dossier</button></div>
      )}
      <ol className="etapes">
        {d.etapes.map((e, i) => {
          const bloq = fraisBloquants(d, e);
          const courante = p.courante?.id === e.id;
          return (
            <li key={e.id} className={`etape ${e.faite ? 'faite' : ''} ${courante ? 'courante' : ''}`}>
              <div className="rond">{e.faite ? '✓' : i + 1}</div>
              <div className="corps">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <b>{e.nom}</b> {courante && <span className="badge b-bleu">En cours</span>}
                    {e.faite && <div className="petit muted">Fait le {dateHeure(e.faiteLe!)} par {nom(e.faitePar)}</div>}
                    {e.fraisRequis.length > 0 && (
                      <div className="petit" style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {e.fraisRequis.map((fid) => {
                          const f = d.frais.find((x) => x.id === fid);
                          if (!f) return null;
                          const ok = resteFrais(d, f) === 0;
                          return <span key={fid} className={`badge ${ok ? 'b-vert' : 'b-rouge'}`}>{ok ? '✓' : '🔒'} {f.nom}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  {d.statut === 'en_cours' && (e.faite
                    ? <button className="btn-petit" onClick={() => tenter(() => rouvrirEtape(d.id, e.id), 'Étape rouverte')}>Rouvrir</button>
                    : <button className={`btn-petit ${courante ? 'btn-primaire' : ''}`} disabled={bloq.length > 0}
                        title={bloq.length ? `Frais à encaisser d'abord : ${bloq.map((f) => f.nom).join(', ')}` : undefined}
                        onClick={() => tenter(() => validerEtape(d.id, e.id), 'Étape enregistrée')}>
                        {bloq.length ? '🔒 Frais non encaissés' : 'Marquer comme faite'}
                      </button>)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ====================== Journal ====================== */

const ICONES: Record<TypeEvenement, string> = { creation: '📁', document: '📄', paiement: '💰', etape: '✅', note: '📝', rdv: '📅', statut: '🔁', message: '💬' };

function OngletJournal({ d }: { d: Dossier }) {
  const base = useBase();
  const [note, setNote] = useState('');
  const [interne, setInterne] = useState(true);
  const [rdvDate, setRdvDate] = useState(d.rdv?.date ?? '');
  const [rdvLieu, setRdvLieu] = useState(d.rdv?.lieu ?? '');
  const nom = (uid: string) => base.utilisateurs.find((u) => u.id === uid)?.nom ?? 'Client';
  return (
    <div className="grille g-2-1">
      <div>
        <ul className="journal">
          {[...d.journal].reverse().map((e) => (
            <li key={e.id}>
              <div className="icone">{ICONES[e.type]}</div>
              <div style={{ flex: 1 }}>
                <div>{e.texte} {e.interne && <span className="badge b-gris">Interne</span>}</div>
                <div className="petit muted">{dateHeure(e.date)} · {nom(e.par)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <form className="carte" style={{ marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; tenter(() => { ajouterNote(d.id, note.trim(), interne); setNote(''); }, 'Note ajoutée'); }}>
          <h3>Ajouter une note</h3>
          <div className="champ"><label htmlFor="note">Ce qui a été fait</label><textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : appel à l'ambassade, dossier transmis à l'employeur…" /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} /> Note interne (invisible pour le client)</label>
          <button type="submit" className="btn-primaire" disabled={!note.trim()} style={{ marginTop: 8 }}>Ajouter la note</button>
        </form>
        <form className="carte" onSubmit={(e) => { e.preventDefault(); tenter(() => fixerRdv(d.id, rdvDate, rdvLieu), rdvDate ? 'Rendez-vous enregistré' : 'Rendez-vous supprimé'); }}>
          <h3>Rendez-vous</h3>
          <div className="champ"><label htmlFor="rd">Date et heure</label><input id="rd" type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} /></div>
          <div className="champ"><label htmlFor="rl">Lieu</label><input id="rl" value={rdvLieu} onChange={(e) => setRdvLieu(e.target.value)} placeholder="Ex. : TLScontact Alger, VFS Oran…" /></div>
          <button type="submit">{rdvDate ? 'Enregistrer le rendez-vous' : 'Supprimer le rendez-vous'}</button>
        </form>
      </div>
    </div>
  );
}

/* ====================== WhatsApp / e-mail ====================== */

function MenuWhatsApp({ onChoisir, dossier }: { onChoisir: (t: TypeMessage) => void; dossier: Dossier }) {
  const [ouvert, setOuvert] = useState(false);
  const types = (Object.keys(LIBELLES_MESSAGES) as TypeMessage[]).filter((t) =>
    (t !== 'rdv' || dossier.rdv) && (t !== 'refuse' || dossier.documents.some((x) => x.statut === 'refuse')));
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-wa" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>💬 Prévenir le client ▾</button>
      {ouvert && (
        <div className="carte" style={{ position: 'absolute', right: 0, top: 42, zIndex: 20, padding: 6, minWidth: 230 }} onMouseLeave={() => setOuvert(false)}>
          {types.map((t) => (
            <button key={t} style={{ width: '100%', border: 0, justifyContent: 'flex-start' }} onClick={() => { setOuvert(false); onChoisir(t); }}>{LIBELLES_MESSAGES[t]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModaleWhatsApp({ type, d, c, onFermer }: { type: TypeMessage; d: Dossier; c: Client; onFermer: () => void }) {
  const base = useBase();
  const lien = lienEspaceClient(d);
  const [texte, setTexte] = useState(() => rediger(type, c, d, base.parametres, lien));
  const destinataires = [{ nom: nomClient(c), tel: c.telephone, email: c.email }, ...(c.contactSuivi ? [{ nom: c.contactSuivi.nom, tel: c.contactSuivi.telephone, email: c.contactSuivi.email }] : [])];
  const [dest, setDest] = useState(0);
  const cible = destinataires[dest];
  const tracer = (canal: string) => journaliserMessage(d.id, `Message « ${LIBELLES_MESSAGES[type]} » envoyé par ${canal} à ${cible.nom}`);
  return (
    <Modale titre={`Prévenir le client – ${LIBELLES_MESSAGES[type]}`} onFermer={onFermer} large>
      {destinataires.length > 1 && (
        <div className="champ"><label htmlFor="dest">Destinataire</label>
          <select id="dest" value={dest} onChange={(e) => setDest(Number(e.target.value))}>{destinataires.map((x, i) => <option key={i} value={i}>{x.nom} (+{x.tel})</option>)}</select>
        </div>
      )}
      <div className="champ">
        <label htmlFor="msg">Message ({c.langue === 'ar' ? 'arabe' : 'français'}) – modifiable avant l'envoi</label>
        <textarea id="msg" value={texte} onChange={(e) => setTexte(e.target.value)} dir={c.langue === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: 220 }} />
      </div>
      <div className="pied">
        <button onClick={onFermer}>Fermer</button>
        {cible.email && (
          <a className="btn" href={`mailto:${cible.email}?subject=${encodeURIComponent(`World Destination – dossier ${d.numero}`)}&body=${encodeURIComponent(texte)}`}
            onClick={() => tracer('e-mail')}>✉️ Envoyer par e-mail</a>
        )}
        <a className="btn btn-wa" href={lienWhatsApp(cible.tel, texte)} target="_blank" rel="noopener noreferrer"
          onClick={() => { tracer('WhatsApp'); notifier('WhatsApp ouvert : appuyez sur Envoyer dans WhatsApp'); }}>💬 Ouvrir dans WhatsApp</a>
      </div>
    </Modale>
  );
}

/* ====================== Clôture ====================== */

function ModaleCloture({ d, statut, onFermer }: { d: Dossier; statut: 'termine' | 'annule'; onFermer: () => void }) {
  const [motif, setMotif] = useState('');
  const p = progression(d);
  const s = soldes(d);
  const reste = formatSoldes(s, 'reste');
  return (
    <Modale titre={statut === 'termine' ? 'Clôturer le dossier' : 'Annuler le dossier'} onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (statut === 'annule' && !motif.trim()) return; tenter(() => { changerStatut(d.id, statut, motif.trim() || undefined); onFermer(); }, statut === 'termine' ? 'Dossier clôturé' : 'Dossier annulé'); }}>
        {statut === 'termine' && p.faites < p.total && <div className="alerte alerte-orange">{p.total - p.faites} étape(s) ne sont pas marquées comme faites.</div>}
        {reste !== '0' && <div className="alerte alerte-orange">Reste à payer : <b>{reste}</b>{statut === 'termine' && ' (la 2ᵉ tranche des honoraires devient exigible).'}</div>}
        <div className="champ"><label htmlFor="mc">{statut === 'annule' ? 'Motif de l’annulation' : 'Résultat (facultatif)'}</label>
          <textarea id="mc" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={statut === 'termine' ? 'Ex. : visa accordé le…' : 'Ex. : désistement du client, visa refusé…'} />
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>Retour</button>
          <button type="submit" className="btn-primaire" disabled={statut === 'annule' && !motif.trim()}>{statut === 'termine' ? 'Clôturer le dossier' : 'Annuler le dossier'}</button></div>
      </form>
    </Modale>
  );
}
