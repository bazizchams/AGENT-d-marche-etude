/**
 * Choix du mode, sans charger la bibliothèque Supabase.
 * - VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY définies → version EN LIGNE (Supabase).
 * - Sinon → mode DÉMONSTRATION (données dans le navigateur), exactement comme avant.
 *
 * La clé « anon » est publique par nature (elle est visible dans le navigateur) :
 * la sécurité repose sur les règles RLS de supabase/schema.sql.
 * Ne JAMAIS mettre ici la clé « service_role ».
 */
const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const MODE_EN_LIGNE = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

/** Nom du bucket Storage privé qui contient les documents des clients. */
export const BUCKET = 'documents';
