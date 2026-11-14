import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { EntreePage } from '../components/Motion';
import { Modale, Vide, tenter } from '../components/ui';
import { date, formatSoldes, nomClient, soldes } from '../lib/regles';
import { creerClient, ouvrirDossier, useBase, useUtilisateur } from '../lib/store';
import type { Langue } from '../lib/types';

export function normaliser(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function initiales(prenom: string, nom: string) {
  const i = `${prenom.trim()[0] ?? ''}${nom.trim()[0] ?? ''}`.toUpperCase();
  return i || 'CL';
}

type FiltreClient = 'tous' | 'impaye' | 'ar' | 'sans_dossier';

export default function Clients() {
  const base = useBase();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [filtre, setFiltre] = useState<FiltreClient>('tous');
  const nouveau = params.get('nouveau') === '1';

  const fiches = base.clients
    .map((c) => {
      const ds = base.dossiers.filter((d) => d.clientId === c.id);
      const reste: ReturnType<typeof soldes> = {};
      ds.filter((d) => d.statut !== 'annule').forEach((d) => {
        const s = soldes(d);
        for (const k of Object.keys(s) as (keyof typeof s)[]) {
          reste[k] = { du: 0, paye: 0, reste: (reste[k]?.reste ?? 0) + s[k]!.reste };
        }
      });
      const aReste = (Object.keys(reste) as (keyof typeof reste)[]).some((k) => (reste[k]?.reste ?? 0) > 0);
      return { c, ds, reste, aReste };
    })
    .sort((a, b) => b.c.creeLe.localeCompare(a.c.creeLe));

  const nbImpayes = fiches.filter((x) => x.aReste).length;
  const nbArabes = fiches.filter((x) => x.c.langue === 'ar').length;
  const nbSansDossier = fiches.filter((x) => x.ds.length === 0).length;

  const n = normaliser(q.trim());
  const chiffres = q.replace(/\D/g, '');
  const liste = fiches.filter(({ c, ds, aReste }) => {
    if (filtre === 'impaye' && !aReste) return false;
    if (filtre === 'ar' && c.langue !== 'ar') return false;
    if (filtre === 'sans_dossier' && ds.length > 0) return false;
    if (!n) return true;
    return normaliser(`${c.prenom} ${c.nom} ${c.email}`).includes(n)
      || (chiffres.length >= 3 && c.telephone.replace(/\D/g, '').includes(chiffres))
      || ds.some((d) => normaliser(d.numero).includes(n));
  });

  const filtreActif = !!q || filtre !== 'tous';

  return (
    <EntreePage>
      <div className="entete">
        <div>
          <h1>Clients</h1>
          <div className="muted">{base.clients.length} clients</div>
        </div>
        <div className="actions">
          <button type="button" className="btn-primaire" onClick={() => setParams({ nouveau: '1' })}>
            <Icone nom="plus" taille={16} /> Nouveau client
          </button>
        </div>
      </div>

      <div className="carte-filtres">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--esp-3)', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div className="champ recherche" style={{ flex: '1 1 260px', maxWidth: 440 }}>
            <label htmlFor="q">Rechercher</label>
            <div className="champ-recherche">
              <Icone nom="recherche" taille={16} />
              <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone ou n° de dossier" />
            </div>
          </div>
          <div className="actions" role="group" aria-label="Filtres rapides">
            <button type="button" className="pilule-filtre" aria-pressed={filtre === 'tous'} onClick={() => setFiltre('tous')}>
              Tous ({fiches.length})
            </button>
            <button type="button" className="pilule-filtre" aria-pressed={filtre === 'impaye'} onClick={() => setFiltre('impaye')}>
              Reste à payer ({nbImpayes})
            </button>
            <button type="button" className="pilule-filtre" aria-pressed={filtre === 'ar'} onClick={() => setFiltre('ar')}>
              Arabe ({nbArabes})
            </button>
            {nbSansDossier > 0 && (
              <button type="button" className="pilule-filtre" aria-pressed={filtre === 'sans_dossier'} onClick={() => setFiltre('sans_dossier')}>
                Sans dossier ({nbSansDossier})
              </button>
            )}
          </div>
        </div>
        {filtreActif && (
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <span className="petit muted">{liste.length} client(s) sur {fiches.length}</span>
            <button type="button" className="btn-petit" onClick={() => { setQ(''); setFiltre('tous'); }}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      <div className="carte">
        {liste.length === 0 ? (
          filtreActif ? (
            <Vide icone="recherche" action={<button type="button" className="btn-petit" onClick={() => { setQ(''); setFiltre('tous'); }}>Effacer la recherche</button>}>
              {q ? `Aucun client ne correspond à « ${q} ». Vérifiez l'orthographe ou cherchez par téléphone.` : 'Aucun client ne correspond à ce filtre.'}
            </Vide>
          ) : (
            <Vide icone="clients" action={<button type="button" className="btn-petit btn-primaire" onClick={() => setParams({ nouveau: '1' })}>Créer le premier client</button>}>
              Aucun client pour le moment.
            </Vide>
          )
        ) : (
          <div className="table-scroll">
            <table className="table-cartes">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Dossiers</th>
                  <th className="num">Reste à payer</th>
                  <th>Créé le</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(({ c, ds, reste, aReste }) => {
                  const texteReste = formatSoldes(reste, 'reste');
                  return (
                    <tr key={c.id} className="cliquable" onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) nav(`/clients/${c.id}`); }}>
                      <td className="titre-ligne">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className="avatar" aria-hidden="true">{initiales(c.prenom, c.nom)}</span>
                          <Link to={`/clients/${c.id}`}><b>{nomClient(c)}</b></Link>
                          {c.langue === 'ar' && <span className="badge b-gris" lang="ar" title="Langue : arabe">عربي</span>}
                        </span>
                      </td>
                      <td data-label="Téléphone" className="num" style={{ textAlign: 'start' }}>
                        <span dir="ltr">+{c.telephone}</span>
                      </td>
                      <td data-label="Dossiers" className="petit">
                        {ds.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <span>
                            {ds.map((d) => {
                              const m = base.modeles.find((x) => x.id === d.modeleId);
                              return (
                                <span key={d.id} className="badge b-gris" style={{ marginInlineEnd: 4, marginBlock: 2 }}>
                                  <span className="pastille" style={{ background: m?.couleur }} />
                                  {m?.nom ?? d.intitule}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </td>
                      <td data-label="Reste à payer" className="num">
                        {aReste ? <span className="badge b-orange">{texteReste}</span> : <span className="muted">{texteReste}</span>}
                      </td>
                      <td data-label="Créé le" className="petit muted">{date(c.creeLe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {nouveau && <NouveauClient onFermer={() => setParams({})} />}
    </EntreePage>
  );
}

const AUTO: Record<string, string | undefined> = { prenom: 'given-name', nom: 'family-name', telephone: 'tel', email: 'email', dateNaissance: 'bday', intitule: 'off' };

function NouveauClient({ onFermer }: { onFermer: () => void }) {
  const base = useBase();
  const user = useUtilisateur()!;
  const nav = useNavigate();
  const modeles = base.modeles.filter((m) => m.actif);
  const agents = base.utilisateurs.filter((u) => u.actif && u.role !== 'client');
  const [f, setF] = useState({
    prenom: '', nom: '', telephone: '', email: '', dateNaissance: '', adresse: '', langue: 'fr' as Langue,
    modeleId: modeles[0]?.id ?? '', intitule: '', agentId: user.id,
  });
  const [touche, setTouche] = useState<Record<string, boolean>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const erreurs: Record<string, string> = {};
  if (!f.prenom.trim()) erreurs.prenom = 'Saisissez le prénom.';
  if (!f.nom.trim()) erreurs.nom = 'Saisissez le nom.';
  if (f.telephone.replace(/\D/g, '').length < 9) erreurs.telephone = 'Saisissez un numéro complet, par ex. 0550 12 34 56.';
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) erreurs.email = "Vérifiez l'adresse e-mail (exemple : nom@gmail.com).";
  const doublon = base.clients.find((c) => c.telephone.replace(/\D/g, '').slice(-9) === f.telephone.replace(/\D/g, '').slice(-9) && f.telephone.replace(/\D/g, '').length >= 9);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    setTouche({ prenom: true, nom: true, telephone: true, email: true });
    if (Object.keys(erreurs).length) return;
    tenter(() => {
      const tel = f.telephone.replace(/\D/g, '').replace(/^0/, '213');
      const c = creerClient({
        prenom: f.prenom.trim(), nom: f.nom.trim(), telephone: tel, email: f.email.trim(),
        dateNaissance: f.dateNaissance || undefined, adresse: f.adresse || undefined, langue: f.langue,
      });
      if (f.modeleId) {
        const d = ouvrirDossier(c.id, f.modeleId, f.agentId, f.intitule);
        nav(`/dossiers/${d.id}`, { replace: true });
      } else {
        nav(`/clients/${c.id}`, { replace: true });
      }
    }, 'Client créé');
  };

  const champ = (k: keyof typeof f, lib: string, type = 'text', aide?: string) => (
    <div className="champ">
      <label htmlFor={k}>{lib}</label>
      <input
        id={k}
        type={type}
        value={f[k]}
        onChange={set(k)}
        onBlur={() => setTouche({ ...touche, [k]: true })}
        aria-invalid={!!(touche[k] && erreurs[k])}
        aria-describedby={(touche[k] && erreurs[k]) || aide ? `${k}-msg` : undefined}
        autoComplete={AUTO[k]}
      />
      {touche[k] && erreurs[k] ? <div className="erreur" id={`${k}-msg`}>{erreurs[k]}</div> : aide ? <div className="aide" id={`${k}-msg`}>{aide}</div> : null}
    </div>
  );

  return (
    <Modale titre="Nouveau client" sousTitre="Créez la fiche client et ouvrez son premier dossier." onFermer={onFermer} large>
      <form onSubmit={valider} noValidate>
        <div className="section-formulaire">
          <div className="section-formulaire-titre">Identité &amp; coordonnées</div>
          <div className="grille g2" style={{ gap: '0 16px' }}>
            {champ('prenom', 'Prénom')}
            {champ('nom', 'Nom')}
            {champ('telephone', 'Téléphone (WhatsApp)', 'tel')}
            {champ('email', 'E-mail (pour l’accès à l’espace client)', 'email', 'Facultatif, mais nécessaire pour l’espace client.')}
            {champ('dateNaissance', 'Date de naissance', 'date')}
            <div className="champ">
              <label htmlFor="langue">Langue du client</label>
              <select id="langue" value={f.langue} onChange={set('langue')}>
                <option value="fr">Français</option>
                <option value="ar">العربية (arabe)</option>
              </select>
            </div>
          </div>
        </div>

        {doublon && (
          <div className="alerte alerte-orange">
            <Icone nom="alerte" />
            <div>
              Un client avec ce numéro existe déjà : <Link to={`/clients/${doublon.id}`} onClick={onFermer}>{nomClient(doublon)}</Link>. Pour un nouveau dossier, ouvrez-le depuis sa fiche.
            </div>
          </div>
        )}

        <div className="section-formulaire" style={{ marginBottom: 0 }}>
          <h3 className="section-formulaire-titre">Premier dossier</h3>
          <div className="grille g2" style={{ gap: '0 16px' }}>
            <div className="champ">
              <label htmlFor="modeleId">Type de dossier</label>
              <select id="modeleId" value={f.modeleId} onChange={set('modeleId')}>
                {modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                <option value="">Pas de dossier pour l'instant</option>
              </select>
            </div>
            <div className="champ">
              <label htmlFor="agentId">Agent responsable</label>
              <select id="agentId" value={f.agentId} onChange={set('agentId')}>
                {agents.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </div>
          </div>
          {f.modeleId && champ('intitule', 'Précision (facultatif)', 'text', 'Ex. : « Master informatique 2027 », « Visa tourisme Espagne ».')}
        </div>

        <div className="pied">
          <button type="button" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn-primaire">
            {f.modeleId ? 'Créer le client et ouvrir le dossier' : 'Créer le client'}
          </button>
        </div>
      </form>
    </Modale>
  );
}
