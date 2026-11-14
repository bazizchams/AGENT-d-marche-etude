import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icone, type NomIcone } from '../components/Icone';
import { BadgeDoc, BadgeDossier, Barre, Modale, Onglets, Vide, notifier, tenter } from '../components/ui';
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
  if (!d) return <Vide icone="dossier" action={<Link className="btn btn-petit" to="/dossiers">Retour aux dossiers</Link>}>Ce dossier n'existe pas ou a été supprimé.</Vide>;
  const c = base.clients.find((x) => x.id === d.clientId)!;
  const m = base.modeles.find((x) => x.id === d.modeleId);
  const p = progression(d);
  const docs = compteDocuments(d);
  const s = soldes(d);

  const onglets: [Onglet, React.ReactNode][] = [
    ['documents', <>Documents <span className="compte">{docs.valide}/{d.documents.length}</span></>],
    ['paiements', 'Paiements'],
    ['etapes', <>Étapes <span className="compte">{p.faites}/{p.total}</span></>],
    ['journal', <>Journal <span className="compte">{d.journal.length}</span></>],
  ];

  return (
    <>
      <div className="entete">
        <div>
          <Link className="fil" to={`/clients/${c.id}`}><Icone nom="retour" taille={16} /> {nomClient(c)}</Link>
          <h1 style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="pastille" style={{ background: m?.couleur, width: 14, height: 14 }} title={m?.nom} />
            {d.intitule} <BadgeDossier statut={d.statut} />
          </h1>
          <div className="muted">{d.numero} · ouvert le {date(d.ouvertLe)}</div>
        </div>
        <div className="actions">
          <Link className="btn" to={`/espace/${d.id}`} title="Voir ce que le client voit"><Icone nom="oeil" taille={16} /> Espace client</Link>
          <MenuWhatsApp onChoisir={setWa} dossier={d} />
          {d.statut === 'en_cours' ? (
            <>
              <button type="button" onClick={() => setCloture('termine')}><Icone nom="coche" taille={16} /> Clôturer le dossier</button>
              <button type="button" className="btn-danger" onClick={() => setCloture('annule')}>Annuler le dossier</button>
            </>
          ) : (
            <button type="button" onClick={() => tenter(() => changerStatut(d.id, 'en_cours'), 'Dossier rouvert')}><Icone nom="boucle" taille={16} /> Rouvrir le dossier</button>
          )}
        </div>
      </div>

      <div className="grille g4 g4-mobile-2 resume">
        <div className="carte carte-large">
          <div className="etiquette">Étape en cours</div>
          <div className="valeur">{p.courante?.nom ?? 'Toutes les étapes sont faites'}</div>
          <div style={{ marginTop: 6 }}><Barre pourcent={p.pourcent} label="Avancement des étapes" /></div>
          <div className="petit muted">{p.faites}/{p.total} étapes · {p.pourcent} %</div>
        </div>
        <div className="carte">
          <div className="etiquette">Documents</div>
          <div className="valeur">{docs.valide} validés / {d.documents.length}</div>
          <div className="petit" style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {docs.manquant > 0 && <span className="badge b-gris">{docs.manquant} manquants</span>}
            {docs.envoye > 0 && <span className="badge b-bleu">{docs.envoye} à vérifier</span>}
            {docs.refuse > 0 && <span className="badge b-rouge">{docs.refuse} refusés</span>}
          </div>
        </div>
        <div className="carte">
          <div className="etiquette">Reste à payer</div>
          <div className="valeur">{formatSoldes(s, 'reste')}</div>
          <div className="petit muted" style={{ marginTop: 6 }}>Payé : {formatSoldes(s, 'paye')}</div>
        </div>
        <div className="carte carte-large">
          <label className="etiquette" htmlFor="agent-responsable" style={{ fontWeight: 400, margin: 0 }}>Agent responsable</label>
          <select id="agent-responsable" value={d.agentId} onChange={(e) => tenter(() => changerAgent(d.id, e.target.value), 'Agent modifié')} style={{ marginTop: 4 }}>
            {base.utilisateurs.filter((u) => u.role !== 'client').map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </select>
          <div className="petit muted" style={{ marginTop: 6 }}>
            {d.rdv ? <span className="avec-pastille" style={{ gap: 6 }}><Icone nom="calendrier" taille={14} /> RDV {dateHeure(d.rdv.date)} – {d.rdv.lieu}</span> : 'Aucun rendez-vous'}
          </div>
        </div>
      </div>

      <div className="carte">
        <Onglets label="Sections du dossier" valeur={onglet} onglets={onglets} onChanger={(k) => setParams({ onglet: k }, { replace: true })}>
          {onglet === 'documents' && <OngletDocuments d={d} />}
          {onglet === 'paiements' && <OngletPaiements d={d} admin={user.role === 'admin'} />}
          {onglet === 'etapes' && <OngletEtapes d={d} onCloturer={() => setCloture('termine')} />}
          {onglet === 'journal' && <OngletJournal d={d} />}
        </Onglets>
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
      <div className="alerte alerte-bleu"><Icone nom="info" /><div>Document remis à l'agence : téléversez le scan ou la photo, il est validé directement. Aucun fichier ne doit rester sur le PC.</div></div>
      <div className="table-scroll">
        <table className="table-cartes">
          <thead><tr><th>Document</th><th>Statut</th><th>Fichier</th><th>Expiration</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {d.documents.map((doc) => {
              const j = doc.expiration ? joursAvant(doc.expiration) : null;
              return (
                <tr key={doc.id}>
                  <td className="titre-ligne">
                    <b>{doc.nom}</b>
                    {doc.statut === 'refuse' && <div className="petit" style={{ color: 'var(--rouge)' }}>Motif : {doc.motifRefus}</div>}
                    {doc.majLe && <div className="petit muted">{dateHeure(doc.majLe)} · {nom(doc.majPar)}</div>}
                  </td>
                  <td data-label="Statut"><BadgeDoc statut={doc.statut} /></td>
                  <td data-label="Fichier" className={`petit ${doc.nomFichier ? '' : 'masque-mobile'}`}>{doc.nomFichier ? (doc.fichierId ? <button type="button" className="btn-petit" title={doc.nomFichier} onClick={() => ouvrirFichier(doc.fichierId!)}><Icone nom="fichier" taille={15} /> {doc.nomFichier.length > 24 ? doc.nomFichier.slice(0, 22) + '…' : doc.nomFichier}</button> : <span className="muted">{doc.nomFichier}</span>) : <span className="muted" aria-label="Aucun fichier">—</span>}</td>
                  <td data-label="Expiration" className={doc.avecExpiration ? '' : 'masque-mobile'}>
                    {doc.avecExpiration ? (
                      <>
                        <input type="date" value={doc.expiration ?? ''} aria-label={`Date d'expiration : ${doc.nom}`} style={{ maxWidth: 170 }}
                          onChange={(e) => majExpiration(d.id, doc.id, e.target.value)} />
                        {j !== null && j <= base.parametres.joursAlerteExpiration && (
                          <div className={`petit`} style={{ color: j < 0 ? 'var(--rouge)' : 'var(--orange)' }}>{j < 0 ? 'Expiré' : `Expire dans ${j} j`}</div>
                        )}
                      </>
                    ) : <span className="muted" aria-label="Sans expiration">—</span>}
                  </td>
                  <td className="cellule-actions">
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {doc.statut === 'envoye' && <>
                        <button type="button" className="btn-petit btn-primaire" onClick={() => tenter(() => validerDocument(d.id, doc.id), 'Document validé')}>Valider</button>
                        <button type="button" className="btn-petit btn-danger" onClick={() => setRefus(doc.id)}>Refuser</button>
                      </>}
                      {doc.statut === 'valide' && <button type="button" className="btn-petit btn-danger" onClick={() => setRefus(doc.id)}>Refuser</button>}
                      <button type="button" className={`btn-petit ${doc.statut === 'manquant' ? 'btn-primaire' : ''}`} onClick={() => choisir(doc.id)}><Icone nom="televerser" taille={15} /> {doc.statut === 'manquant' ? 'Téléverser' : 'Remplacer'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}><button type="button" onClick={() => setAjout(true)}><Icone nom="plus" taille={16} /> Demander un autre document</button></div>
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
        <div className="actions" style={{ marginBottom: 12 }} role="group" aria-label="Motifs fréquents">
          {MOTIFS.map((x) => <button type="button" key={x} className="btn-petit" aria-pressed={motif === x} onClick={() => setMotif(x)}>{x}</button>)}
        </div>
        <div className="champ"><label htmlFor="motif">Motif du refus</label>
          <textarea id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} onBlur={() => setTouche(true)} aria-invalid={touche && !motif.trim()} aria-describedby="motif-err" />
          {touche && !motif.trim() && <div className="erreur" id="motif-err">Indiquez le motif pour que le client sache quoi corriger.</div>}
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-danger-plein">Refuser le document</button></div>
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
        <label className="case"><input type="checkbox" checked={exp} onChange={(e) => setExp(e.target.checked)} /> Ce document a une date d'expiration</label>
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
      <h3>Honoraires de l'agence <span className="muted petit" style={{ fontWeight: 400 }}>50 % au dépôt, 50 % à la fin de la procédure</span></h3>
      <div className="table-scroll" style={{ marginBottom: 20 }}>
        <table className="table-cartes">
          <thead><tr><th>Échéance</th><th className="num">Montant</th><th className="num">Payé</th><th className="num">Reste</th><th>État</th><th></th></tr></thead>
          <tbody>
            {d.echeances.map((e) => {
              const reste = resteEcheance(d, e.id);
              const exig = echeanceExigible(d, e.moment);
              return (
                <tr key={e.id}>
                  <td className="titre-ligne">{e.libelle}</td>
                  <td data-label="Montant" className="num">{montant(e.montant, e.devise)}</td>
                  <td data-label="Payé" className="num">{montant(totalPaye(d, 'echeance', e.id), e.devise)}</td>
                  <td data-label="Reste" className="num"><b>{montant(reste, e.devise)}</b></td>
                  <td data-label="État">{reste === 0 ? <span className="badge b-vert">Payé</span> : exig ? <span className="badge b-orange">À encaisser</span> : <span className="badge b-gris">À la fin de la procédure</span>}</td>
                  <td className="num cellule-actions">{reste > 0 && d.statut !== 'annule' && <div className="actions" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn-petit btn-primaire" onClick={() => setEncaisse({ type: 'echeance', id: e.id })}>Encaisser</button></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Frais de procédure <span className="muted petit" style={{ fontWeight: 400 }}>payés à 100 % d'avance par le client</span></h3>
      <div className="table-scroll" style={{ marginBottom: 20 }}>
        <table className="table-cartes">
          <thead><tr><th>Frais</th><th>Organisme</th><th className="num">Montant</th><th>Client</th><th>Versé à l'organisme</th><th></th></tr></thead>
          <tbody>
            {d.frais.map((f) => {
              const reste = resteFrais(d, f);
              return (
                <tr key={f.id}>
                  <td className="titre-ligne">{f.nom}</td>
                  <td data-label="Organisme" className="petit muted">{f.organisme}</td>
                  <td data-label="Montant" className="num">{montant(f.montant, f.devise)}</td>
                  <td data-label="Client">{reste === 0 ? <span className="badge b-vert">Encaissé</span> : <span className="badge b-orange">Reste {montant(reste, f.devise)}</span>}</td>
                  <td data-label="Versé à l'organisme">
                    <label className="case" style={{ minHeight: 0 }}>
                      <input type="checkbox" checked={f.verse} disabled={reste > 0 && !f.verse}
                        onChange={(e) => tenter(() => marquerVerse(d.id, f.id, e.target.checked), e.target.checked ? 'Versement enregistré' : 'Versement annulé')} />
                      {f.verse ? <span className="petit">Oui, le {date(f.verseLe)}</span> : <span className="petit muted">{reste > 0 ? 'Encaisser d’abord' : 'Non'}</span>}
                    </label>
                  </td>
                  <td className="num cellule-actions">{reste > 0 && d.statut !== 'annule' && <div className="actions" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn-petit btn-primaire" onClick={() => setEncaisse({ type: 'frais', id: f.id })}>Encaisser</button></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Historique des encaissements</h3>
      {d.paiements.length === 0 ? <Vide icone="recu">Aucun encaissement pour ce dossier. Utilisez « Encaisser » sur une échéance ou des frais ci-dessus.</Vide> : (
        <div className="table-scroll">
          <table className="table-cartes">
            <thead><tr><th>Reçu</th><th>Date</th><th>Objet</th><th>Mode</th><th className="num">Montant</th><th>Par</th><th></th></tr></thead>
            <tbody>
              {[...d.paiements].reverse().map((p) => (
                <tr key={p.id} className={p.annule ? 'annule' : undefined}>
                  <td className="titre-ligne">{p.numeroRecu}</td>
                  <td data-label="Date" className="petit">{dateHeure(p.date)}</td>
                  <td data-label="Objet" className="petit">{libelleCible(p)}{p.annule && <div style={{ color: 'var(--rouge)' }}>Annulé : {p.annule.motif} ({nom(p.annule.par)})</div>}</td>
                  <td data-label="Mode" className="petit">{MODES[p.mode]}</td>
                  <td data-label="Montant" className="num" style={p.annule ? { textDecoration: 'line-through' } : undefined}>{montant(p.montant, p.devise)}</td>
                  <td data-label="Par" className="petit">{nom(p.par)}</td>
                  <td className="cellule-actions">{!p.annule && <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    <Link className="btn btn-petit" to={`/dossiers/${d.id}/recu/${p.id}`} aria-label={`Reçu ${p.numeroRecu}`}><Icone nom="recu" taille={15} /> Reçu</Link>
                    {admin && <button type="button" className="btn-petit btn-danger" onClick={() => setAnnul(p)}>Annuler</button>}
                  </div>}</td>
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
      <div className="alerte" style={{ background: 'var(--c-succes-doux)', color: 'var(--c-succes)' }}><Icone nom="coche" /><div>Reçu <b>{recu.numeroRecu}</b> : {montant(recu.montant, recu.devise)} enregistré.</div></div>
      <div className="pied"><button type="button" onClick={onFermer}>Fermer</button><Link className="btn btn-primaire" data-focus-initial to={`/dossiers/${d.id}/recu/${recu.id}`}><Icone nom="imprimer" taille={16} /> Imprimer le reçu</Link></div>
    </Modale>
  );
  return (
    <Modale titre={`Encaisser – ${(ech?.libelle ?? fr?.nom)}`} onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (err) return; tenter(() => setRecu(encaisser(d.id, cible, n, mode))); }}>
        <p className="muted petit">Reste à payer : <b>{montant(reste, devise)}</b>{fr && ' · les frais de procédure se règlent en totalité avant l’étape concernée.'}</p>
        <div className="champ"><label htmlFor="mt">Montant reçu ({devise})</label>
          <input id="mt" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} aria-invalid={val !== '' && !!err} aria-describedby="mt-err" autoComplete="off" />
          {val !== '' && err && <div className="erreur" id="mt-err">{err}</div>}
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
        <div className="alerte alerte-orange"><Icone nom="alerte" /><div>Le paiement de {montant(p.montant, p.devise)} restera visible dans l'historique, barré, avec votre nom et le motif.</div></div>
        <div className="champ"><label htmlFor="mo">Motif de l'annulation</label><textarea id="mo" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : erreur de saisie, remboursement…" /></div>
        <div className="pied"><button type="button" onClick={onFermer}>Garder le paiement</button><button type="submit" className="btn-danger-plein" disabled={!motif.trim()}>Annuler ce paiement</button></div>
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
        <div className="alerte alerte-orange" style={{ flexWrap: 'wrap', alignItems: 'center' }}><Icone nom="alerte" /><div style={{ flex: 1, minWidth: 200 }}>Toutes les étapes sont faites : la 2ᵉ tranche des honoraires (50 %) est maintenant exigible.</div><button type="button" className="btn-petit" onClick={onCloturer}>Clôturer le dossier</button></div>
      )}
      <ol className="etapes">
        {d.etapes.map((e, i) => {
          const bloq = fraisBloquants(d, e);
          const courante = p.courante?.id === e.id;
          return (
            <li key={e.id} className={`etape ${e.faite ? 'faite' : ''} ${courante ? 'courante' : ''}`} aria-current={courante ? 'step' : undefined}>
              <div className="rond" aria-hidden="true">{e.faite ? <Icone nom="coche" taille={15} /> : i + 1}</div>
              <div className="corps">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <b>{e.nom}</b> {courante && <span className="badge b-bleu">En cours</span>}{e.faite && <span className="sr-only"> (faite)</span>}
                    {e.faite && <div className="petit muted">Fait le {dateHeure(e.faiteLe!)} par {nom(e.faitePar)}</div>}
                    {e.fraisRequis.length > 0 && (
                      <div className="petit" style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {e.fraisRequis.map((fid) => {
                          const f = d.frais.find((x) => x.id === fid);
                          if (!f) return null;
                          const ok = resteFrais(d, f) === 0;
                          return <span key={fid} className={`badge ${ok ? 'b-vert' : 'b-rouge'}`} title={ok ? 'Frais encaissés' : 'Frais à encaisser avant cette étape'}><Icone nom={ok ? 'coche' : 'cadenas'} taille={12} /> {f.nom}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  {d.statut === 'en_cours' && (e.faite
                    ? <button type="button" className="btn-petit" onClick={() => tenter(() => rouvrirEtape(d.id, e.id), 'Étape rouverte')}>Rouvrir</button>
                    : <button type="button" className={`btn-petit ${courante ? 'btn-primaire' : ''}`} disabled={bloq.length > 0}
                        title={bloq.length ? `Frais à encaisser d'abord : ${bloq.map((f) => f.nom).join(', ')}` : undefined}
                        onClick={() => tenter(() => validerEtape(d.id, e.id), 'Étape enregistrée')}>
                        {bloq.length ? <><Icone nom="cadenas" taille={15} /> Frais non encaissés</> : 'Marquer comme faite'}
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

const ICONES: Record<TypeEvenement, NomIcone> = { creation: 'dossier', document: 'fichier', paiement: 'paiement', etape: 'coche', note: 'note', rdv: 'calendrier', statut: 'boucle', message: 'message' };

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
              <div className="icone"><Icone nom={ICONES[e.type] ?? 'note'} taille={16} /></div>
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
          <label className="case"><input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} /> Note interne (invisible pour le client)</label>
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

/** Menu « Prévenir le client » : s'ouvre au clic/Entrée, flèches haut/bas, Échap ou clic extérieur pour fermer. */
function MenuWhatsApp({ onChoisir, dossier }: { onChoisir: (t: TypeMessage) => void; dossier: Dossier }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const types = (Object.keys(LIBELLES_MESSAGES) as TypeMessage[]).filter((t) =>
    (t !== 'rdv' || dossier.rdv) && (t !== 'refuse' || dossier.documents.some((x) => x.statut === 'refuse')));
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => { if (!zone.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    zone.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);
  const clavier = (e: React.KeyboardEvent) => {
    const items = [...(zone.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); setOuvert(false); bouton.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') setOuvert(false);
  };
  return (
    <div className="menu-deroulant" ref={zone} onKeyDown={ouvert ? clavier : undefined}>
      <button ref={bouton} type="button" className="btn-wa" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-haspopup="menu">
        <Icone nom="message" taille={16} /> Prévenir le client <Icone nom="chevron" taille={14} />
      </button>
      {ouvert && (
        <div className="menu-liste" role="menu" aria-label="Choisir le message">
          {types.map((t) => (
            <button key={t} type="button" role="menuitem" tabIndex={-1} onClick={() => { setOuvert(false); onChoisir(t); }}>{LIBELLES_MESSAGES[t]}</button>
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
        <button type="button" onClick={onFermer}>Fermer</button>
        {cible.email && (
          <a className="btn" href={`mailto:${cible.email}?subject=${encodeURIComponent(`World Destination – dossier ${d.numero}`)}&body=${encodeURIComponent(texte)}`}
            onClick={() => tracer('e-mail')}><Icone nom="courriel" taille={16} /> Envoyer par e-mail</a>
        )}
        <a className="btn btn-wa" href={lienWhatsApp(cible.tel, texte)} target="_blank" rel="noopener noreferrer"
          onClick={() => { tracer('WhatsApp'); notifier('WhatsApp ouvert : appuyez sur Envoyer dans WhatsApp'); }}><Icone nom="message" taille={16} /> Ouvrir dans WhatsApp</a>
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
    <Modale titre={statut === 'termine' ? 'Clôturer le dossier' : `Annuler le dossier ${d.numero} ?`} onFermer={onFermer}>
      <form onSubmit={(e) => { e.preventDefault(); if (statut === 'annule' && !motif.trim()) return; tenter(() => { changerStatut(d.id, statut, motif.trim() || undefined); onFermer(); }, statut === 'termine' ? 'Dossier clôturé' : 'Dossier annulé'); }}>
        {statut === 'termine' && p.faites < p.total && <div className="alerte alerte-orange"><Icone nom="alerte" /><div>{p.total - p.faites} étape(s) ne sont pas marquées comme faites.</div></div>}
        {reste !== '0' && <div className="alerte alerte-orange"><Icone nom="paiement" /><div>Reste à payer : <b>{reste}</b>{statut === 'termine' && ' (la 2ᵉ tranche des honoraires devient exigible).'}</div></div>}
        <div className="champ"><label htmlFor="mc">{statut === 'annule' ? 'Motif de l’annulation' : 'Résultat (facultatif)'}</label>
          <textarea id="mc" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={statut === 'termine' ? 'Ex. : visa accordé le…' : 'Ex. : désistement du client, visa refusé…'} />
        </div>
        <div className="pied"><button type="button" onClick={onFermer}>{statut === 'annule' ? 'Garder le dossier' : 'Retour'}</button>
          <button type="submit" className={statut === 'annule' ? 'btn-danger-plein' : 'btn-primaire'} disabled={statut === 'annule' && !motif.trim()}>{statut === 'termine' ? 'Clôturer le dossier' : 'Annuler le dossier'}</button></div>
      </form>
    </Modale>
  );
}
