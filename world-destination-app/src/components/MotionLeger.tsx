/**
 * Primitives de mouvement des écrans de travail, sans GSAP (Web Animations API).
 * Même rendu que les versions GSAP d'origine, mais elles ne pèsent rien dans le bundle
 * et respectent le mouvement réduit (fondu court ou rien).
 */
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { animer, cascade, DUREE, EASE_IN, EASE_OUT, mouvementReduit, retirerALaFin, signalerEntreeEcran, sortieSiRetire } from './mouvement';

function selectionnerCibles(racine: HTMLElement, selecteur: string): Element[] {
  const s = selecteur.trim();
  if (s === '> *' || s === ':scope > *') return Array.from(racine.children);
  return Array.from(racine.querySelectorAll(s.startsWith('>') ? `:scope ${s}` : s));
}

/**
 * Arrivée d'un écran : fondu croisé court (150 ms, opacité seule) — c'est le conteneur, il porte
 * son contenu ; le mouvement vertical est laissé aux cascades internes (une seule couche de
 * déplacement). Jamais de visibility:hidden : focus et clics possibles dès la 1re image.
 */
export function EntreePage({ children, className, cle, style }: { children: ReactNode; className?: string; cle?: string | number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    signalerEntreeEcran();
    const a = animer(ref.current, [{ opacity: 0 }, { opacity: 1 }], { duration: DUREE.d150, easing: EASE_OUT });
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
    if (ref.current) cascade(selectionnerCibles(ref.current, selecteur), { y: 6, duree: DUREE.d200 });
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
 * - par défaut : valeur fixe (elle arrive avec sa carte) ;
 * - `compteDepuisZero` : interpolation de 0 à la cible (nombres ou montants multi-devises), 300 ms.
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
    // Valeur simple : affichée telle quelle (donnée fonctionnelle ; la carte qui la contient a
    // déjà son entrée — pas de seconde couche). Montant : comptage court, une fois, à l'arrivée.
    if (!compteDepuisZero || mouvementReduit()) return;
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

/* =====================================================================
 * Pièces « signature » sans GSAP (WAAPI + CSS sur le compositeur)
 * ===================================================================== */


/** Vrai si l'intro de lancement est en train de jouer (les titres attendent alors d'être « posés » par elle). */
export const introEnCours = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-intro');

/**
 * Titre révélé mot par mot (masque), mot-clé surligné par un balayage qui suit le sens de lecture.
 * `anime={false}` sur les écrans de travail : le titre est simplement là (surface fréquente).
 * Pendant l'intro de lancement, le titre ne s'anime pas : ce sont les lettres de l'intro qui s'y posent.
 */
export function TitreCinetique({ texte, as = 'h1', className, accentMot, anime = true, cibleIntro = false }: {
  texte: string; as?: 'h1' | 'h2' | 'div' | 'span'; className?: string; accentMot?: string; anime?: boolean; cibleIntro?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const mots = texte.split(/\s+/).filter(Boolean);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anime || introEnCours()) return;
    const internes = Array.from(el.querySelectorAll<HTMLElement>('.mot-interne'));
    const n = internes.length;
    internes.forEach((m, i) => {
      // Écarts qui rétrécissent : le 1er mot mène, les suivants le rattrapent (une vague, pas une file).
      const delai = n > 1 ? Math.round(160 * (1 - (1 - i / (n - 1)) ** 1.6)) : 0;
      animer(m, [{ transform: 'translate3d(0, 105%, 0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, delay: delai, easing: EASE_OUT, fill: 'backwards' });
    });
    el.querySelectorAll<HTMLElement>('.mot-accent').forEach((acc) => {
      const trait = acc.querySelector<HTMLElement>('.mot-surlignage');
      animer(trait, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, delay: 260 + 40 * n, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'backwards' });
    });
  }, [texte, anime]);

  const contenu = mots.map((mot, idx) => {
    const estAccent = Boolean(accentMot && mot.toLocaleLowerCase().includes(accentMot.toLocaleLowerCase()));
    return (
      <Fragment key={`${mot}-${idx}`}>
        {idx > 0 ? ' ' : null}
        <span className="mot-masque">
          <span className={estAccent ? 'mot-interne mot-accent' : 'mot-interne'}>
            {estAccent && <span className="mot-surlignage" aria-hidden="true" />}
            <span className="mot-texte">{mot}</span>
          </span>
        </span>
      </Fragment>
    );
  });
  const props = {
    ref: (n: HTMLElement | null) => { ref.current = n; },
    className: ['titre-cinetique', className].filter(Boolean).join(' '),
    'data-cible-intro': cibleIntro || undefined,
    'aria-label': texte,
  };
  if (as === 'h2') return <h2 {...props}>{contenu}</h2>;
  if (as === 'div') return <div {...props}>{contenu}</div>;
  if (as === 'span') return <span {...props}>{contenu}</span>;
  return <h1 {...props}>{contenu}</h1>;
}

/** Met en pause une animation CSS en boucle quand son élément sort de l'écran. */
function usePauseHorsEcran(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => el.classList.toggle('hors-ecran', !e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
}

/**
 * Sceau circulaire au texte rotatif. Rotation en CSS (compositeur, hors fil principal), en pause
 * hors écran ; `immobile` pour les écrans de travail (pas de boucle décorative sur une surface fréquente).
 */
export function SceauRotatif({ texte = 'WORLD DESTINATION • AGENCE AGRÉÉE • VOYAGES & ÉTUDES • ', taille = 84, className, immobile = false }: {
  texte?: string; taille?: number; className?: string; immobile?: boolean;
}) {
  const pathId = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  usePauseHorsEcran(ref);
  return (
    <div ref={ref} className={['sceau-rotatif no-print', immobile ? 'est-immobile' : '', className].filter(Boolean).join(' ')} style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={taille} height={taille} className="sceau-anneau">
        <defs><path id={pathId} d="M 50, 50 m -39, 0 a 39,39 0 1,1 78,0 a 39,39 0 1,1 -78,0" /></defs>
        <text fill="currentColor" fontSize="5.6" fontWeight="700" letterSpacing="1.12"><textPath href={`#${pathId}`} startOffset="0%">{texte}</textPath></text>
      </svg>
      <span className="sceau-centre">
        <svg viewBox="0 0 24 24" width={Math.round(taille * 0.28)} height={Math.round(taille * 0.28)} fill="none">
          <path d="M21 3L10 14M21 3L14.5 21L10.5 13.5L3 9.5L21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const ITEMS_MARQUEE_DEFAUT = ['CAMPUS FRANCE', 'AUSBILDUNG ALLEMAGNE', 'VISA SCHENGEN', 'ENTRÉE EXPRESS CANADA', 'ÉTUDES EN ITALIE', 'BOURSES INTERNATIONALES', 'SUIVI TEMPS RÉEL', 'ESPACE CLIENT FR / AR'];

/**
 * Bandeau défilant (vitrine uniquement). Défilement en CSS linéaire sur le compositeur, en pause au
 * survol, au focus, hors écran, et par un bouton pause/lecture (WCAG 2.2.2). Immobile en mouvement réduit.
 */
export function BandeauMarquee({ items, incline = false, vitesse = 28, className }: { items?: string[]; incline?: boolean; vitesse?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [enPause, setEnPause] = useState(false);
  usePauseHorsEcran(ref);
  const liste = items && items.length > 0 ? items : ITEMS_MARQUEE_DEFAUT;
  return (
    <div ref={ref} role="group" aria-label="Destinations et programmes phares"
      className={['bandeau-marquee avec-commande no-print', incline ? 'est-incline' : '', enPause ? 'est-en-pause' : '', className].filter(Boolean).join(' ')}
      style={{ direction: 'ltr', '--marquee-duree': `${Math.max(12, vitesse)}s` } as CSSProperties}>
      <div className="bandeau-marquee-piste">
        {[0, 1].flatMap((copie) => liste.map((item, idx) => (
          <span key={`${copie}-${idx}`} className="bandeau-marquee-item" aria-hidden={copie === 1 || undefined}>
            <span>{item}</span><span className="bandeau-marquee-etoile" aria-hidden="true">✦</span>
          </span>
        )))}
      </div>
      <button type="button" className="bandeau-marquee-commande" aria-pressed={enPause}
        aria-label={enPause ? 'Reprendre le défilement' : 'Mettre en pause le défilement'} title={enPause ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
        onClick={() => setEnPause((v) => !v)}>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">
          {enPause ? <path d="M8 5.5v13l10.5-6.5z" /> : <><rect x="6.5" y="5.5" width="3.8" height="13" rx="1" /><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" /></>}
        </svg>
      </button>
    </div>
  );
}

/**
 * Signature : arc orbital tracé (révélé par clip-path) et avion qui monte jusqu'au sommet, puis
 * flotte doucement (vitrine). Tout en transform / opacity / clip-path, rien sous mouvement réduit.
 */
export function AvionTrajectoire({ variant = 'hero', className, titre }: { variant?: 'hero' | 'compact'; className?: string; titre?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gradId = useId();
  usePauseHorsEcran(ref);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || mouvementReduit()) return;
    const trace = el.querySelector('.avion-trace');
    const avion = el.querySelector('.avion-silhouette');
    const balise = el.querySelector('.avion-balise');
    const a1 = trace && (trace as HTMLElement).animate?.([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 560, easing: EASE_OUT, fill: 'backwards' });
    const a2 = animer(avion, [{ transform: 'translate(-46px, 24px) rotate(16deg) scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 560, delay: 40, easing: EASE_OUT, fill: 'backwards' });
    const a3 = animer(balise, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, delay: 320, easing: EASE_OUT, fill: 'backwards' });
    return () => { a1?.cancel(); a2?.cancel(); a3?.cancel(); };
  }, [variant]);
  const compact = variant === 'compact';
  return (
    <div ref={ref} dir="ltr" className={['avion-trajectoire', variant === 'hero' ? 'avec-flottement' : '', className].filter(Boolean).join(' ')}
      aria-hidden={titre ? undefined : true} role={titre ? 'img' : undefined} aria-label={titre}
      style={{ overflow: 'hidden', lineHeight: 0, maxWidth: '100%', pointerEvents: 'none' }}>
      <svg viewBox="0 0 280 100" width={compact ? 140 : 280} height={compact ? 50 : 100} style={{ width: '100%', maxWidth: compact ? 140 : 280, height: 'auto', display: 'block' }} fill="none">
        <defs>
          <linearGradient id={gradId} x1="16" y1="88" x2="256" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="55%" stopColor="var(--c-accent-ciel, #0098C0)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path d="M 18 82 Q 124 14 238 26" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round" />
        <g className="avion-trace"><path d="M 18 82 Q 124 14 238 26" stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinecap="round" /></g>
        <circle className="avion-balise" cx="18" cy="82" r="4" fill="var(--c-accent-ciel, #0098C0)" style={{ transformOrigin: '18px 82px', transformBox: 'view-box' } as CSSProperties} />
        <g transform="translate(238, 26)">
          <g className="avion-flotte"><g className="avion-silhouette">
            <path d="M 14 -6 L -12 -1 L -3 2.5 L -7 9 L -1.5 5.5 L 5.5 9 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </g></g>
        </g>
      </svg>
    </div>
  );
}

export type ElementEventail = {
  id: string; numero: string; clientNom: string; modeleNom: string; couleur?: string; etapeNom: string; pourcent: number;
  faites: number; total: number; docsValides: number; docsTotal: number; docsEnvoye: number; impaye: boolean; to: string;
};

/** Vitrine en éventail de 4 dossiers phares + panneau projecteur (cascade à l'arrivée de l'écran seulement). */
export function EventailCartes({ cartes, titre = 'Dossiers sous les projecteurs', sousTitre, className }: { cartes: ElementEventail[]; titre?: string; sousTitre?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const visibles = cartes.slice(0, 4);
  const [indexActif, setIndexActif] = useState(0);
  useLayoutEffect(() => {
    if (ref.current) cascade(Array.from(ref.current.querySelectorAll('.carte-eventail')), { y: 10 });
  }, []);
  // Le projecteur change de contenu : fondu court, sans déplacement (changement d'état, pas d'entrée).
  const projRef = useRef<HTMLDivElement>(null);
  const premier = useRef(true);
  useLayoutEffect(() => {
    if (premier.current) { premier.current = false; return; }
    animer(projRef.current?.querySelector('.eventail-projecteur-infos'), [{ opacity: 0.4 }, { opacity: 1 }], { duration: DUREE.d150, easing: EASE_OUT });
  }, [indexActif]);
  if (visibles.length === 0) return null;
  const safeIndex = indexActif < visibles.length ? indexActif : 0;
  const actif = visibles[safeIndex];
  return (
    <section ref={ref} className={['eventail-section', className].filter(Boolean).join(' ')} aria-label={titre}>
      <div className="eventail-entete">
        <div><h2>{titre}</h2>{sousTitre && <p className="texte-doux">{sousTitre}</p>}</div>
        <span className="pill-info">{safeIndex + 1} / {visibles.length}</span>
      </div>
      <div className="eventail-grille">
        {visibles.map((carte, idx) => {
          const pct = Math.min(100, Math.max(0, Math.round(carte.pourcent)));
          return (
            <button key={carte.id} type="button" className={`carte-eventail${idx === safeIndex ? ' est-active' : ''}`} aria-pressed={idx === safeIndex}
              style={carte.couleur ? ({ '--carte-accent': carte.couleur } as CSSProperties) : undefined} onClick={() => setIndexActif(idx)}>
              <div className="carte-eventail-haut"><span className="mono">{carte.numero}</span><span className={`badge ${carte.impaye ? 'badge-alerte' : 'badge-ok'}`}>{pct}%</span></div>
              <div className="carte-eventail-client">{carte.clientNom}</div>
              <div className="carte-eventail-modele">{carte.modeleNom}</div>
              <div className="carte-eventail-etape">{carte.etapeNom}</div>
              <div className="carte-eventail-barre" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
            </button>
          );
        })}
      </div>
      <div ref={projRef} className="eventail-projecteur" aria-live="polite">
        <div className="eventail-projecteur-infos">
          <div className="eventail-projecteur-meta">
            <span className="mono badge badge-neutre">{actif.numero}</span>
            <span className="badge badge-info">{actif.modeleNom}</span>
            {actif.impaye && <span className="badge badge-alerte">Reste à percevoir</span>}
            {actif.docsEnvoye > 0 && <span className="badge badge-attente">{actif.docsEnvoye} doc(s) à vérifier</span>}
          </div>
          <h3>{actif.clientNom}</h3>
          <p className="texte-doux">Étape actuelle : <strong>{actif.etapeNom}</strong> — {actif.faites}/{actif.total} étapes ({Math.round(actif.pourcent)}%) • {actif.docsValides}/{actif.docsTotal} documents validés</p>
        </div>
        <Link className="btn btn-primaire btn-capsule" to={actif.to}>Accéder au dossier <span className="capsule-fleche" aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}

