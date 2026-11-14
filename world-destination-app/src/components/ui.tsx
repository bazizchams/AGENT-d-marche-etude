import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ErreurMetier } from '../lib/store';
import type { StatutDocument, StatutDossier } from '../lib/types';

/* ---------- Toast ---------- */
type Toast = { texte: string; erreur?: boolean };
let afficherToast: (t: Toast) => void = () => {};

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
  useEffect(() => {
    afficherToast = (x) => {
      setT(x);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setT(null), x.erreur ? 6000 : 3000);
    };
  }, []);
  if (!t) return null;
  return <div className={`toast ${t.erreur ? 'erreur-toast' : ''}`} role="status">{t.texte}</div>;
}

/* ---------- Modale ---------- */
export function Modale({ titre, onFermer, children, large }: { titre: string; onFermer: () => void; children: ReactNode; large?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const premier = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    premier?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); precedent?.focus(); };
  }, [onFermer]);
  return (
    <div className="modal-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
        <h2>{titre}</h2>
        {children}
      </div>
    </div>
  );
}

/* ---------- Badges ---------- */
export const STATUTS_DOC: Record<StatutDocument, { lib: string; cls: string; icone: string }> = {
  manquant: { lib: 'Manquant', cls: 'b-gris', icone: '⬜' },
  envoye: { lib: 'À vérifier', cls: 'b-bleu', icone: '📤' },
  valide: { lib: 'Validé', cls: 'b-vert', icone: '✅' },
  refuse: { lib: 'Refusé', cls: 'b-rouge', icone: '❌' },
};

export function BadgeDoc({ statut }: { statut: StatutDocument }) {
  const s = STATUTS_DOC[statut];
  return <span className={`badge ${s.cls}`}>{s.icone} {s.lib}</span>;
}

export function BadgeDossier({ statut }: { statut: StatutDossier }) {
  const m = { en_cours: ['En cours', 'b-bleu'], termine: ['Terminé', 'b-vert'], annule: ['Annulé', 'b-gris'] }[statut];
  return <span className={`badge ${m[1]}`}>{m[0]}</span>;
}

export function Barre({ pourcent }: { pourcent: number }) {
  return <div className="barre" role="progressbar" aria-valuenow={pourcent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pourcent}%` }} /></div>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <div className="vide">{children}</div>;
}
