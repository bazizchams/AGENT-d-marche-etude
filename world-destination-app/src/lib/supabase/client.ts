/** Client Supabase unique (chargé seulement en mode en ligne). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let instance: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!instance) {
    instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Les jetons d'un lien magique sont lus par synchro.ts (lireJetonsDansAdresse), qui les efface de
        // l'adresse ET de l'historique du navigateur avant d'ouvrir la session.
        detectSessionInUrl: false,
        // « implicit » : le lien fonctionne même s'il est ouvert sur un autre appareil que celui qui l'a demandé
        // (le client demande souvent le lien sur un PC puis l'ouvre sur son téléphone).
        flowType: 'implicit',
        storageKey: 'wd-auth',
      },
    });
  }
  return instance;
}
