/**
 * Stockage des fichiers téléversés.
 * Mode démonstration : IndexedDB du navigateur.
 * Version en ligne (variables VITE_SUPABASE_* définies) : bucket privé Supabase « documents »,
 * lecture par URL signée (voir src/lib/supabase/fichiers.ts). Même interface dans les deux cas.
 */
import { uid } from './regles';
import { MODE_EN_LIGNE } from './supabase/config';

const DB = 'wd-fichiers';
const STORE = 'fichiers';

const enLigne = () => import('./supabase/fichiers');

/**
 * Identifiant du fichier d'un document.
 * En ligne, c'est son chemin dans le bucket (<dossier_id>/<id>.<ext>), exigé par les règles d'accès.
 */
export function idFichier(dossierId: string, fichier: { name: string }): string {
  if (!MODE_EN_LIGNE) return uid();
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(fichier.name)?.[1] ?? 'bin').toLowerCase();
  return `${dossierId}/${uid()}.${ext}`;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enregistrerFichier(id: string, fichier: Blob): Promise<void> {
  if (MODE_EN_LIGNE) return (await enLigne()).televerser(id, fichier);
  const db = await ouvrir();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(fichier, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function lireFichier(id: string): Promise<Blob | undefined> {
  if (MODE_EN_LIGNE) return (await enLigne()).telecharger(id);
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function ouvrirFichier(id: string) {
  if (MODE_EN_LIGNE) {
    // La fenêtre est ouverte tout de suite (sinon le navigateur la bloque), puis reçoit l'URL signée.
    const fenetre = window.open('about:blank', '_blank');
    try {
      const url = await (await enLigne()).urlSignee(id);
      if (fenetre) fenetre.location.href = url; else window.location.assign(url);
    } catch {
      fenetre?.close();
      alert("Ce fichier n'est pas accessible. Vérifiez la connexion Internet.");
    }
    return;
  }
  const blob = await lireFichier(id);
  if (!blob) {
    alert("Ce fichier n'est pas disponible sur cet appareil (données de démonstration).");
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo
export const TYPES_ACCEPTES = 'application/pdf,image/*';
