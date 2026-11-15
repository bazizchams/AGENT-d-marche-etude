import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ErreurMetier } from '../lib/store';
import type { StatutDocument, StatutDossier } from '../lib/types';
import { Icone, type NomIcone } from './Icone';
import { animer, dansEntreeEcran, retirerALaFin, sortieSiRetire, DUREE, EASE_IN, EASE_OUT, ecranEtroit, elastique, mouvementReduit, projeter, ressort } from './mouvement';

export { Icone } from './Icone';

/* ---------- Toast ---------- */
type Toast = { id: number; texte: string; erreur?: boolean };
let afficherToast: (t: Omit<Toast, 'id'>) => void = () => {};
let compteurToast = 0;

export function notifier(texte: string, erreur = false) {
  afficherToast({ texte, erreur });
}

/** Exécute une action et affiche l'erreur métier proprement si elle échoue. */
export async function tenter(fn: () => unknown, succes?: string) {
  try {
    await fn();
    if (succes) notifier(succes);
    return true;
  } catch (e) {
    notifier(e instanceof ErreurMetier ? e.message : "L'action n'a pas pu être enregistrée. Réessayez.", true);
    if (!(e instanceof ErreurMetier)) console.error(e);
    return false;
  }
}

export function ZoneToast() {
  const [t, setT] = useState<Toast | null>(null);
  const timer = useRef<number>(undefined);
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    afficherToast = (x) => {
      setT({ ...x, id: ++compteurToast });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setT(null), x.erreur ? 6000 : 3000);
    };
  }, []);

  // Entrée : monte de 12 px depuis le bas (d'où il sortira), sans rebond.
  // Sortie : copie inerte qui redescend, plus vite que l'entrée.
  useLayoutEffect(() => {
    const el = toastRef.current;
    if (!el) return;
    animer(el, [{ opacity: 0, transform: 'translate3d(0, 12px, 0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: DUREE.d200, easing: EASE_OUT });
    return () => sortieSiRetire(el, (copie) =>
      retirerALaFin(copie, animer(copie, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 8px, 0)' }], { duration: DUREE.d150, easing: EASE_IN, fill: 'forwards' })));
  }, [t?.id]);

  if (!t) return null;
  return (
    <div ref={toastRef} key={t.id} className={`toast ${t.erreur ? 'erreur-toast' : ''}`} role="status">
      <Icone nom={t.erreur ? 'alerte' : 'coche'} taille={16} />
      <span>{t.texte}</span>
    </div>
  );
}

/* ---------- Modale ---------- */
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let compteurModale = 0;

/**
 * Fenêtre modale accessible : nom = titre (aria-labelledby), focus piégé dans la fenêtre,
 * Échap ferme, le focus revient sur le bouton d'origine, le défilement de la page est bloqué.
 *
 * Mouvement (skill apple-design) :
 * - ordinateur : apparition courte (échelle .97 → 1 + fondu, 200 ms), sortie plus rapide (150 ms) ;
 * - téléphone : feuille qui monte du bas avec un ressort sans rebond. On peut la saisir à tout
 *   moment (même pendant son entrée) par la poignée ou le titre : elle suit le doigt 1:1, résiste
 *   au-delà du haut, et se ferme si le geste projeté dépasse la moitié de sa hauteur ; sinon elle
 *   revient en place en gardant la vitesse du doigt. Sortie par le même chemin (vers le bas) ;
 * - mouvement réduit : fondu court, aucune translation.
 */
export function Modale({
  titre,
  sousTitre,
  onFermer,
  children,
  large,
}: {
  titre: string;
  sousTitre?: string;
  onFermer: () => void;
  children: ReactNode;
  large?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fondRef = useRef<HTMLDivElement>(null);
  const voileRef = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  const [idTitre] = useState(() => `modale-titre-${++compteurModale}`);
  const [feuille] = useState(() => ecranEtroit() && !mouvementReduit());
  const etat = useRef({ y: 0, h: 0, stop: () => {}, fermeeParGeste: false });

  const rendre = (y: number) => {
    const e = etat.current;
    e.y = y;
    // Écriture directe sur les deux éléments concernés (pas de variable CSS sur le parent :
    // elle forcerait le recalcul des styles de tout le contenu de la feuille à chaque image).
    const boite = ref.current;
    const voile = voileRef.current;
    if (boite) boite.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
    if (voile && e.h) voile.style.opacity = String(Math.max(0, Math.min(1, 1 - y / e.h)));
  };

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const boite = ref.current;
    const premier = boite?.querySelector<HTMLElement>('[data-focus-initial], input:not([type="checkbox"]), select, textarea') ?? boite?.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? boite)?.focus({ preventScroll: true });
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer.current(); return; }
      if (e.key !== 'Tab' || !boite) return;
      const liste = [...boite.querySelectorAll<HTMLElement>(FOCUSABLES)].filter((x) => x.offsetParent !== null);
      if (!liste.length) return;
      const [a, z] = [liste[0], liste[liste.length - 1]];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === boite)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', clavier);
    return () => {
      document.removeEventListener('keydown', clavier);
      document.body.style.overflow = debordement;
      if (precedent?.isConnected) precedent.focus({ preventScroll: true });
    };
  }, []);

  // Entrée, puis sortie symétrique (copie inerte) quel que soit le chemin de fermeture.
  useLayoutEffect(() => {
    const boite = ref.current!;
    const fond = fondRef.current!;
    const e = etat.current;
    if (feuille) {
      e.h = boite.offsetHeight;
      rendre(e.h);
      e.stop = ressort(e.h, 0, rendre, { reponse: 0.35 });
    } else {
      animer(boite, [{ opacity: 0, transform: 'translate3d(0, 8px, 0) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: DUREE.d200, easing: EASE_OUT });
      animer(voileRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: DUREE.d200, easing: EASE_OUT });
    }
    return () => {
      e.stop();
      if (e.fermeeParGeste) return; // déjà hors de l'écran
      const yDepart = e.y;
      const h = e.h || boite.offsetHeight;
      sortieSiRetire(fond, (copie) => {
        const b = copie.querySelector<HTMLElement>('.modal');
        const v = copie.querySelector<HTMLElement>('.modal-voile');
        if (feuille && b) {
          ressort(yDepart, h, (y) => {
            b.style.transform = `translate3d(0, ${y}px, 0)`;
            if (v) v.style.opacity = String(Math.max(0, 1 - y / h));
          }, { reponse: 0.28, fin: () => copie.remove() });
        } else {
          animer(b, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: DUREE.d150, easing: EASE_IN, fill: 'forwards' });
          retirerALaFin(copie, animer(copie, [{ opacity: 1 }, { opacity: 0 }], { duration: DUREE.d150, easing: EASE_IN, fill: 'forwards' }));
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glisser vers le bas pour fermer (poignée + titre), avec capture du pointeur.
  const suivi = useRef<{ decalage: number; points: { y: number; t: number }[]; id: number; engage: boolean; y0: number } | null>(null);
  const appui = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!feuille || suivi.current || ev.button > 0 || (ev.target as HTMLElement).closest('button, a, input, select, textarea')) return; // un 2e doigt est ignoré
    const e = etat.current;
    e.stop(); // on saisit la feuille là où elle est, même en plein mouvement
    e.h = ref.current!.offsetHeight;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    suivi.current = { decalage: ev.clientY - e.y, points: [{ y: ev.clientY, t: ev.timeStamp }], id: ev.pointerId, engage: false, y0: ev.clientY };
  };
  const deplacement = (ev: React.PointerEvent<HTMLDivElement>) => {
    const s = suivi.current;
    if (!s || ev.pointerId !== s.id) return;
    if (!s.engage && Math.abs(ev.clientY - s.y0) < 4) return; // petite hystérésis : un simple toucher ne bouge rien
    s.engage = true;
    const brut = ev.clientY - s.decalage;
    rendre(brut < 0 ? elastique(brut, 120) : brut); // résistance nette vers le haut
    s.points.push({ y: ev.clientY, t: ev.timeStamp });
    if (s.points.length > 5) s.points.shift();
  };
  const relache = (ev: React.PointerEvent<HTMLDivElement>) => {
    const s = suivi.current;
    if (!s || ev.pointerId !== s.id) return;
    suivi.current = null;
    const e = etat.current;
    const [p0, p1] = [s.points[0], s.points[s.points.length - 1]];
    const dt = (p1.t - p0.t) / 1000;
    const vitesse = dt > 0.008 ? (p1.y - p0.y) / dt : 0; // px/s
    if (e.y + projeter(vitesse) > e.h * 0.5) {
      e.stop = ressort(e.y, e.h, rendre, { reponse: 0.28, vitesse: Math.max(vitesse, 0), fin: () => { e.fermeeParGeste = true; fermer.current(); } });
    } else {
      // Retour en place : léger amortissement < 1 car le geste portait de l'élan.
      e.stop = ressort(e.y, 0, rendre, { amortissement: 0.85, reponse: 0.3, vitesse });
    }
  };

  return (
    <div className={`modal-fond${feuille ? ' en-feuille' : ''}`} ref={fondRef} onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modal-voile" ref={voileRef} aria-hidden="true" onMouseDown={() => onFermer()} />
      <div className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitre} ref={ref} tabIndex={-1}>
        <div className="modal-tete" onPointerDown={appui} onPointerMove={deplacement} onPointerUp={relache} onPointerCancel={relache}>
          <span className="modal-poignee" aria-hidden="true" />
          <h2 id={idTitre}>{titre}</h2>
        </div>
        {sousTitre && <p className="muted petit" style={{ marginTop: -8, marginBottom: 'var(--esp-3)' }}>{sousTitre}</p>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Onglets (ARIA tabs, flèches gauche/droite) ---------- */
export function Onglets<K extends string>({ valeur, onChanger, onglets, label, children }: {
  valeur: K; onChanger: (k: K) => void; onglets: [K, ReactNode][]; label: string; children: ReactNode;
}) {
  const liste = useRef<HTMLDivElement>(null);
  const panneauRef = useRef<HTMLDivElement>(null);

  const clavier = (e: React.KeyboardEvent, i: number) => {
    const n = onglets.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    onChanger(onglets[j][0]);
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus();
  };

  // Changement d'onglet : action fréquente (plusieurs fois par dossier) → aucune animation du
  // contenu ; seul l'indicateur d'onglet actif change (skills choreograph / emil-design-eng).

  return (
    <>
      <div className="onglets" role="tablist" aria-label={label} ref={liste}>
        {onglets.map(([k, lib], i) => (
          <button key={k} type="button" role="tab" id={`onglet-${k}`} aria-controls={`panneau-${k}`} aria-selected={valeur === k}
            tabIndex={valeur === k ? 0 : -1} className={valeur === k ? 'actif' : ''} onClick={() => onChanger(k)} onKeyDown={(e) => clavier(e, i)}>{lib}</button>
        ))}
      </div>
      <div ref={panneauRef} role="tabpanel" id={`panneau-${valeur}`} aria-labelledby={`onglet-${valeur}`}>{children}</div>
    </>
  );
}

/* ---------- Badges ---------- */
export const STATUTS_DOC: Record<StatutDocument, { lib: string; cls: string; icone: NomIcone }> = {
  manquant: { lib: 'Manquant', cls: 'b-gris', icone: 'vide' },
  envoye: { lib: 'À vérifier', cls: 'b-bleu', icone: 'envoi' },
  valide: { lib: 'Validé', cls: 'b-vert', icone: 'coche' },
  refuse: { lib: 'Refusé', cls: 'b-rouge', icone: 'croix' },
};

export function BadgeDoc({ statut }: { statut: StatutDocument }) {
  const s = STATUTS_DOC[statut];
  return <span className={`badge ${s.cls}`}><Icone nom={s.icone} taille={13} /> {s.lib}</span>;
}

export function BadgeDossier({ statut }: { statut: StatutDossier }) {
  const m = { en_cours: ['En cours', 'b-bleu'], termine: ['Terminé', 'b-vert'], annule: ['Annulé', 'b-gris'] }[statut];
  return <span className={`badge ${m[1]}`}>{m[0]}</span>;
}

export function Barre({ pourcent, label, animee = true }: { pourcent: number; label?: string; animee?: boolean }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(100, pourcent));

  // Remplissage à la première apparition seulement (transform, aucun recalcul de mise en page).
  useLayoutEffect(() => {
    if (!animee || clamped <= 0 || !dansEntreeEcran()) return; // seulement à l'arrivée d'un écran
    const a = animer(fillRef.current, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUREE.d300, easing: EASE_OUT });
    return () => a?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="barre" role="progressbar" aria-label={label ?? 'Avancement'} aria-valuenow={pourcent} aria-valuemin={0} aria-valuemax={100}>
      <div ref={fillRef} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** État vide : une phrase utile et, si possible, l'action suivante. */
export function Vide({ children, icone, action }: { children: ReactNode; icone?: NomIcone; action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // État vide : décoration → fondu seul, et seulement à l'arrivée d'un écran.
  useLayoutEffect(() => {
    if (!dansEntreeEcran()) return;
    const a = animer(ref.current, [{ opacity: 0 }, { opacity: 1 }], { duration: DUREE.d200, delay: 60, easing: EASE_OUT, fill: 'backwards' });
    return () => a?.cancel();
  }, []);

  return (
    <div ref={ref} className="vide">
      {icone && <span className="vide-icone"><Icone nom={icone} taille={20} /></span>}
      <div>{children}</div>
      {action && <div className="vide-action">{action}</div>}
    </div>
  );
}
