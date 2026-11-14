/**
 * Stockage des fichiers téléversés.
 * Mode démonstration : IndexedDB du navigateur.
 * En production, ce module sera remplacé par le stockage sécurisé Supabase (même interface).
 */
const DB = 'wd-fichiers';
const STORE = 'fichiers';

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enregistrerFichier(id: string, fichier: Blob): Promise<void> {
  const db = await ouvrir();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(fichier, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function lireFichier(id: string): Promise<Blob | undefined> {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function ouvrirFichier(id: string) {
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
