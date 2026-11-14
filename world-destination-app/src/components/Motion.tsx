import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';
const MOBILE_QUERY = '(max-width: 640px)';

/**
 * Sélectionne les cibles dans un conteneur de façon sûre (supporte '> *', ':scope > *' et sélecteurs CSS).
 */
function selectionnerCibles(racine: HTMLElement, selecteur: string): Element[] {
  const s = selecteur.trim();
  if (s === '> *' || s === ':scope > *') return Array.from(racine.children);
  const normalise = s.startsWith('>') ? `:scope ${s}` : s;
  return Array.from(racine.querySelectorAll(normalise));
}

/**
 * Entrée de page ou de panneau : élévation verticale légère (sans décalage horizontal),
 * jamais de visibility:hidden afin de préserver focus et clics E2E dès la frame 0.
 */
export function EntreePage({
  children,
  className,
  cle,
  style,
}: {
  children: ReactNode;
  className?: string;
  cle?: string | number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        gsap.fromTo(
          el,
          { y: 8, opacity: 0.02 },
          { y: 0, opacity: 1, duration: 0.24, ease: 'power3.out', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [cle], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Apparition en cascade pour grilles Bento, KPI et groupes de cartes (budget total plafonné ≤ 280 ms).
 */
export function StaggerGrille({
  children,
  className,
  selecteur = '> *',
  decalage = 0.04,
  style,
}: {
  children: ReactNode;
  className?: string;
  selecteur?: string;
  decalage?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || typeof window === 'undefined') return;
      const cibles = selectionnerCibles(el, selecteur);
      if (!cibles.length) return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        const step = cibles.length > 1 ? Math.min(decalage, 0.28 / (cibles.length - 1)) : 0;
        gsap.fromTo(
          cibles,
          { y: 10, scale: 0.985, opacity: 0.02 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.26,
            stagger: step,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Cascade légère pour listes ou parcours d'étapes (`as="ol"` supporté pour conserver `<ol> > <li>`).
 */
export function StaggerListe({
  children,
  as: Tag = 'div',
  className,
  selecteur = '> *',
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: {
  children: ReactNode;
  as?: 'div' | 'ul' | 'ol';
  className?: string;
  selecteur?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || typeof window === 'undefined') return;
      const cibles = selectionnerCibles(el, selecteur).slice(0, 12);
      if (!cibles.length) return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        const step = cibles.length > 1 ? Math.min(0.025, 0.22 / (cibles.length - 1)) : 0;
        gsap.fromTo(
          cibles,
          { y: 6, opacity: 0.02 },
          {
            y: 0,
            opacity: 1,
            duration: 0.2,
            stagger: step,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  const props = {
    ref: ref as never,
    className,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  };

  if (Tag === 'ol') return <ol {...props}>{children}</ol>;
  if (Tag === 'ul') return <ul {...props}>{children}</ul>;
  return <div {...props}>{children}</div>;
}

type JetonNombre = {
  debut: number;
  fin: number;
  cible: number;
  decimales: number;
  sepDec: string;
  sepMil: string;
};

function extraireJetons(texte: string): JetonNombre[] {
  const jetons: JetonNombre[] = [];
  const regex = /\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte)) !== null) {
    const brut = m[0];
    const matchSepMil = /[\s\u00a0\u202f]/.exec(brut);
    const sepMil = matchSepMil ? matchSepMil[0] : '\u202f';
    const idxDec = Math.max(brut.lastIndexOf(','), brut.lastIndexOf('.'));
    const sepDec = idxDec >= 0 ? brut[idxDec] : ',';
    const decimales = idxDec >= 0 ? brut.length - idxDec - 1 : 0;
    const canon = brut.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    const cible = Number(canon);
    if (Number.isFinite(cible)) {
      jetons.push({ debut: m.index, fin: m.index + brut.length, cible, decimales, sepDec, sepMil });
    }
  }
  return jetons;
}

function formaterJeton(valeur: number, jeton: JetonNombre): string {
  const arrondi = jeton.decimales > 0 ? valeur.toFixed(jeton.decimales) : String(Math.round(valeur));
  const [entier, dec] = arrondi.split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, jeton.sepMil);
  return dec !== undefined ? `${groupe}${jeton.sepDec}${dec}` : groupe;
}

/**
 * Compteur KPI animé :
 * - `compteDepuisZero=false` (défaut) : conserve la valeur réelle dans le DOM dès la frame 0 (sûr pour E2E)
 *   et applique une arrivée verticale fluide façon odomètre.
 * - `compteDepuisZero=true` : interpole de 0 jusqu'à la cible (nombres ou chaînes multi-devises `Intl`).
 */
export function CompteurAnime({
  valeur,
  format,
  duree = 0.32,
  compteDepuisZero = false,
  className,
}: {
  valeur: number | string;
  format?: (n: number) => string;
  duree?: number;
  compteDepuisZero?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const renduFinal = typeof valeur === 'number' ? (format ? format(valeur) : String(valeur)) : valeur;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || typeof window === 'undefined') return;
      el.textContent = renduFinal;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;

        if (!compteDepuisZero) {
          gsap.fromTo(
            el,
            { y: 7, scale: 0.96, opacity: 0.05 },
            { y: 0, scale: 1, opacity: 1, duration: 0.24, ease: 'power3.out', clearProps: 'transform,opacity' },
          );
          return;
        }

        if (typeof valeur === 'number') {
          const obj = { v: 0 };
          gsap.to(obj, {
            v: valeur,
            duration: duree,
            ease: 'power2.out',
            onUpdate: () => {
              const courant = Number.isInteger(valeur) ? Math.round(obj.v) : Number(obj.v.toFixed(2));
              el.textContent = format ? format(courant) : String(courant);
            },
            onComplete: () => {
              el.textContent = renduFinal;
            },
          });
          return;
        }

        const jetons = extraireJetons(renduFinal);
        if (!jetons.length) return;
        const etat = { p: 0 };
        gsap.to(etat, {
          p: 1,
          duration: duree,
          ease: 'power2.out',
          onUpdate: () => {
            let out = '';
            let curseur = 0;
            for (const j of jetons) {
              out += renduFinal.slice(curseur, j.debut);
              out += formaterJeton(j.cible * etat.p, j);
              curseur = j.fin;
            }
            out += renduFinal.slice(curseur);
            el.textContent = out;
          },
          onComplete: () => {
            el.textContent = renduFinal;
          },
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [renduFinal, compteDepuisZero, duree], revertOnUpdate: true },
  );

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}
    >
      {renduFinal}
    </span>
  );
}

/**
 * Signature visuelle World Destination : arc orbital et avion ascendant animés par GSAP.
 * Toujours confiné dans `overflow: hidden` et `dir="ltr"` pour éviter tout débordement mobile/RTL.
 */
export function AvionTrajectoire({
  variant = 'hero',
  className,
  titre,
}: {
  variant?: 'hero' | 'compact';
  className?: string;
  titre?: string;
}) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const avionRef = useRef<SVGGElement>(null);
  const baliseRef = useRef<SVGCircleElement>(null);
  const gradId = useId();

  useGSAP(
    () => {
      const trace = traceRef.current;
      const avion = avionRef.current;
      const balise = baliseRef.current;
      if (!trace || !avion || typeof window === 'undefined') return;

      const longueur = trace.getTotalLength();
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) {
          gsap.set(trace, { strokeDasharray: 'none', strokeDashoffset: 0 });
          gsap.set(avion, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 });
          if (balise) gsap.set(balise, { scale: 1, opacity: 1 });
          return;
        }

        gsap.set(trace, { strokeDasharray: longueur, strokeDashoffset: longueur });
        const tl = gsap.timeline();
        tl.to(trace, { strokeDashoffset: 0, duration: 0.52, ease: 'power2.out' }, 0)
          .fromTo(
            avion,
            { x: -46, y: 24, rotation: 16, scale: 0.85, opacity: 0.1 },
            { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.54, ease: 'power3.out' },
            0.04,
          );

        if (balise) {
          gsap.set(balise, { svgOrigin: '18 82' });
          tl.fromTo(
            balise,
            { scale: 0.4, opacity: 0.15 },
            { scale: 1, opacity: 1, svgOrigin: '18 82', duration: 0.24, ease: 'back.out(1.6)' },
            0.34,
          );
        }

        if (variant === 'hero') {
          tl.to(avion, {
            y: -3,
            duration: 2.6,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        }
      });
      return () => mm.revert();
    },
    { scope: conteneurRef, dependencies: [variant], revertOnUpdate: true },
  );

  const compact = variant === 'compact';

  return (
    <div
      ref={conteneurRef}
      dir="ltr"
      className={`avion-trajectoire ${className ?? ''}`.trim()}
      aria-hidden={titre ? undefined : true}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      style={{
        overflow: 'hidden',
        lineHeight: 0,
        maxWidth: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 280 100"
        width={compact ? 140 : 280}
        height={compact ? 50 : 100}
        style={{ width: '100%', maxWidth: compact ? 140 : 280, height: 'auto', display: 'block' }}
        fill="none"
      >
        <defs>
          <linearGradient id={gradId} x1="16" y1="88" x2="256" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="55%" stopColor="var(--c-accent-ciel, #0098C0)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Piste de repère pointillée */}
        <path
          d="M 18 82 Q 124 14 238 26"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
        {/* Trajectoire lumineuse animée */}
        <path
          ref={traceRef}
          d="M 18 82 Q 124 14 238 26"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Balise de départ */}
        <circle ref={baliseRef} cx="18" cy="82" r="4" fill="var(--c-accent-ciel, #0098C0)" />
        {/* Silhouette avion ancrée au sommet de trajectoire */}
        <g transform="translate(238, 26)">
          <g ref={avionRef}>
            <path
              d="M 14 -6 L -12 -1 L -3 2.5 L -7 9 L -1.5 5.5 L 5.5 9 Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Conteneur animé pour menus déroulants / feuilles d'actions mobiles (zéro translation X).
 */
export function PanneauDeroulant({
  children,
  className,
  role,
  'aria-label': ariaLabel,
  style,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, mobile: MOBILE_QUERY }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        const yDepart = ctx.conditions?.mobile ? 12 : -6;
        gsap.fromTo(
          el,
          { y: yDepart, scale: 0.97, opacity: 0.02 },
          { y: 0, scale: 1, opacity: 1, duration: 0.18, ease: 'power3.out', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className} role={role} aria-label={ariaLabel} style={style}>
      {children}
    </div>
  );
}

/* ============================================================================
 * V2 — Primitives cinétiques & interactives
 * ============================================================================ */

const EVENEMENT_REJOUER_INTRO = 'wd:rejouer-intro';
const SELECTEUR_CURSEUR =
  '[data-cursor], a.kpi, .choix-carte, tr.cliquable, .carte-eventail, .btn-primaire';

const ITEMS_MARQUEE_DEFAUT = [
  'CAMPUS FRANCE',
  'AUSBILDUNG ALLEMAGNE',
  'VISA SCHENGEN',
  'ENTRÉE EXPRESS CANADA',
  'ÉTUDES EN ITALIE',
  'BOURSES INTERNATIONALES',
  'SUIVI TEMPS RÉEL',
  'ESPACE CLIENT FR / AR',
];

function peutJouerIntroAuto(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (navigator.webdriver) return false;
  return !window.matchMedia(REDUCE_QUERY).matches;
}

/**
 * Déclenche manuellement le rejeu de l'animation d'ouverture cinétique.
 */
export function declencherIntroCinetique(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_REJOUER_INTRO));
}

/**
 * Rideau d'introduction cinétique plein écran (joué à l'ouverture / rechargement hors tests/reduced-motion,
 * et rejouable intégralement à la demande via declencherIntroCinetique()).
 */
export function IntroCinetique(): JSX.Element | null {
  const [ouverte, setOuverte] = useState<boolean>(() => peutJouerIntroAuto());
  const [sessionReplay, setSessionReplay] = useState(0);
  const introRef = useRef<HTMLDivElement>(null);
  const compteurRef = useRef<HTMLSpanElement>(null);
  const barreRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const replayManuelRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const surRejeu = () => {
      replayManuelRef.current = true;
      setOuverte(true);
      setSessionReplay((n) => n + 1);
    };
    window.addEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
    return () => window.removeEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
  }, []);

  const fermerIntro = useCallback(() => {
    timelineRef.current?.kill();
    timelineRef.current = null;
    replayManuelRef.current = false;
    const el = introRef.current;
    if (!el || typeof window === 'undefined' || window.matchMedia(REDUCE_QUERY).matches) {
      setOuverte(false);
      return;
    }
    gsap.to(el, {
      opacity: 0,
      duration: 0.22,
      ease: 'power2.out',
      onComplete: () => setOuverte(false),
    });
  }, []);

  useEffect(() => {
    if (!ouverte || typeof window === 'undefined') return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerIntro();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouverte, fermerIntro]);

  useGSAP(
    () => {
      const el = introRef.current;
      if (!ouverte || !el || typeof window === 'undefined') return;

      const estManuel = replayManuelRef.current;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      const lancerSequenceComplete = () => {
        const lignes = q('.intro-ligne');
        const lettres = q('.intro-lettre');
        const pilule = q('.intro-entete-pilule');
        const grille = q('.intro-grille-fond');
        const lueur = q('.intro-lueur');
        const blocProg = q('.intro-barre-progression');
        const compteurEl = compteurRef.current;
        const barreEl = barreRef.current;
        const progressObj = { pct: 0 };

        const tl = gsap.timeline({
          onComplete: () => {
            replayManuelRef.current = false;
            setOuverte(false);
          },
        });
        timelineRef.current = tl;

        const vw = Math.max(window.innerWidth, 360);
        const vh = Math.max(window.innerHeight, 560);

        gsap.set(el, { clipPath: 'circle(150% at 50% 50%)', opacity: 1 });
        gsap.set(lignes, { overflow: 'hidden' });
        gsap.set(lettres, {
          transformPerspective: 900,
          transformOrigin: '50% 50%',
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 0,
        });
        if (barreEl) gsap.set(barreEl, { scaleX: 0, transformOrigin: 'left center' });
        if (compteurEl) compteurEl.textContent = '00%';

        // Vecteurs d'éclatement répartis sur les 4 quadrants (inspiré Trinergie)
        const ciblesDispersion = [
          { fx: -0.36, fy: -0.34, rot: -42 },
          { fx: -0.18, fy: -0.4, rot: 28 },
          { fx: 0.04, fy: -0.38, rot: -18 },
          { fx: 0.24, fy: -0.36, rot: 46 },
          { fx: 0.39, fy: -0.26, rot: -62 },
          { fx: -0.41, fy: -0.1, rot: 68 },
          { fx: -0.26, fy: 0.16, rot: -48 },
          { fx: -0.42, fy: 0.3, rot: 54 },
          { fx: -0.14, fy: 0.32, rot: -34 },
          { fx: 0.08, fy: 0.36, rot: 38 },
          { fx: 0.28, fy: 0.28, rot: -58 },
          { fx: 0.42, fy: 0.12, rot: 74 },
          { fx: -0.3, fy: -0.22, rot: 82 },
          { fx: 0.18, fy: -0.24, rot: -76 },
          { fx: 0.35, fy: 0.34, rot: 44 },
          { fx: -0.06, fy: -0.42, rot: -92 },
        ];

        // Acte 1 — Montée 3D & Compteur cinétique (0.04s -> 1.00s)
        tl.addLabel('entree', 0.04)
          .fromTo(
            grille,
            { scale: 0.9, opacity: 0.12 },
            { scale: 1, opacity: 1, duration: 0.85, ease: 'power3.out' },
            'entree',
          )
          .fromTo(
            lueur,
            { scale: 0.68, opacity: 0.22 },
            { scale: 1.15, opacity: 0.96, duration: 0.95, ease: 'sine.out' },
            'entree',
          )
          .fromTo(
            pilule,
            { y: -28, scale: 0.9, opacity: 0 },
            { y: 0, scale: 1, opacity: 1, duration: 0.54, ease: 'back.out(1.6)' },
            'entree+=0.02',
          )
          .fromTo(
            lettres,
            { yPercent: 128, rotateX: -78, rotateZ: 8, scale: 0.76, opacity: 0 },
            {
              yPercent: 0,
              rotateX: 0,
              rotateZ: 0,
              scale: 1,
              opacity: 1,
              duration: 0.7,
              stagger: { each: 0.03, from: 'center' },
              ease: 'back.out(1.65)',
            },
            'entree+=0.04',
          )
          .fromTo(
            blocProg,
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' },
            'entree+=0.06',
          )
          .to(
            progressObj,
            {
              pct: 100,
              duration: 0.94,
              ease: 'power2.inOut',
              onUpdate: () => {
                if (compteurEl) {
                  const v = Math.round(progressObj.pct);
                  compteurEl.textContent = `${v < 10 ? `0${v}` : v}%`;
                }
              },
            },
            'entree+=0.04',
          );

        if (barreEl) {
          tl.to(barreEl, { scaleX: 1, duration: 0.94, ease: 'power2.inOut' }, 'entree+=0.04');
        }

        // Acte 2 — Éclatement plein écran des lettres (opacity conservée pour impact visuel)
        tl.addLabel('explosion', '+=0.18')
          .set(lignes, { overflow: 'visible' }, 'explosion')
          .to(
            lueur,
            { scale: 2.05, opacity: 0.24, duration: 0.85, ease: 'power2.out' },
            'explosion',
          )
          .to(
            [pilule, blocProg],
            { y: -24, opacity: 0, duration: 0.34, ease: 'power2.in' },
            'explosion',
          )
          .to(
            lettres,
            {
              x: (i: number) => ciblesDispersion[i % ciblesDispersion.length].fx * vw,
              y: (i: number) => ciblesDispersion[i % ciblesDispersion.length].fy * vh,
              rotation: (i: number) => ciblesDispersion[i % ciblesDispersion.length].rot,
              scale: (i: number) => 1.15 + (i % 3) * 0.14,
              opacity: 1,
              duration: 0.68,
              stagger: { each: 0.015, from: 'center' },
              ease: 'power3.out',
            },
            'explosion',
          )
          // Acte 3 — Effacement des lettres dispersées & Ouverture du rideau circulaire
          .addLabel('dispersion', 'explosion+=0.88')
          .to(
            lettres,
            {
              scale: 0.52,
              opacity: 0,
              y: '+=75',
              duration: 0.36,
              stagger: { each: 0.01, from: 'edges' },
              ease: 'power2.in',
            },
            'dispersion',
          )
          .addLabel('sortie', 'dispersion+=0.1')
          .to(
            el,
            {
              clipPath: 'circle(0% at 50% 10%)',
              opacity: 0,
              duration: 0.58,
              ease: 'power3.inOut',
            },
            'sortie',
          );
      };

      mm.add({ reduce: REDUCE_QUERY, motion: MOTION_QUERY }, (ctx) => {
        if (ctx.conditions?.reduce && !estManuel) {
          const tlReduit = gsap.timeline({ onComplete: () => setOuverte(false) });
          timelineRef.current = tlReduit;
          tlReduit
            .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
            .to(el, { opacity: 0, duration: 0.24, ease: 'power2.in' }, '+=0.85');
          return;
        }
        lancerSequenceComplete();
      });

      return () => {
        timelineRef.current?.kill();
        timelineRef.current = null;
        mm.revert();
      };
    },
    { scope: introRef, dependencies: [ouverte, sessionReplay] },
  );

  if (!ouverte) return null;

  return (
    <div
      ref={introRef}
      className="intro-cinetique no-print"
      role="dialog"
      aria-modal="false"
      aria-label="Animation d'ouverture World Destination"
    >
      <div className="intro-grille-fond" aria-hidden="true" />
      <div className="intro-lueur" aria-hidden="true" />
      <div className="intro-entete-pilule">
        <img src="./logo.png" alt="" className="intro-logo" />
        <span>AGENCE INTERNATIONALE • VOYAGES, ÉTUDES &amp; IMMIGRATION</span>
      </div>
      <div className="intro-centre-scene" aria-hidden="true">
        <div className="intro-mots">
          <div className="intro-ligne">
            {'WORLD'.split('').map((lettre, idx) => (
              <span key={`w-${idx}`} className="intro-lettre">
                {lettre}
              </span>
            ))}
          </div>
          <div className="intro-ligne">
            {'DESTINATION'.split('').map((lettre, idx) => (
              <span key={`d-${idx}`} className="intro-lettre">
                {lettre}
              </span>
            ))}
          </div>
        </div>
        <div className="intro-barre-progression">
          <div className="intro-barre-meta">
            <span>INITIALISATION DES DOSSIERS</span>
            <span ref={compteurRef} className="intro-compteur">00%</span>
          </div>
          <div className="intro-jauge">
            <div ref={barreRef} className="intro-jauge-remplissage" />
          </div>
        </div>
      </div>
      <button type="button" className="intro-passer" onClick={fermerIntro}>
        Passer l&apos;intro ↗
      </button>
    </div>
  );
}

/**
 * Curseur magnétique fluide sur pointeur fin (desktop uniquement, respecte prefers-reduced-motion).
 */
export function CurseurMagnetique(): JSX.Element | null {
  const [actif, setActif] = useState(false);
  const pointRef = useRef<HTMLDivElement>(null);
  const anneauRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqFine = window.matchMedia('(pointer: fine)');
    const mqReduce = window.matchMedia(REDUCE_QUERY);
    const synchroniser = () => setActif(mqFine.matches && !mqReduce.matches);
    synchroniser();
    mqFine.addEventListener('change', synchroniser);
    mqReduce.addEventListener('change', synchroniser);
    return () => {
      mqFine.removeEventListener('change', synchroniser);
      mqReduce.removeEventListener('change', synchroniser);
    };
  }, []);

  useGSAP(
    () => {
      if (!actif || typeof window === 'undefined') return;
      const point = pointRef.current;
      const anneau = anneauRef.current;
      const label = labelRef.current;
      if (!point || !anneau) return;

      gsap.set([point, anneau], { xPercent: -50, yPercent: -50, opacity: 0 });
      const xPoint = gsap.quickTo(point, 'x', { duration: 0.1, ease: 'power3.out' });
      const yPoint = gsap.quickTo(point, 'y', { duration: 0.1, ease: 'power3.out' });
      const xAnneau = gsap.quickTo(anneau, 'x', { duration: 0.32, ease: 'power3.out' });
      const yAnneau = gsap.quickTo(anneau, 'y', { duration: 0.32, ease: 'power3.out' });

      let visible = false;
      let dernierX = 0;
      let dernierY = 0;
      let cibleCourante: Element | null = null;
      let hashCourant = window.location.hash;
      let rafSync = 0;
      let timerSync = 0;

      const observateur = new MutationObserver(() => {
        if (cibleCourante && !cibleCourante.isConnected) {
          hashCourant = window.location.hash;
          appliquerCible(null);
        }
      });

      const appliquerCible = (cible: Element | null) => {
        if (cible && !cible.isConnected) cible = null;
        if (cible === cibleCourante) return;
        cibleCourante = cible;
        if (cible) {
          anneau.classList.add('est-actif');
          if (label) label.textContent = cible.getAttribute('data-cursor') || 'Ouvrir ↗';
          observateur.observe(document.body, { childList: true, subtree: true });
        } else {
          anneau.classList.remove('est-actif');
          if (label) label.textContent = '';
          observateur.disconnect();
        }
      };

      const verifierCibleSousPointeur = () => {
        if (cibleCourante && !cibleCourante.isConnected) {
          appliquerCible(null);
        }
        if (!visible || window.location.hash !== hashCourant) return;
        const sous = document.elementFromPoint(dernierX, dernierY);
        const cible = sous ? sous.closest(SELECTEUR_CURSEUR) : null;
        appliquerCible(cible);
      };

      const planifierSync = () => {
        if (!rafSync) {
          rafSync = window.requestAnimationFrame(() => {
            rafSync = 0;
            verifierCibleSousPointeur();
          });
        }
      };

      const surMouvement = (e: PointerEvent) => {
        dernierX = e.clientX;
        dernierY = e.clientY;
        hashCourant = window.location.hash;
        if (!visible) {
          visible = true;
          gsap.to([point, anneau], { opacity: 1, duration: 0.18, overwrite: 'auto' });
        }
        xPoint(e.clientX);
        yPoint(e.clientY);
        xAnneau(e.clientX);
        yAnneau(e.clientY);

        const cible =
          e.target instanceof Element ? e.target.closest(SELECTEUR_CURSEUR) : null;
        appliquerCible(cible);
      };

      const surNavigationOuClic = () => {
        const hashAvant = hashCourant;
        window.clearTimeout(timerSync);
        if (cibleCourante && !cibleCourante.isConnected) {
          appliquerCible(null);
        }
        timerSync = window.setTimeout(() => {
          if (window.location.hash !== hashAvant) {
            hashCourant = window.location.hash;
            appliquerCible(null);
            return;
          }
          verifierCibleSousPointeur();
        }, 60);
      };

      const surChangementRoute = () => {
        hashCourant = window.location.hash;
        window.clearTimeout(timerSync);
        if (rafSync) {
          window.cancelAnimationFrame(rafSync);
          rafSync = 0;
        }
        appliquerCible(null);
      };

      const masquer = () => {
        visible = false;
        appliquerCible(null);
        gsap.to([point, anneau], { opacity: 0, duration: 0.16, overwrite: 'auto' });
      };

      window.addEventListener('pointermove', surMouvement, { passive: true });
      window.addEventListener('click', surNavigationOuClic, { capture: true, passive: true });
      window.addEventListener('scroll', planifierSync, { capture: true, passive: true });
      window.addEventListener('hashchange', surChangementRoute);
      window.addEventListener('popstate', surChangementRoute);
      document.addEventListener('mouseleave', masquer);
      window.addEventListener('blur', masquer);

      return () => {
        observateur.disconnect();
        if (rafSync) window.cancelAnimationFrame(rafSync);
        window.clearTimeout(timerSync);
        window.removeEventListener('pointermove', surMouvement);
        window.removeEventListener('click', surNavigationOuClic, { capture: true });
        window.removeEventListener('scroll', planifierSync, { capture: true });
        window.removeEventListener('hashchange', surChangementRoute);
        window.removeEventListener('popstate', surChangementRoute);
        document.removeEventListener('mouseleave', masquer);
        window.removeEventListener('blur', masquer);
        gsap.killTweensOf([point, anneau]);
      };
    },
    { dependencies: [actif] },
  );

  if (!actif) return null;

  return (
    <>
      <div className="curseur-point no-print" ref={pointRef} aria-hidden="true" style={{ opacity: 0 }} />
      <div className="curseur-anneau no-print" ref={anneauRef} aria-hidden="true" style={{ opacity: 0 }}>
        <span className="curseur-label" ref={labelRef} />
      </div>
    </>
  );
}

/**
 * Bandeau défilant continu GSAP (pause au survol, sans attribut HTML dir).
 */
export function BandeauMarquee({
  items,
  incline = false,
  vitesse = 24,
  className,
}: {
  items?: string[];
  incline?: boolean;
  vitesse?: number;
  className?: string;
}) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const pisteRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const liste = items && items.length > 0 ? items : ITEMS_MARQUEE_DEFAUT;
  const signature = liste.join('|');

  useGSAP(
    () => {
      const piste = pisteRef.current;
      if (!piste || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: MOTION_QUERY }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        tweenRef.current = gsap.to(piste, {
          xPercent: -50,
          duration: Math.max(8, vitesse),
          ease: 'none',
          repeat: -1,
        });
      });
      return () => {
        tweenRef.current?.kill();
        tweenRef.current = null;
        mm.revert();
      };
    },
    { scope: conteneurRef, dependencies: [vitesse, signature] },
  );

  return (
    <div
      ref={conteneurRef}
      className={['bandeau-marquee no-print', incline ? 'est-incline' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{ direction: 'ltr' }}
      aria-label="Destinations et programmes phares"
      onMouseEnter={() => tweenRef.current?.pause()}
      onMouseLeave={() => tweenRef.current?.resume()}
    >
      <div ref={pisteRef} className="bandeau-marquee-piste">
        {[0, 1].flatMap((copie) =>
          liste.map((item, idx) => (
            <span
              key={`${copie}-${idx}`}
              className="bandeau-marquee-item"
              aria-hidden={copie === 1 || undefined}
            >
              <span>{item}</span>
              <span className="bandeau-marquee-etoile" aria-hidden="true">
                ✦
              </span>
            </span>
          )),
        )}
      </div>
    </div>
  );
}

/**
 * Titre cinétique par mots masqués : animation purement géométrique (opacity: 1 permanent).
 */
export function TitreCinetique({
  texte,
  as = 'h1',
  className,
  accentMot,
}: {
  texte: string;
  as?: 'h1' | 'h2' | 'div' | 'span';
  className?: string;
  accentMot?: string;
}) {
  const scopeRef = useRef<HTMLElement | null>(null);
  const mots = texte.split(/\s+/).filter(Boolean);

  useGSAP(
    () => {
      const el = scopeRef.current;
      if (!el || typeof window === 'undefined') return;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: MOTION_QUERY }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        const cibles = q('.mot-interne');
        if (!cibles.length) return;
        gsap.fromTo(
          cibles,
          { yPercent: 95, rotateZ: 2.5 },
          {
            yPercent: 0,
            rotateZ: 0,
            duration: 0.6,
            stagger: 0.045,
            ease: 'power4.out',
            clearProps: 'transform',
          },
        );
      });
      return () => mm.revert();
    },
    { scope: scopeRef, dependencies: [texte] },
  );

  const classes = ['titre-cinetique', className].filter(Boolean).join(' ');
  const assignerRef = (node: HTMLElement | null) => {
    scopeRef.current = node;
  };

  const contenu = mots.map((mot, idx) => {
    const estAccent = Boolean(
      accentMot && mot.toLocaleLowerCase().includes(accentMot.toLocaleLowerCase()),
    );
    return (
      <Fragment key={`${mot}-${idx}`}>
        {idx > 0 ? ' ' : null}
        <span className="mot-masque">
          <span className={estAccent ? 'mot-interne mot-accent' : 'mot-interne'}>{mot}</span>
        </span>
      </Fragment>
    );
  });

  if (as === 'h2') {
    return (
      <h2 ref={assignerRef} className={classes}>
        {contenu}
      </h2>
    );
  }
  if (as === 'div') {
    return (
      <div ref={assignerRef} className={classes}>
        {contenu}
      </div>
    );
  }
  if (as === 'span') {
    return (
      <span ref={assignerRef} className={classes}>
        {contenu}
      </span>
    );
  }
  return (
    <h1 ref={assignerRef} className={classes}>
      {contenu}
    </h1>
  );
}

/**
 * Sceau circulaire animé avec texte SVG rotatif et silhouette avion centrale.
 */
export function SceauRotatif({
  texte = 'WORLD DESTINATION • AGENCE AGRÉÉE • VOYAGES & ÉTUDES • ',
  taille = 84,
  className,
}: {
  texte?: string;
  taille?: number;
  className?: string;
}) {
  const pathId = useId().replace(/:/g, '');
  const scopeRef = useRef<HTMLDivElement>(null);
  const anneauRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const anneau = anneauRef.current;
      if (!anneau || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: MOTION_QUERY }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        gsap.to(anneau, {
          rotation: 360,
          duration: 22,
          ease: 'none',
          repeat: -1,
          svgOrigin: '50 50',
        });
      });
      return () => mm.revert();
    },
    { scope: scopeRef },
  );

  return (
    <div
      ref={scopeRef}
      className={['sceau-rotatif no-print', className].filter(Boolean).join(' ')}
      style={{ width: taille, height: taille }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={taille} height={taille}>
        <defs>
          <path
            id={pathId}
            d="M 50, 50 m -39, 0 a 39,39 0 1,1 78,0 a 39,39 0 1,1 -78,0"
          />
        </defs>
        <g ref={anneauRef}>
          <text fill="currentColor" fontSize="5.6" fontWeight="700" letterSpacing="1.12">
            <textPath href={`#${pathId}`} startOffset="0%">
              {texte}
            </textPath>
          </text>
        </g>
      </svg>
      <span className="sceau-centre">
        <svg viewBox="0 0 24 24" width={Math.round(taille * 0.28)} height={Math.round(taille * 0.28)} fill="none">
          <path
            d="M21 3L10 14M21 3L14.5 21L10.5 13.5L3 9.5L21 3Z"
            stroke="#2EC4DC"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

export type ElementEventail = {
  id: string;
  numero: string;
  clientNom: string;
  modeleNom: string;
  couleur?: string;
  etapeNom: string;
  pourcent: number;
  faites: number;
  total: number;
  docsValides: number;
  docsTotal: number;
  docsEnvoye: number;
  impaye: boolean;
  to: string;
};

/**
 * Vitrine interactive en éventail 3D de max 4 dossiers phares avec panneau projecteur.
 */
export function EventailCartes({
  cartes,
  titre = 'Dossiers sous les projecteurs',
  sousTitre,
  className,
}: {
  cartes: ElementEventail[];
  titre?: string;
  sousTitre?: string;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const finePointerRef = useRef(false);
  const visibles = cartes.slice(0, 4);
  const [indexActif, setIndexActif] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqFine = window.matchMedia('(pointer: fine)');
    const mqReduce = window.matchMedia(REDUCE_QUERY);
    const mqLarge = window.matchMedia('(min-width: 861px)');
    const maj = () => {
      finePointerRef.current = mqFine.matches && !mqReduce.matches && mqLarge.matches;
    };
    maj();
    mqFine.addEventListener('change', maj);
    mqReduce.addEventListener('change', maj);
    mqLarge.addEventListener('change', maj);
    return () => {
      mqFine.removeEventListener('change', maj);
      mqReduce.removeEventListener('change', maj);
      mqLarge.removeEventListener('change', maj);
    };
  }, []);

  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el || typeof window === 'undefined') return;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: MOTION_QUERY }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        const cards = q('.carte-eventail');
        if (!cards.length) return;
        gsap.fromTo(
          cards,
          { y: 14, opacity: 0.02 },
          {
            y: 0,
            opacity: 1,
            duration: 0.36,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
        );
      });
      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [visibles.length] },
  );

  if (visibles.length === 0) return null;

  const safeIndex = indexActif < visibles.length ? indexActif : 0;
  const actif = visibles[safeIndex];

  const gererSurvolCarte = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!finePointerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = gsap.utils.clamp(-6, 6, dx * 12);
    const rotateX = gsap.utils.clamp(-6, 6, -dy * 12);
    gsap.to(e.currentTarget, {
      rotateX,
      rotateY,
      transformPerspective: 900,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const reinitialiserCarte = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!finePointerRef.current) return;
    gsap.to(e.currentTarget, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.34,
      ease: 'power3.out',
      clearProps: 'transform',
      overwrite: 'auto',
    });
  };

  return (
    <section
      ref={sectionRef}
      className={['eventail-section', className].filter(Boolean).join(' ')}
      aria-label={titre}
    >
      <div className="eventail-entete">
        <div>
          <h2>{titre}</h2>
          {sousTitre && <p className="texte-doux">{sousTitre}</p>}
        </div>
        <span className="pill-info">
          {safeIndex + 1} / {visibles.length}
        </span>
      </div>

      <div className="eventail-grille">
        {visibles.map((carte, idx) => {
          const estActif = idx === safeIndex;
          const bornePourcent = Math.min(100, Math.max(0, Math.round(carte.pourcent)));
          const styleCarte = carte.couleur
            ? ({ '--carte-accent': carte.couleur } as CSSProperties)
            : undefined;
          return (
            <button
              key={carte.id}
              type="button"
              className={`carte-eventail${estActif ? ' est-active' : ''}`}
              aria-pressed={estActif}
              data-cursor="Inspecter ↗"
              style={styleCarte}
              onClick={() => setIndexActif(idx)}
              onPointerMove={gererSurvolCarte}
              onPointerLeave={reinitialiserCarte}
            >
              <div className="carte-eventail-haut">
                <span className="mono">{carte.numero}</span>
                <span className={`badge ${carte.impaye ? 'badge-alerte' : 'badge-ok'}`}>
                  {bornePourcent}%
                </span>
              </div>
              <div className="carte-eventail-client">{carte.clientNom}</div>
              <div className="carte-eventail-modele">{carte.modeleNom}</div>
              <div className="carte-eventail-etape">{carte.etapeNom}</div>
              <div className="carte-eventail-barre" aria-hidden="true">
                <span style={{ width: `${bornePourcent}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="eventail-projecteur" aria-live="polite">
        <div className="eventail-projecteur-infos">
          <div className="eventail-projecteur-meta">
            <span className="mono badge badge-neutre">{actif.numero}</span>
            <span className="badge badge-info">{actif.modeleNom}</span>
            {actif.impaye && <span className="badge badge-alerte">Reste à percevoir</span>}
            {actif.docsEnvoye > 0 && (
              <span className="badge badge-attente">{actif.docsEnvoye} doc(s) à vérifier</span>
            )}
          </div>
          <h3>{actif.clientNom}</h3>
          <p className="texte-doux">
            Étape actuelle : <strong>{actif.etapeNom}</strong> — {actif.faites}/{actif.total}{' '}
            étapes ({Math.round(actif.pourcent)}%) • {actif.docsValides}/{actif.docsTotal} documents
            validés
          </p>
        </div>

        <Link className="btn btn-primaire btn-capsule" to={actif.to} data-cursor="Ouvrir ↗">
          Accéder au dossier{' '}
          <span className="capsule-fleche" aria-hidden="true">
            ↗
          </span>
        </Link>
      </div>
    </section>
  );
}

/**
 * Bouton flottant de progression du défilement & retour en haut de page.
 */
export function AnneauDefilement(): JSX.Element {
  const [visible, setVisible] = useState(false);
  const cercleRef = useRef<SVGCircleElement>(null);
  const rayon = 18;
  const circonference = 2 * Math.PI * rayon;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId = 0;

    const mettreAJour = () => {
      rafId = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
      if (cercleRef.current) {
        cercleRef.current.style.strokeDashoffset = String(circonference * (1 - ratio));
      }
      setVisible(y > 160);
    };

    const surScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(mettreAJour);
    };

    mettreAJour();
    window.addEventListener('scroll', surScroll, { passive: true });
    window.addEventListener('resize', surScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', surScroll);
      window.removeEventListener('resize', surScroll);
    };
  }, [circonference]);

  const remonter = () => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia(REDUCE_QUERY).matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      className={`anneau-defilement no-print${visible ? ' est-visible' : ''}`}
      aria-label="Remonter en haut"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      style={{
        opacity: visible ? undefined : 0,
        pointerEvents: visible ? undefined : 'none',
      }}
      onClick={remonter}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={rayon}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2.5"
        />
        <circle
          ref={cercleRef}
          cx="22"
          cy="22"
          r={rayon}
          fill="none"
          stroke="#2EC4DC"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={circonference}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="anneau-fleche" aria-hidden="true">
        ↑
      </span>
    </button>
  );
}
