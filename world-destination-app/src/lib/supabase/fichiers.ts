/**
 * Fichiers en ligne : bucket privé « documents » de Supabase Storage.
 * Chemin = <dossier_id>/<identifiant>.<extension> (les règles d'accès se basent sur le 1er dossier du chemin).
 * Lecture uniquement par URL signée valable 2 minutes : aucun lien public permanent.
 */
import { supabase } from './client';
import { BUCKET } from './config';

export async function televerser(chemin: string, fichier: Blob): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).upload(chemin, fichier, {
    contentType: fichier.type || 'application/octet-stream',
    upsert: false,
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(/size|exceeded|too large/i.test(error.message)
      ? 'Fichier trop volumineux (10 Mo maximum).'
      : /mime|type/i.test(error.message) ? 'Format refusé : envoyez un PDF ou une photo.'
      : "L'envoi du fichier a échoué. Vérifiez la connexion et réessayez.");
  }
}

export async function urlSignee(chemin: string, secondes = 120): Promise<string> {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(chemin, secondes);
  if (error || !data) throw new Error("Ce fichier n'est pas accessible.");
  return data.signedUrl;
}

export async function telecharger(chemin: string): Promise<Blob | undefined> {
  const { data, error } = await supabase().storage.from(BUCKET).download(chemin);
  if (error) return undefined;
  return data;
}
