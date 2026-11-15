/**
 * Mouvement léger, sans dépendance (Web Animations API + ressorts maison).
 * Utilisé par les écrans de travail : GSAP n'est chargé que pour les pièces « signature »
 * (intro, éventail, sceau, bandeau…), à la demande.
 *
 * Règles (skills apple-design + vectorlab motion/transitions/reduced-motion) :
 * - durées 100 / 150 / 200 / 300 ms, entrée ease-out, sortie ease-in plus courte ;
 * - transform et opacity uniquement ;
 * - mouvement réduit : fondu ≤ 150 ms ou rien ;
 * - tout ce que l'on peut saisir (feuille) est un ressort qui part de la valeur affichée.
 */

export const DUREE = { d100: 100, d150: 150, d200: 200, d300: 300 } as const;
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_IN = 'cubic-bezier(0.7, 0, 0.84, 0)';

const mq = (q: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
export const mouvementReduit = () => mq('(prefers-reduced-motion: reduce)');
export const ecranEtroit = () => mq('(max-width: 640px)');

/**
 * Lance une animation WAAPI en respectant le mouvement réduit :
 * en mode réduit, seules les images-clés d'opacité sont conservées (fondu court), sinon rien.
 */
export function animer(
  el: Element | null | undefined,
  images: Keyframe[],
  options: KeyframeAnimationOptions = {},
): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  if (mouvementReduit()) {
    const opacites = images.map((k) => ({ opacity: k.opacity ?? 1 }));
    if (!opacites.some((k) => k.opacity !== 1)) return null;
    return (el as HTMLElement).animate(opacites, { ...options, duration: Math.min(Number(options.duration ?? DUREE.d150), DUREE.d150), delay: 0 });
  }
  return (el as HTMLElement).animate(images, { duration: DUREE.d200, easing: EASE_OUT, ...options });
}

/** Entrée standard : légère montée + fondu (contenu de page, panneaux, cartes). */
export function entree(el: Element | null | undefined, { y = 8, duree = DUREE.d200, delai = 0, echelle = 1 }: { y?: number; duree?: number; delai?: number; echelle?: number } = {}) {
  return animer(el, [
    { opacity: 0, transform: `translate3d(0, ${y}px, 0) scale(${echelle})` },
    { opacity: 1, transform: 'none' },
  ], { duration: duree, delay: delai, easing: EASE_OUT, fill: 'backwards' });
}

/** Cascade plafonnée : ≤ 30 ms par élément et ≤ 200 ms au total (au-delà, tout arrive ensemble). */
export function cascade(cibles: Element[], { y = 8, duree = DUREE.d200, pas = 30, echelle = 1 }: { y?: number; duree?: number; pas?: number; echelle?: number } = {}) {
  const n = Math.min(cibles.length, 12);
  const step = n > 1 ? Math.min(pas, 200 / (n - 1)) : 0;
  cibles.forEach((c, i) => entree(c, { y, duree, delai: i < n ? i * step : 0, echelle }));
}

/* ---------------- Ressorts (feuilles glissables) ---------------- */

/**
 * Ressort paramétré comme chez Apple : amortissement (1 = sans rebond) et réponse (s).
 * Part de la valeur et de la vitesse courantes : interruptible à tout instant. Renvoie « stop ».
 */
export function ressort(
  depuis: number,
  vers: number,
  rendu: (v: number) => void,
  { amortissement = 1, reponse = 0.35, vitesse = 0, fin }: { amortissement?: number; reponse?: number; vitesse?: number; fin?: () => void } = {},
): () => void {
  const raideur = (2 * Math.PI / reponse) ** 2;
  const frottement = (4 * Math.PI * amortissement) / reponse;
  let x = depuis;
  let v = vitesse;
  let precedent = performance.now();
  let id = 0;
  let arrete = false;
  const pas = (t: number) => {
    if (arrete) return;
    let dt = Math.min((t - precedent) / 1000, 1 / 30);
    precedent = t;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-raideur * (x - vers) - frottement * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - vers) < 0.5 && Math.abs(v) < 8) {
      rendu(vers);
      fin?.();
      return;
    }
    rendu(x);
    id = requestAnimationFrame(pas);
  };
  id = requestAnimationFrame(pas);
  return () => { arrete = true; cancelAnimationFrame(id); };
}

/** Point d'arrivée projeté d'un geste lancé (décélération de défilement iOS). */
export const projeter = (vitesse: number, deceleration = 0.998) => ((vitesse / 1000) * deceleration) / (1 - deceleration);

/** Résistance progressive au-delà d'une borne (« rubber band »). */
export const elastique = (depassement: number, dimension: number, constante = 0.55) =>
  (depassement * dimension * constante) / (dimension + constante * Math.abs(depassement));

/**
 * Sortie symétrique d'un élément que React retire : copie inerte (sans rôle ni id, cachée aux
 * technologies d'assistance), animée puis supprimée. Ne bloque ni Échap ni le focus.
 */
export function copieDeSortie(el: HTMLElement): HTMLElement {
  const copie = el.cloneNode(true) as HTMLElement;
  copie.setAttribute('aria-hidden', 'true');
  copie.setAttribute('inert', '');
  copie.removeAttribute('id');
  copie.removeAttribute('role');
  copie.querySelectorAll('[id], [role], [aria-live]').forEach((n) => { n.removeAttribute('id'); n.removeAttribute('role'); n.removeAttribute('aria-live'); });
  copie.style.pointerEvents = 'none';
  copie.classList.add('copie-sortie');
  document.body.appendChild(copie);
  return copie;
}
