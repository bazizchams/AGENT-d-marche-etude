import { useState } from 'react';
import { Modale, tenter } from '../components/ui';
import { montant, uid } from '../lib/regles';
import { enregistrerModele, enregistrerUtilisateur, majParametres, reinitialiserDemo, useBase, useUtilisateur } from '../lib/store';
import type { Devise, ModeleDossier, Utilisateur } from '../lib/types';

type Onglet = 'modeles' | 'agence' | 'utilisateurs';

export default function Parametres() {
  const [onglet, setOnglet] = useState<Onglet>('modeles');
  return (
    <>
      <div className="entete"><div><h1>Paramètres</h1><div className="muted">Réservé aux administrateurs</div></div></div>
      <div className="carte">
        <div className="onglets" role="tablist">
          {([['modeles', 'Types de dossiers'], ['agence', 'Agence'], ['utilisateurs', 'Utilisateurs']] as [Onglet, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={onglet === k} className={onglet === k ? 'actif' : ''} onClick={() => setOnglet(k)}>{l}</button>
          ))}
        </div>
        {onglet === 'modeles' && <Modeles />}
        {onglet === 'agence' && <Agence />}
        {onglet === 'utilisateurs' && <Utilisateurs />}
      </div>
    </>
  );
}

/* ---------------- Types de dossiers ---------------- */

function Modeles() {
  const base = useBase();
  const [edite, setEdite] = useState<ModeleDossier | null>(null);
  const nouveau = (): ModeleDossier => ({ id: uid(), nom: '', couleur: '#1f7f99', honoraires: 0, deviseHonoraires: 'DZD', documents: [], etapes: [], frais: [], actif: true });
  return (
    <>
      <div className="alerte alerte-orange petit">Les montants pré-remplis sont des <b>exemples</b> : vérifiez les honoraires et les frais de chaque type. Une modification s'applique aux <b>nouveaux</b> dossiers, pas aux dossiers déjà ouverts.</div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Type</th><th className="num">Honoraires</th><th>Documents</th><th>Étapes</th><th>Frais</th><th>État</th><th></th></tr></thead>
          <tbody>
            {base.modeles.map((m) => (
              <tr key={m.id}>
                <td><span className="pastille" style={{ background: m.couleur }} /> <b>{m.nom}</b></td>
                <td className="num">{montant(m.honoraires, m.deviseHonoraires)}</td>
                <td>{m.documents.length}</td><td>{m.etapes.length}</td><td>{m.frais.length}</td>
                <td>{m.actif ? <span className="badge b-vert">Actif</span> : <span className="badge b-gris">Masqué</span>}</td>
                <td className="num"><button className="btn-petit" onClick={() => setEdite(structuredClone(m))}>Modifier</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={{ marginTop: 12 }} onClick={() => setEdite(nouveau())}>＋ Nouveau type de dossier</button>
      {edite && <EditeurModele initial={edite} onFermer={() => setEdite(null)} />}
    </>
  );
}

function EditeurModele({ initial, onFermer }: { initial: ModeleDossier; onFermer: () => void }) {
  const [m, setM] = useState(initial);
  const maj = (p: Partial<ModeleDossier>) => setM({ ...m, ...p });
  const deplacer = <T,>(liste: T[], i: number, dir: -1 | 1) => {
    const l = [...liste]; const j = i + dir;
    if (j < 0 || j >= l.length) return l;
    [l[i], l[j]] = [l[j], l[i]]; return l;
  };
  const valide = m.nom.trim() && m.etapes.every((e) => e.nom.trim()) && m.documents.every((d) => d.nom.trim()) && m.frais.every((f) => f.nom.trim());

  return (
    <Modale titre={initial.nom ? `Modifier : ${initial.nom}` : 'Nouveau type de dossier'} onFermer={onFermer} large>
      <form onSubmit={(e) => { e.preventDefault(); if (!valide) return; tenter(() => { enregistrerModele({ ...m, nom: m.nom.trim() }); onFermer(); }, 'Type de dossier enregistré'); }}>
        <div className="grille g2" style={{ gap: '0 16px' }}>
          <div className="champ"><label htmlFor="nm">Nom</label><input id="nm" value={m.nom} onChange={(e) => maj({ nom: e.target.value })} /></div>
          <div className="champ"><label htmlFor="cl">Couleur</label><input id="cl" type="color" value={m.couleur} onChange={(e) => maj({ couleur: e.target.value })} /></div>
          <div className="champ"><label htmlFor="ho">Honoraires totaux (payés 50 % / 50 %)</label><input id="ho" type="number" min={0} value={m.honoraires} onChange={(e) => maj({ honoraires: Number(e.target.value) })} /></div>
          <div className="champ"><label htmlFor="dv">Devise des honoraires</label><SelectDevise id="dv" value={m.deviseHonoraires} onChange={(v) => maj({ deviseHonoraires: v })} /></div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginBottom: 12 }}><input type="checkbox" checked={m.actif} onChange={(e) => maj({ actif: e.target.checked })} /> Proposé à la création des dossiers</label>

        <h3>Documents à fournir</h3>
        {m.documents.map((d, i) => (
          <div key={d.id} className="actions" style={{ marginBottom: 6, flexWrap: 'nowrap' }}>
            <input aria-label={`Document ${i + 1}`} value={d.nom} onChange={(e) => maj({ documents: m.documents.map((x) => x.id === d.id ? { ...x, nom: e.target.value } : x) })} />
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 400, margin: 0, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={d.avecExpiration} onChange={(e) => maj({ documents: m.documents.map((x) => x.id === d.id ? { ...x, avecExpiration: e.target.checked } : x) })} /> Expire
            </label>
            <button type="button" className="btn-petit" aria-label="Monter" onClick={() => maj({ documents: deplacer(m.documents, i, -1) })}>↑</button>
            <button type="button" className="btn-petit" aria-label="Descendre" onClick={() => maj({ documents: deplacer(m.documents, i, 1) })}>↓</button>
            <button type="button" className="btn-petit btn-danger" aria-label={`Retirer ${d.nom}`} onClick={() => maj({ documents: m.documents.filter((x) => x.id !== d.id) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-petit" onClick={() => maj({ documents: [...m.documents, { id: uid(), nom: '', avecExpiration: false }] })}>＋ Ajouter un document</button>

        <h3 style={{ marginTop: 18 }}>Frais de procédure (payés à 100 % d'avance)</h3>
        {m.frais.map((f, i) => (
          <div key={f.id} className="grille g-frais" style={{ gap: 6, marginBottom: 6 }}>
            <input aria-label={`Frais ${i + 1}`} placeholder="Nom" value={f.nom} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, nom: e.target.value } : x) })} />
            <input aria-label="Organisme" placeholder="Organisme" value={f.organisme} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, organisme: e.target.value } : x) })} />
            <input aria-label="Montant" type="number" min={0} value={f.montant} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, montant: Number(e.target.value) } : x) })} />
            <SelectDevise value={f.devise} onChange={(v) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, devise: v } : x) })} />
            <button type="button" className="btn-petit btn-danger" aria-label={`Retirer ${f.nom}`} onClick={() => maj({ frais: m.frais.filter((x) => x.id !== f.id), etapes: m.etapes.map((e) => ({ ...e, fraisRequis: e.fraisRequis.filter((id) => id !== f.id) })) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-petit" onClick={() => maj({ frais: [...m.frais, { id: uid(), nom: '', organisme: '', montant: 0, devise: 'DZD' }] })}>＋ Ajouter des frais</button>

        <h3 style={{ marginTop: 18 }}>Étapes de la procédure</h3>
        <p className="petit muted">Cochez les frais qui doivent être encaissés avant de pouvoir valider l'étape.</p>
        {m.etapes.map((e, i) => (
          <div key={e.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--bord)' }}>
            <div className="actions" style={{ flexWrap: 'nowrap' }}>
              <b style={{ width: 22 }}>{i + 1}.</b>
              <input aria-label={`Étape ${i + 1}`} value={e.nom} onChange={(ev) => maj({ etapes: m.etapes.map((x) => x.id === e.id ? { ...x, nom: ev.target.value } : x) })} />
              <button type="button" className="btn-petit" aria-label="Monter" onClick={() => maj({ etapes: deplacer(m.etapes, i, -1) })}>↑</button>
              <button type="button" className="btn-petit" aria-label="Descendre" onClick={() => maj({ etapes: deplacer(m.etapes, i, 1) })}>↓</button>
              <button type="button" className="btn-petit btn-danger" aria-label={`Retirer ${e.nom}`} onClick={() => maj({ etapes: m.etapes.filter((x) => x.id !== e.id) })}>✕</button>
            </div>
            {m.frais.length > 0 && (
              <div className="actions petit" style={{ marginTop: 4, marginLeft: 30 }}>
                {m.frais.map((f) => (
                  <label key={f.id} style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 400, margin: 0 }}>
                    <input type="checkbox" checked={e.fraisRequis.includes(f.id)} onChange={(ev) => maj({
                      etapes: m.etapes.map((x) => x.id === e.id ? { ...x, fraisRequis: ev.target.checked ? [...x.fraisRequis, f.id] : x.fraisRequis.filter((id) => id !== f.id) } : x),
                    })} /> 🔒 {f.nom || '(sans nom)'}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        <button type="button" className="btn-petit" onClick={() => maj({ etapes: [...m.etapes, { id: uid(), nom: '', fraisRequis: [] }] })}>＋ Ajouter une étape</button>

        {!valide && <div className="erreur" style={{ marginTop: 12 }}>Donnez un nom au type de dossier et à chaque ligne (ou retirez les lignes vides).</div>}
        <div className="pied"><button type="button" onClick={onFermer}>Annuler</button><button type="submit" className="btn-primaire" disabled={!valide}>Enregistrer le type de dossier</button></div>
      </form>
    </Modale>
  );
}

function SelectDevise({ id, value, onChange }: { id?: string; value: Devise; onChange: (v: Devise) => void }) {
  return (
    <select id={id} aria-label="Devise" value={value} onChange={(e) => onChange(e.target.value as Devise)}>
      <option value="DZD">DA</option><option value="EUR">€</option><option value="CAD">$ CA</option>
    </select>
  );
}

/* ---------------- Agence ---------------- */

function Agence() {
  const base = useBase();
  const [p, setP] = useState(base.parametres);
  const ch = (k: keyof typeof p, lib: string, type = 'text', aide?: string) => (
    <div className="champ"><label htmlFor={k}>{lib}</label>
      <input id={k} type={type} value={p[k]} onChange={(e) => setP({ ...p, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />
      {aide && <div className="petit muted">{aide}</div>}
    </div>
  );
  return (
    <form style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); tenter(() => majParametres(p), 'Paramètres enregistrés'); }}>
      {ch('nom', "Nom de l'agence")}
      {ch('adresse', 'Adresse (imprimée sur les reçus)')}
      {ch('telephone', 'Téléphone', 'tel')}
      {ch('whatsapp', 'Numéro WhatsApp de l’agence', 'tel', 'Utilisé pour l’envoi automatique WhatsApp prévu plus tard.')}
      {ch('email', 'E-mail', 'email')}
      {ch('joursAlerteExpiration', 'Alerter quand un document expire dans moins de (jours)', 'number')}
      <button type="submit" className="btn-primaire">Enregistrer les paramètres</button>
      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--bord)' }} />
      <h3>Démonstration</h3>
      <p className="petit muted">Remet les données fictives de départ. Toutes les saisies faites dans ce navigateur seront perdues.</p>
      <button type="button" className="btn-danger" onClick={() => { if (confirm('Effacer toutes les saisies et remettre les données de démonstration ?')) tenter(reinitialiserDemo, 'Données de démonstration rétablies'); }}>Réinitialiser les données de démonstration</button>
    </form>
  );
}

/* ---------------- Utilisateurs ---------------- */

function Utilisateurs() {
  const base = useBase();
  const moi = useUtilisateur()!;
  const [edite, setEdite] = useState<Utilisateur | null>(null);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>État</th><th></th></tr></thead>
          <tbody>
            {base.utilisateurs.map((u) => (
              <tr key={u.id}>
                <td><b>{u.nom}</b></td><td>{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'b-orange' : 'b-bleu'}`}>{u.role === 'admin' ? 'Administrateur' : 'Agent'}</span></td>
                <td>{u.actif ? <span className="badge b-vert">Actif</span> : <span className="badge b-gris">Désactivé</span>}</td>
                <td className="num"><button className="btn-petit" onClick={() => setEdite({ ...u })}>Modifier</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={{ marginTop: 12 }} onClick={() => setEdite({ id: uid(), nom: '', email: '', role: 'agent', actif: true })}>＋ Ajouter un utilisateur</button>
      {edite && (
        <Modale titre={edite.nom ? `Modifier : ${edite.nom}` : 'Nouvel utilisateur'} onFermer={() => setEdite(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (!edite.nom.trim() || !edite.email.includes('@')) return; tenter(() => { enregistrerUtilisateur(edite); setEdite(null); }, 'Utilisateur enregistré'); }}>
            <div className="champ"><label htmlFor="un">Nom</label><input id="un" value={edite.nom} onChange={(e) => setEdite({ ...edite, nom: e.target.value })} /></div>
            <div className="champ"><label htmlFor="ue">E-mail de connexion</label><input id="ue" type="email" value={edite.email} onChange={(e) => setEdite({ ...edite, email: e.target.value })} /></div>
            <div className="champ"><label htmlFor="ur">Rôle</label>
              <select id="ur" value={edite.role} disabled={edite.id === moi.id} onChange={(e) => setEdite({ ...edite, role: e.target.value as Utilisateur['role'] })}>
                <option value="agent">Agent : dossiers, documents, encaissements</option>
                <option value="admin">Administrateur : tout, y compris la caisse et les paramètres</option>
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
              <input type="checkbox" checked={edite.actif} disabled={edite.id === moi.id} onChange={(e) => setEdite({ ...edite, actif: e.target.checked })} /> Compte actif
            </label>
            <div className="pied"><button type="button" onClick={() => setEdite(null)}>Annuler</button><button type="submit" className="btn-primaire" disabled={!edite.nom.trim() || !edite.email.includes('@')}>Enregistrer l'utilisateur</button></div>
          </form>
        </Modale>
      )}
    </>
  );
}
