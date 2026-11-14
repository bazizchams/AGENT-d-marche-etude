// Edge Function « inviter-client » (Deno, exécutée sur les serveurs Supabase).
//
// Crée le compte de l'espace client et envoie l'e-mail d'invitation (lien magique), puis relie
// ce compte à la fiche client. La clé « service_role » n'existe QUE ici, côté serveur :
// Supabase la fournit automatiquement à la fonction (variable SUPABASE_SERVICE_ROLE_KEY).
//
// Appel (depuis l'application, par un membre du personnel connecté) :
//   POST /functions/v1/inviter-client   { clientId, qui?: 'client' | 'suivi', redirectTo?: string }
// Réponse : { email, dejaExistant }   ou   { erreur: "message lisible" }
//
// Déploiement : voir docs/MISE-EN-LIGNE.md (étape « Invitations des clients »).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return repondre({ erreur: 'Méthode non autorisée.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jeton = req.headers.get('Authorization') ?? '';

  // 1. Qui appelle ? Seul un membre ACTIF du personnel peut inviter.
  const appelant = createClient(url, anon, { global: { headers: { Authorization: jeton } }, auth: { persistSession: false } });
  const { data: u, error: errU } = await appelant.auth.getUser();
  if (errU || !u?.user) return repondre({ erreur: 'Connectez-vous pour inviter un client.' }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profil } = await admin.from('profils').select('role, actif').eq('id', u.user.id).maybeSingle();
  if (!profil?.actif || !['admin', 'agent'].includes(profil.role)) {
    return repondre({ erreur: 'Seul le personnel de l’agence peut inviter un client.' }, 403);
  }

  // 2. Fiche client et adresse à inviter.
  let corps: { clientId?: string; qui?: string; redirectTo?: string };
  try { corps = await req.json(); } catch { return repondre({ erreur: 'Requête invalide.' }, 400); }
  const qui = corps.qui === 'suivi' ? 'suivi' : 'client';
  if (!corps.clientId) return repondre({ erreur: 'Client non précisé.' }, 400);

  const { data: client } = await admin.from('clients')
    .select('id, nom, prenom, email, contact_suivi').eq('id', corps.clientId).maybeSingle();
  if (!client) return repondre({ erreur: 'Client introuvable.' }, 404);

  const email = String(qui === 'suivi' ? client.contact_suivi?.email ?? '' : client.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return repondre({ erreur: qui === 'suivi'
      ? 'Renseignez d’abord l’e-mail de la personne qui suit le dossier.'
      : 'Renseignez d’abord l’e-mail du client dans sa fiche.' }, 400);
  }
  const nom = qui === 'suivi' ? String(client.contact_suivi?.nom ?? '') : `${client.prenom} ${client.nom}`;
  const redirectTo = corps.redirectTo || undefined; // doit figurer dans Authentication › URL Configuration

  // 3. Invitation (nouveau compte) ou simple lien magique (compte déjà existant).
  let userId: string | undefined;
  let dejaExistant = false;
  const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nom } });
  if (!inv.error) {
    userId = inv.data.user?.id;
  } else if (/already|registered|exists/i.test(inv.error.message)) {
    dejaExistant = true;
    // Retrouver le compte existant (sans envoyer d'e-mail)…
    const lien = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    userId = lien.data?.user?.id;
    // … puis lui envoyer un lien de connexion classique.
    const envoi = await createClient(url, anon, { auth: { persistSession: false } })
      .auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (envoi.error) console.error('Envoi du lien magique :', envoi.error.message);
  } else {
    console.error('Invitation :', inv.error.message);
    return repondre({ erreur: "L'invitation n'a pas pu être envoyée. Réessayez dans une minute." }, 500);
  }
  if (!userId) return repondre({ erreur: 'Compte introuvable après invitation.' }, 500);

  // Ne jamais relier un compte du personnel à une fiche client.
  const { data: p2 } = await admin.from('profils').select('role').eq('id', userId).maybeSingle();
  if (p2 && p2.role !== 'client') return repondre({ erreur: 'Cette adresse appartient à un compte du personnel.' }, 400);

  // 4. Relier le compte à la fiche client (le client ne verra que ses dossiers, grâce aux règles RLS).
  const colonne = qui === 'suivi' ? 'compte_suivi_id' : 'compte_id';
  const { error: errMaj } = await admin.from('clients').update({ [colonne]: userId }).eq('id', client.id);
  if (errMaj) return repondre({ erreur: 'Compte créé mais non relié à la fiche. Réessayez.' }, 500);

  return repondre({ email, dejaExistant });
});
