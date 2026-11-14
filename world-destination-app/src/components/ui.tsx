import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ErreurMetier } from '../lib/store';
import type { StatutDocument, StatutDossier } from '../lib/types';
import { Icone, type NomIcone } from './Icone';

export { Icone } from './Icone';

gsap.registerPlugin(useGSAP);

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const MOBILE_QUERY = '(max-width: 640px)';

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

  useGSAP(
    () => {
      const el = toastRef.current;
      if (!el || !t || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        gsap.fromTo(
          el,
          { y: 12, scale: 0.96, opacity: 0.02 },
          { y: 0, scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(1.25)', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: toastRef, dependencies: [t?.id], revertOnUpdate: true },
  );

  if (!t) return null;
  return (
    <div ref={toastRef} className={`toast ${t.erreur ? 'erreur-toast' : ''}`} role="status">
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
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  const [idTitre] = useState(() => `modale-titre-${++compteurModale}`);

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const boite = ref.current;
    const premier = boite?.querySelector<HTMLElement>('[data-focus-initial], input:not([type="checkbox"]), select, textarea') ?? boite?.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? boite)?.focus();
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
      if (precedent?.isConnected) precedent.focus();
    };
  }, []);

  useGSAP(
    () => {
      const boite = ref.current;
      if (!boite || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, mobile: MOBILE_QUERY }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        const mobile = Boolean(ctx.conditions?.mobile);
        gsap.fromTo(
          boite,
          { y: mobile ? 22 : 14, scale: mobile ? 1 : 0.975, opacity: 0.02 },
          { y: 0, scale: 1, opacity: 1, duration: 0.22, ease: 'power3.out', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div className="modal-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitre} ref={ref} tabIndex={-1}>
        <h2 id={idTitre}>{titre}</h2>
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

  useGSAP(
    () => {
      const el = panneauRef.current;
      if (!el || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        gsap.fromTo(
          el,
          { y: 6, opacity: 0.02 },
          { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: panneauRef, dependencies: [valeur], revertOnUpdate: true },
  );

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

  useGSAP(
    () => {
      const el = fillRef.current;
      if (!el || !animee || clamped <= 0 || typeof window === 'undefined') return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_QUERY, motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
        if (ctx.conditions?.reduce) return;
        gsap.fromTo(
          el,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.3, ease: 'power2.out', clearProps: 'transform' },
        );
      });
      return () => mm.revert();
    },
    { scope: fillRef },
  );

  return (
    <div className="barre" role="progressbar" aria-label={label ?? 'Avancement'} aria-valuenow={pourcent} aria-valuemin={0} aria-valuemax={100}>
      <div ref={fillRef} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** État vide : une phrase utile et, si possible, l'action suivante. */
export function Vide({ children, icone, action }: { children: ReactNode; icone?: NomIcone; action?: ReactNode }) {
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
          { y: 6, opacity: 0.02 },
          { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out', clearProps: 'transform,opacity' },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="vide">
      {icone && <span className="vide-icone"><Icone nom={icone} taille={20} /></span>}
      <div>{children}</div>
      {action && <div className="vide-action">{action}</div>}
    </div>
  );
}
