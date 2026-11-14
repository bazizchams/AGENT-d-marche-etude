import { useState } from 'react';
import { Icone } from '../components/Icone';
import { EntreePage } from '../components/Motion';
import { Modale, Onglets, tenter } from '../components/ui';
import { montant, uid } from '../lib/regles';
import { enregistrerModele, enregistrerUtilisateur, majParametres, reinitialiserDemo, useBase, useUtilisateur } from '../lib/store';
import type { Devise, ModeleDossier, Utilisateur } from '../lib/types';

type Onglet = 'modeles' | 'agence' | 'utilisateurs';

const initiales = (nom: string) =>
  nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase() || 'WD';

export default function Parametres() {
  const [onglet, setOnglet] = useState<Onglet>('modeles');
  return (
    <EntreePage>
      <div className="entete">
        <div>
          <h1>Paramètres</h1>
          <div className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icone nom="bouclier" taille={15} /> Réservé aux administrateurs
          </div>
        </div>
      </div>
      <div className="carte">
        <Onglets
          label="Sections des paramètres"
          valeur={onglet}
          onChanger={setOnglet}
          onglets={[['modeles', 'Types de dossiers'], ['agence', 'Agence'], ['utilisateurs', 'Utilisateurs']]}
        >
          {onglet === 'modeles' && <Modeles />}
          {onglet === 'agence' && <Agence />}
          {onglet === 'utilisateurs' && <Utilisateurs />}
        </Onglets>
      </div>
    </EntreePage>
  );
}

/* ---------------- Types de dossiers ---------------- */

function Modeles() {
  const base = useBase();
  const [edite, setEdite] = useState<ModeleDossier | null>(null);
  const nouveau = (): ModeleDossier => ({ id: uid(), nom: '', couleur: '#1f7f99', honoraires: 0, deviseHonoraires: 'DZD', documents: [], etapes: [], frais: [], actif: true });
  return (
    <>
      <div className="alerte alerte-orange">
        <Icone nom="alerte" />
        <div>Les montants pré-remplis sont des <b>exemples</b> : vérifiez les honoraires et les frais de chaque type. Une modification s'applique aux <b>nouveaux</b> dossiers, pas aux dossiers déjà ouverts.</div>
      </div>
      <div className="table-scroll">
        <table className="table-cartes">
          <thead><tr><th>Type</th><th className="num">Honoraires</th><th>Documents</th><th>Étapes</th><th>Frais</th><th>État</th><th></th></tr></thead>
          <tbody>
            {base.modeles.map((m) => (
              <tr key={m.id}>
                <td className="titre-ligne"><span className="avec-pastille"><span className="pastille" style={{ background: m.couleur }} /><b>{m.nom}</b></span></td>
                <td data-label="Honoraires" className="num">{montant(m.honoraires, m.deviseHonoraires)}</td>
                <td data-label="Documents">{m.documents.length}</td>
                <td data-label="Étapes">{m.etapes.length}</td>
                <td data-label="Frais">{m.frais.length}</td>
                <td data-label="État">{m.actif ? <span className="badge b-vert">Actif</span> : <span className="badge b-gris">Masqué</span>}</td>
                <td className="num cellule-actions">
                  <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-petit" aria-label={`Modifier ${m.nom}`} onClick={() => setEdite(structuredClone(m))}>
                      <Icone nom="crayon" taille={15} /> Modifier
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-primaire" style={{ marginTop: 14 }} onClick={() => setEdite(nouveau())}>
        <Icone nom="plus" taille={16} /> Nouveau type de dossier
      </button>
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
        <div className="section-formulaire" style={{ marginBottom: 0 }}>
          <div className="section-formulaire-titre">Informations générales</div>
          <div className="grille g2" style={{ gap: '0 16px' }}>
            <div className="champ"><label htmlFor="nm">Nom</label><input id="nm" value={m.nom} onChange={(e) => maj({ nom: e.target.value })} /></div>
            <div className="champ"><label htmlFor="cl">Couleur</label><input id="cl" type="color" value={m.couleur} onChange={(e) => maj({ couleur: e.target.value })} /></div>
            <div className="champ"><label htmlFor="ho">Honoraires totaux (payés 50 % / 50 %)</label><input id="ho" type="number" min={0} value={m.honoraires} onChange={(e) => maj({ honoraires: Number(e.target.value) })} /></div>
            <div className="champ"><label htmlFor="dv">Devise des honoraires</label><SelectDevise id="dv" value={m.deviseHonoraires} onChange={(v) => maj({ deviseHonoraires: v })} /></div>
          </div>
          <label className="case"><input type="checkbox" checked={m.actif} onChange={(e) => maj({ actif: e.target.checked })} /> Proposé à la création des dossiers</label>
        </div>

        <div className="bloc-editeur">
          <h3>Documents à fournir</h3>
          <p className="petit muted">Le nom arabe s'affiche dans l'espace client et les messages des clients arabophones (à défaut, le nom français est utilisé).</p>
          {m.documents.map((d, i) => (
            <div key={d.id} className="ligne-modele">
              <input aria-label={`Document ${i + 1} (français)`} placeholder="Nom en français" value={d.nom} onChange={(e) => maj({ documents: m.documents.map((x) => x.id === d.id ? { ...x, nom: e.target.value } : x) })} />
              <input aria-label={`Document ${i + 1} (arabe)`} placeholder="الاسم بالعربية" dir="rtl" lang="ar" value={d.nomAr ?? ''} onChange={(e) => maj({ documents: m.documents.map((x) => x.id === d.id ? { ...x, nomAr: e.target.value || undefined } : x) })} />
              <label className="case" style={{ whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={d.avecExpiration} onChange={(e) => maj({ documents: m.documents.map((x) => x.id === d.id ? { ...x, avecExpiration: e.target.checked } : x) })} /> Expire
              </label>
              <button type="button" className="btn-petit btn-icone" aria-label={`Monter ${d.nom || `document ${i + 1}`}`} title="Monter" disabled={i === 0} onClick={() => maj({ documents: deplacer(m.documents, i, -1) })}>↑</button>
              <button type="button" className="btn-petit btn-icone" aria-label={`Descendre ${d.nom || `document ${i + 1}`}`} title="Descendre" disabled={i === m.documents.length - 1} onClick={() => maj({ documents: deplacer(m.documents, i, 1) })}>↓</button>
              <button type="button" className="btn-petit btn-danger btn-icone" aria-label={`Retirer ${d.nom || `document ${i + 1}`}`} title="Retirer" onClick={() => maj({ documents: m.documents.filter((x) => x.id !== d.id) })}><Icone nom="croix" taille={16} /></button>
            </div>
          ))}
          <button type="button" className="btn-petit" onClick={() => maj({ documents: [...m.documents, { id: uid(), nom: '', avecExpiration: false }] })}><Icone nom="plus" taille={15} /> Ajouter un document</button>
        </div>

        <div className="bloc-editeur">
          <h3>Frais de procédure (payés à 100 % d'avance)</h3>
          {m.frais.map((f, i) => (
            <div key={f.id} className="grille g-frais" style={{ gap: 6, marginBottom: 8 }}>
              <input aria-label={`Frais ${i + 1} (français)`} placeholder="Nom en français" value={f.nom} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, nom: e.target.value } : x) })} />
              <input aria-label={`Frais ${i + 1} (arabe)`} placeholder="الاسم بالعربية" dir="rtl" lang="ar" value={f.nomAr ?? ''} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, nomAr: e.target.value || undefined } : x) })} />
              <input aria-label="Organisme" placeholder="Organisme" value={f.organisme} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, organisme: e.target.value } : x) })} />
              <input aria-label="Montant" type="number" min={0} value={f.montant} onChange={(e) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, montant: Number(e.target.value) } : x) })} />
              <SelectDevise value={f.devise} onChange={(v) => maj({ frais: m.frais.map((x) => x.id === f.id ? { ...x, devise: v } : x) })} />
              <button type="button" className="btn-petit btn-danger btn-icone" aria-label={`Retirer ${f.nom || `frais ${i + 1}`}`} title="Retirer" onClick={() => maj({ frais: m.frais.filter((x) => x.id !== f.id), etapes: m.etapes.map((e) => ({ ...e, fraisRequis: e.fraisRequis.filter((id) => id !== f.id) })) })}><Icone nom="croix" taille={16} /></button>
            </div>
          ))}
          <button type="button" className="btn-petit" onClick={() => maj({ frais: [...m.frais, { id: uid(), nom: '', organisme: '', montant: 0, devise: 'DZD' }] })}><Icone nom="plus" taille={15} /> Ajouter des frais</button>
        </div>

        <div className="bloc-editeur">
          <h3>Étapes de la procédure</h3>
          <p className="petit muted">Cochez les frais qui doivent être encaissés avant de pouvoir valider l'étape.</p>
          {m.etapes.map((e, i) => (
            <div key={e.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--c-bord)' }}>
              <div className="ligne-modele ligne-etape">
                <b style={{ width: 22 }}>{i + 1}.</b>
                <input aria-label={`Étape ${i + 1} (français)`} placeholder="Nom en français" value={e.nom} onChange={(ev) => maj({ etapes: m.etapes.map((x) => x.id === e.id ? { ...x, nom: ev.target.value } : x) })} />
                <input aria-label={`Étape ${i + 1} (arabe)`} placeholder="الاسم بالعربية" dir="rtl" lang="ar" value={e.nomAr ?? ''} onChange={(ev) => maj({ etapes: m.etapes.map((x) => x.id === e.id ? { ...x, nomAr: ev.target.value || undefined } : x) })} />
                <button type="button" className="btn-petit btn-icone" aria-label={`Monter ${e.nom || `étape ${i + 1}`}`} title="Monter" disabled={i === 0} onClick={() => maj({ etapes: deplacer(m.etapes, i, -1) })}>↑</button>
                <button type="button" className="btn-petit btn-icone" aria-label={`Descendre ${e.nom || `étape ${i + 1}`}`} title="Descendre" disabled={i === m.etapes.length - 1} onClick={() => maj({ etapes: deplacer(m.etapes, i, 1) })}>↓</button>
                <button type="button" className="btn-petit btn-danger btn-icone" aria-label={`Retirer ${e.nom || `étape ${i + 1}`}`} title="Retirer" onClick={() => maj({ etapes: m.etapes.filter((x) => x.id !== e.id) })}><Icone nom="croix" taille={16} /></button>
              </div>
              {m.frais.length > 0 && (
                <div className="actions petit" style={{ marginTop: 4, marginInlineStart: 30 }}>
                  {m.frais.map((f) => (
                    <label key={f.id} className="case">
                      <input type="checkbox" checked={e.fraisRequis.includes(f.id)} onChange={(ev) => maj({
                        etapes: m.etapes.map((x) => x.id === e.id ? { ...x, fraisRequis: ev.target.checked ? [...x.fraisRequis, f.id] : x.fraisRequis.filter((id) => id !== f.id) } : x),
                      })} /> <Icone nom="cadenas" taille={14} /> {f.nom || '(sans nom)'}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="btn-petit" onClick={() => maj({ etapes: [...m.etapes, { id: uid(), nom: '', fraisRequis: [] }] })}><Icone nom="plus" taille={15} /> Ajouter une étape</button>
        </div>

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
  const [confirmer, setConfirmer] = useState(false);
  const ch = (k: keyof typeof p, lib: string, type = 'text', aide?: string) => (
    <div className="champ"><label htmlFor={k}>{lib}</label>
      <input id={k} type={type} value={p[k]} onChange={(e) => setP({ ...p, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />
      {aide && <div className="aide">{aide}</div>}
    </div>
  );
  return (
    <div className="grille g-2-1">
      <form className="section-formulaire" style={{ marginBottom: 0 }} onSubmit={(e) => { e.preventDefault(); tenter(() => majParametres(p), 'Paramètres enregistrés'); }}>
        <div className="section-formulaire-titre">Identité, reçus & alertes</div>
        {ch('nom', "Nom de l'agence")}
        {ch('adresse', 'Adresse (imprimée sur les reçus)')}
        <div className="grille g2" style={{ gap: '0 14px' }}>
          {ch('telephone', 'Téléphone', 'tel')}
          {ch('whatsapp', 'Numéro WhatsApp de l’agence', 'tel', 'Utilisé pour l’envoi automatique WhatsApp prévu plus tard.')}
        </div>
        <div className="grille g2" style={{ gap: '0 14px' }}>
          {ch('email', 'E-mail', 'email')}
          {ch('joursAlerteExpiration', 'Alerter quand un document expire dans moins de (jours)', 'number')}
        </div>
        <button type="submit" className="btn-primaire"><Icone nom="coche" taille={16} /> Enregistrer les paramètres</button>
      </form>

      <div className="zone-danger" style={{ marginTop: 0 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icone nom="alerte" taille={18} /> Démonstration
        </h3>
        <p className="petit muted">Remet les données fictives de départ. Toutes les saisies faites dans ce navigateur seront perdues.</p>
        <button type="button" className="btn-danger" onClick={() => setConfirmer(true)}>Réinitialiser les données de démonstration</button>
      </div>

      {confirmer && (
        <Modale titre="Réinitialiser les données de démonstration ?" onFermer={() => setConfirmer(false)}>
          <p>Toutes les saisies faites dans ce navigateur (clients, dossiers, paiements, documents) seront effacées et remplacées par les données fictives de départ.</p>
          <div className="pied"><button type="button" data-focus-initial onClick={() => setConfirmer(false)}>Garder mes saisies</button>
            <button type="button" className="btn-danger-plein" onClick={() => { setConfirmer(false); tenter(reinitialiserDemo, 'Données de démonstration rétablies'); }}>Effacer et réinitialiser</button></div>
        </Modale>
      )}
    </div>
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
        <table className="table-cartes">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>État</th><th></th></tr></thead>
          <tbody>
            {base.utilisateurs.map((u) => (
              <tr key={u.id}>
                <td className="titre-ligne">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span className="avatar" aria-hidden="true">{initiales(u.nom)}</span>
                    <b>{u.nom}</b>
                  </span>
                </td>
                <td data-label="E-mail">{u.email}</td>
                <td data-label="Rôle"><span className={`badge ${u.role === 'admin' ? 'b-orange' : 'b-bleu'}`}>{u.role === 'admin' ? 'Administrateur' : 'Agent'}</span></td>
                <td data-label="État">{u.actif ? <span className="badge b-vert">Actif</span> : <span className="badge b-gris">Désactivé</span>}</td>
                <td className="num cellule-actions">
                  <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-petit" aria-label={`Modifier ${u.nom}`} onClick={() => setEdite({ ...u })}><Icone nom="crayon" taille={15} /> Modifier</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-primaire" style={{ marginTop: 14 }} onClick={() => setEdite({ id: uid(), nom: '', email: '', role: 'agent', actif: true })}>
        <Icone nom="plus" taille={16} /> Ajouter un utilisateur
      </button>
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
            <label className="case">
              <input type="checkbox" checked={edite.actif} disabled={edite.id === moi.id} onChange={(e) => setEdite({ ...edite, actif: e.target.checked })} /> Compte actif
            </label>
            <div className="pied"><button type="button" onClick={() => setEdite(null)}>Annuler</button><button type="submit" className="btn-primaire" disabled={!edite.nom.trim() || !edite.email.includes('@')}>Enregistrer l'utilisateur</button></div>
          </form>
        </Modale>
      )}
    </>
  );
}
