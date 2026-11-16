/**
 * Pièces animées par GSAP, chargées À LA DEMANDE (import dynamique depuis App.tsx) :
 * - IntroCinetique : intro de lancement (une fois par session) ;
 * - CurseurMagnetique : curseur suiveur, conservé pour une future page vitrine mais NON branché
 *   dans le logiciel (surface de travail fréquente — skill remove-animations).
 * Toutes les autres primitives sont dans MotionLeger (sans GSAP) et réexportées ici pour compatibilité.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { EVENEMENT_REJOUER_INTRO } from './MotionLeger';

gsap.registerPlugin(useGSAP);

export {
  AnneauDefilement, AvionTrajectoire, BandeauMarquee, CompteurAnime, declencherIntroCinetique, EntreePage, EventailCartes,
  PanneauDeroulant, SceauRotatif, StaggerGrille, StaggerListe, TitreCinetique,
} from './MotionLeger';
export type { ElementEventail } from './MotionLeger';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const CLE_INTRO_VUE = 'wd-intro-vue';
const SELECTEUR_CURSEUR =
  '[data-cursor], a.kpi, .choix-carte, tr.cliquable, .carte-eventail, .btn-primaire';


/** Intro automatique : une seule fois par session, jamais sous mouvement réduit ni en test automatisé. */
function peutJouerIntroAuto(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (navigator.webdriver || window.matchMedia(REDUCE_QUERY).matches) return false;
  try {
    if (sessionStorage.getItem(CLE_INTRO_VUE)) return false;
    sessionStorage.setItem(CLE_INTRO_VUE, '1');
  } catch {
    // Stockage indisponible : on joue l'intro
  }
  return true;
}

const MOT_1 = 'World';
const MOT_2 = 'Destination';

/** Position (centre, hauteur) de chaque lettre du titre cible, lue dans le DOM avec des Range. */
function positionsCible(): { x: number; y: number; h: number }[] | null {
  const cible = document.querySelector<HTMLElement>('[data-cible-intro]');
  if (!cible) return null;
  const r = cible.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return null;
  const out: { x: number; y: number; h: number }[] = [];
  const marcheur = document.createTreeWalker(cible, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = marcheur.nextNode())) {
    const t = n.textContent ?? '';
    for (let i = 0; i < t.length; i++) {
      if (!t[i].trim()) continue;
      const range = document.createRange();
      range.setStart(n, i); range.setEnd(n, i + 1);
      const b = range.getBoundingClientRect();
      out.push({ x: b.left + b.width / 2, y: b.top + b.height / 2, h: b.height });
    }
  }
  return out.length === (MOT_1 + MOT_2).length ? out : null;
}

/**
 * Intro de lancement (≤ 1,6 s, passable au clic ou à n'importe quelle touche).
 *  0,00 s  le médaillon WD apparaît avec sa lueur (échelle .86 → 1, fondu) ;
 *  0,15 s  l'avion trace son arc (clip-path) et monte jusqu'au sommet ;
 *  0,30 s  « World Destination » se forme sous le logo ;
 *  0,78 s  les lettres se dispersent en 3D (translation, rotation, profondeur) ;
 *  1,02 s  elles se recomposent exactement sur le titre de l'écran (mesuré lettre par lettre)
 *          pendant que le voile se dissipe — puis le vrai titre prend le relais (fondu croisé).
 * Uniquement transform / opacity (et un clip-path pour le tracé) ; l'application est déjà montée
 * et utilisable derrière. Rien du tout sous prefers-reduced-motion.
 */
export function IntroCinetique({ ouvrirAuMontage = false }: { ouvrirAuMontage?: boolean }): JSX.Element | null {
  const [ouverte, setOuverte] = useState<boolean>(() =>
    ouvrirAuMontage ? !window.matchMedia(REDUCE_QUERY).matches : peutJouerIntroAuto());
  const [session, setSession] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const surRejeu = () => {
      if (window.matchMedia(REDUCE_QUERY).matches) return; // mouvement réduit : pas d'intro du tout
      setOuverte(true);
      setSession((n) => n + 1);
    };
    window.addEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
    return () => window.removeEventListener(EVENEMENT_REJOUER_INTRO, surRejeu);
  }, []);

  // Le titre cible ne joue pas sa propre révélation pendant l'intro (ce sont nos lettres qui s'y posent).
  useEffect(() => {
    if (!ouverte) return;
    document.documentElement.setAttribute('data-intro', '');
    return () => document.documentElement.removeAttribute('data-intro');
  }, [ouverte]);

  const passer = useCallback(() => {
    const tl = tlRef.current;
    const el = racine.current;
    tlRef.current = null;
    tl?.kill();
    if (!el) { setOuverte(false); return; }
    gsap.to(el, { opacity: 0, duration: 0.15, ease: 'power2.out', overwrite: true, onComplete: () => setOuverte(false) });
  }, []);

  useEffect(() => {
    if (!ouverte) return;
    const touche = () => passer();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [ouverte, passer]);

  useGSAP(() => {
    const el = racine.current;
    if (!ouverte || !el) return;
    const q = gsap.utils.selector(el);
    const lettres = q('.intro-l') as HTMLElement[];
    const vw = window.innerWidth, vh = window.innerHeight;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => { tlRef.current = null; setOuverte(false); } });
    tlRef.current = tl;

    gsap.set(lettres, { opacity: 0, yPercent: 60, force3D: true });
    // 1. Médaillon + lueur
    tl.fromTo(q('.intro-medaillon'), { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.42 }, 0)
      .fromTo(q('.intro-halo'), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out' }, 0)
    // 2. Arc tracé (clip-path) + avion qui monte au sommet
      .fromTo(q('.intro-arc-trace'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.55, ease: 'power3.out' }, 0.15)
      .fromTo(q('.intro-avion'), { x: -150, y: 46, rotation: 18, opacity: 0 }, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.58, ease: 'power3.out' }, 0.15)
    // 3. Le nom se forme (vague depuis le centre, écarts courts)
      .to(lettres, { opacity: 1, yPercent: 0, duration: 0.4, stagger: { each: 0.016, from: 'center' } }, 0.3);

    // 4. Dispersion 3D : chaque lettre part sur un rayon autour de sa position (pseudo-aléatoire stable)
    const rayon = Math.min(vw, vh) * 0.32;
    tl.addLabel('eclat', 0.78)
      .to(lettres, {
        x: (i: number) => Math.cos(i * 2.399) * rayon * (0.55 + (i % 4) * 0.15),
        y: (i: number) => Math.sin(i * 2.399) * rayon * (0.45 + (i % 3) * 0.18),
        z: (i: number) => 140 + (i % 5) * 70,
        rotationX: (i: number) => (i % 2 ? 55 : -45),
        rotationY: (i: number) => (i % 3 ? -60 : 70),
        rotation: (i: number) => ((i * 47) % 90) - 45,
        duration: 0.3, ease: 'power2.out', stagger: { each: 0.008, from: 'center' },
      }, 'eclat')
      .to(q('.intro-medaillon, .intro-arc, .intro-halo'), { opacity: 0, scale: 0.94, duration: 0.24, ease: 'power2.out' }, 'eclat');

    // 5. Recomposition sur le titre réel (mesuré maintenant : l'écran a fini de se monter derrière)
    tl.addLabel('pose', 1.02).add(() => {
      const cibles = positionsCible();
      const t = gsap.timeline();
      lettres.forEach((l, i) => {
        const b = l.getBoundingClientRect();
        const cx = b.left + b.width / 2 - (gsap.getProperty(l, 'x') as number);
        const cy = b.top + b.height / 2 - (gsap.getProperty(l, 'y') as number);
        const c = cibles?.[i];
        const echelle = c ? c.h / (b.height || 1) : 0.6;
        t.to(l, {
          x: c ? c.x - cx : 0, y: c ? c.y - cy : -vh * 0.18, z: 0, rotationX: 0, rotationY: 0, rotation: 0,
          scale: c ? echelle : 0.6, opacity: c ? 1 : 0, duration: 0.42, ease: 'expo.inOut',
        }, i * 0.006);
      });
      tl.add(t, 'pose');
    }, 'pose')
      .to(q('.intro-voile'), { opacity: 0, duration: 0.42, ease: 'power2.inOut' }, 'pose+=0.04')
      .to(lettres, { opacity: 0, duration: 0.14, ease: 'none' }, 'pose+=0.44');

    return () => { tl.kill(); };
  }, { scope: racine, dependencies: [ouverte, session] });

  if (!ouverte) return null;
  return (
    <div ref={racine} className="intro-lancement no-print" role="dialog" aria-label="Animation d'ouverture World Destination" onClick={passer}>
      <div className="intro-voile" aria-hidden="true" />
      <div className="intro-scene" aria-hidden="true">
        <div className="intro-halo" />
        <div className="intro-medaillon"><img src="./logo.png" alt="" /></div>
        <svg className="intro-arc" viewBox="0 0 300 110" fill="none">
          <path d="M 20 92 Q 140 8 268 30" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" strokeDasharray="4 7" strokeLinecap="round" />
          <g className="intro-arc-trace"><path d="M 20 92 Q 140 8 268 30" stroke="#4fd4e8" strokeWidth="2.5" strokeLinecap="round" /></g>
          <g transform="translate(268, 30)"><g className="intro-avion">
            <path d="M 14 -6 L -12 -1 L -3 2.5 L -7 9 L -1.5 5.5 L 5.5 9 Z" fill="#ffffff" />
          </g></g>
        </svg>
        <div className="intro-nom">
          <span className="intro-mot">{MOT_1.split('').map((c, i) => <span key={`a${i}`} className="intro-l">{c}</span>)}</span>
          <span className="intro-mot intro-mot-accent">{MOT_2.split('').map((c, i) => <span key={`b${i}`} className="intro-l">{c}</span>)}</span>
        </div>
      </div>
      <button type="button" className="intro-passer" onClick={(e) => { e.stopPropagation(); passer(); }}>Passer l&apos;intro</button>
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
      // Le point suit le pointeur sans aucun retard (latence zéro) ; seul l'anneau traîne un peu.
      const xPoint = gsap.quickSetter(point, 'x', 'px') as (v: number) => void;
      const yPoint = gsap.quickSetter(point, 'y', 'px') as (v: number) => void;
      const xAnneau = gsap.quickTo(anneau, 'x', { duration: 0.2, ease: 'power3.out' });
      const yAnneau = gsap.quickTo(anneau, 'y', { duration: 0.2, ease: 'power3.out' });

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

