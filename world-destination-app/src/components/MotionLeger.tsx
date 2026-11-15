/**
 * Primitives de mouvement des écrans de travail, sans GSAP (Web Animations API).
 * Même rendu que les versions GSAP d'origine, mais elles ne pèsent rien dans le bundle
 * et respectent le mouvement réduit (fondu court ou rien).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import { cascade, DUREE, EASE_IN, EASE_OUT, animer, entree, mouvementReduit, retirerALaFin, sortieSiRetire } from './mouvement';

function selectionnerCibles(racine: HTMLElement, selecteur: string): Element[] {
  const s = selecteur.trim();
  if (s === '> *' || s === ':scope > *') return Array.from(racine.children);
  return Array.from(racine.querySelectorAll(s.startsWith('>') ? `:scope ${s}` : s));
}

/** Entrée de page ou de panneau : légère montée, jamais de visibility:hidden (focus et clics dès la 1re image). */
export function EntreePage({ children, className, cle, style }: { children: ReactNode; className?: string; cle?: string | number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const a = entree(ref.current, { y: 8, duree: DUREE.d200 });
    return () => a?.cancel();
  }, [cle]);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

/** Cascade pour grilles et groupes de cartes (≤ 30 ms par carte, ≤ 200 ms au total). */
export function StaggerGrille({ children, className, selecteur = '> *', style }: { children: ReactNode; className?: string; selecteur?: string; decalage?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) cascade(selectionnerCibles(ref.current, selecteur), { y: 10, echelle: 0.985 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

/** Cascade légère pour listes et parcours d'étapes (`as="ol"` conserve `<ol> > <li>`). */
export function StaggerListe({
  children, as: Tag = 'div', className, selecteur = '> *', style, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: {
  children: ReactNode; as?: 'div' | 'ul' | 'ol'; className?: string; selecteur?: string; style?: CSSProperties; 'aria-label'?: string; 'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (ref.current) cascade(selectionnerCibles(ref.current, selecteur), { y: 6, duree: DUREE.d200, pas: 25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const props = { ref: ref as never, className, style, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy };
  if (Tag === 'ol') return <ol {...props}>{children}</ol>;
  if (Tag === 'ul') return <ul {...props}>{children}</ul>;
  return <div {...props}>{children}</div>;
}

/* ---------------- Compteur ---------------- */

type JetonNombre = { debut: number; fin: number; cible: number; decimales: number; sepDec: string; sepMil: string };

function extraireJetons(texte: string): JetonNombre[] {
  const jetons: JetonNombre[] = [];
  const regex = /\d[\d\s  ]*(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte)) !== null) {
    const brut = m[0].replace(/[\s  ]+$/, '');
    const sepMil = /[\s  ]/.exec(brut)?.[0] ?? ' ';
    const idxDec = Math.max(brut.lastIndexOf(','), brut.lastIndexOf('.'));
    const decimales = idxDec >= 0 ? brut.length - idxDec - 1 : 0;
    const cible = Number(brut.replace(/[\s  ]/g, '').replace(',', '.'));
    if (Number.isFinite(cible)) jetons.push({ debut: m.index, fin: m.index + brut.length, cible, decimales, sepDec: idxDec >= 0 ? brut[idxDec] : ',', sepMil });
  }
  return jetons;
}

function formaterJeton(valeur: number, j: JetonNombre): string {
  const [entier, dec] = (j.decimales > 0 ? valeur.toFixed(j.decimales) : String(Math.round(valeur))).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, j.sepMil);
  return dec !== undefined ? `${groupe}${j.sepDec}${dec}` : groupe;
}

/**
 * Compteur KPI : la valeur réelle est dans le DOM dès la 1re image (lecteurs d'écran, tests).
 * - par défaut : arrivée verticale courte façon odomètre ;
 * - `compteDepuisZero` : interpolation de 0 à la cible (nombres ou montants multi-devises).
 * Les chiffres sont tabulaires : aucune largeur ne bouge pendant le comptage.
 */
export function CompteurAnime({ valeur, format, duree = 0.3, compteDepuisZero = false, className }: {
  valeur: number | string; format?: (n: number) => string; duree?: number; compteDepuisZero?: boolean; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const renduFinal = typeof valeur === 'number' ? (format ? format(valeur) : String(valeur)) : valeur;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = renduFinal;
    if (!compteDepuisZero) {
      const a = animer(el, [{ opacity: 0, transform: 'translate3d(0, 6px, 0)' }, { opacity: 1, transform: 'none' }], { duration: DUREE.d200, easing: EASE_OUT });
      return () => a?.cancel();
    }
    if (mouvementReduit()) return;
    const jetons = extraireJetons(renduFinal);
    if (!jetons.length) return;
    const t0 = performance.now();
    const ms = duree * 1000;
    let id = 0;
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - p) ** 3; // ease-out cubique
      let out = '';
      let curseur = 0;
      for (const j of jetons) { out += renduFinal.slice(curseur, j.debut) + formaterJeton(j.cible * e, j); curseur = j.fin; }
      el.textContent = out + renduFinal.slice(curseur);
      if (p < 1) id = requestAnimationFrame(pas); else el.textContent = renduFinal;
    };
    id = requestAnimationFrame(pas);
    return () => { cancelAnimationFrame(id); el.textContent = renduFinal; };
  }, [renduFinal, compteDepuisZero, duree]);

  return <span ref={ref} className={className} style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}>{renduFinal}</span>;
}

/* ---------------- Menus ---------------- */

/**
 * Menu déroulant / feuille d'actions : apparaît depuis son déclencheur (échelle + fondu, origine
 * en haut à droite) ou monte du bas sur téléphone ; à la fermeture, une copie inerte repart par
 * le même chemin (150 ms, ease-in) sans retarder le focus ni le clic suivant.
 */
export function PanneauDeroulant({ children, className, role, 'aria-label': ariaLabel, style }: {
  children: ReactNode; className?: string; role?: string; 'aria-label'?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const mobile = window.matchMedia?.('(max-width: 640px)').matches;
    const images: Keyframe[] = mobile
      ? [{ opacity: 0, transform: 'translate3d(0, 16px, 0)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: 0, transform: 'translate3d(0, -4px, 0) scale(.97)' }, { opacity: 1, transform: 'none' }];
    const a = animer(el, images, { duration: DUREE.d200, easing: EASE_OUT });
    return () => {
      a?.cancel();
      sortieSiRetire(el, (copie) => retirerALaFin(copie, animer(copie, [...images].reverse(), { duration: DUREE.d150, easing: EASE_IN, fill: 'forwards' })), parent);
    };
  }, []);
  return <div ref={ref} className={className} role={role} aria-label={ariaLabel} style={style}>{children}</div>;
}

/* ---------------- Intro (événement léger, l'intro elle-même est chargée à la demande) ---------------- */

export const EVENEMENT_REJOUER_INTRO = 'wd:rejouer-intro';

/** Rejoue l'animation d'ouverture (le composant IntroCinetique est chargé à la demande). */
export function declencherIntroCinetique(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_REJOUER_INTRO));
}

/* ---------------- Retour en haut ---------------- */

/** Bouton flottant de progression du défilement & retour en haut de page. */
export function AnneauDefilement(): JSX.Element {
  const [visible, setVisible] = useState(false);
  const cercleRef = useRef<SVGCircleElement>(null);
  const rayon = 18;
  const circonference = 2 * Math.PI * rayon;

  useEffect(() => {
    let rafId = 0;
    const mettreAJour = () => {
      rafId = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      if (cercleRef.current) cercleRef.current.style.strokeDashoffset = String(circonference * (1 - ratio));
      setVisible(y > 160);
    };
    const surScroll = () => { if (!rafId) rafId = window.requestAnimationFrame(mettreAJour); };
    mettreAJour();
    window.addEventListener('scroll', surScroll, { passive: true });
    window.addEventListener('resize', surScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', surScroll);
      window.removeEventListener('resize', surScroll);
    };
  }, [circonference]);

  return (
    <button
      type="button"
      className={`anneau-defilement no-print${visible ? ' est-visible' : ''}`}
      aria-label="Remonter en haut"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      style={{ pointerEvents: visible ? undefined : 'none' }}
      onClick={() => window.scrollTo({ top: 0, behavior: mouvementReduit() ? 'auto' : 'smooth' })}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={rayon} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
        <circle ref={cercleRef} cx="22" cy="22" r={rayon} fill="none" stroke="var(--c-accent-ciel, #2EC4DC)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circonference} strokeDashoffset={circonference} transform="rotate(-90 22 22)" />
      </svg>
      <span className="anneau-fleche" aria-hidden="true">↑</span>
    </button>
  );
}
