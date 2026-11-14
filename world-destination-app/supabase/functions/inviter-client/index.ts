// Edge Function « inviter-client » (Deno, exécutée sur les serveurs Supabase).
//
// Crée le compte de l'espace client et envoie l'e-mail d'invitation (lien magique), puis relie
// ce compte à la fiche client. La clé « service_role » n'existe QUE ici, côté serveur :
// Supabase la fournit automatiquement à la fonction (variable SUPABASE_SERVICE_ROLE_KEY).
//
// Appel (depuis l'application, par un membre du personnel connecté) :
//   POST /functions/v1/inviter-client   { clientId, qui?: 'client' | 'suivi' }
// Réponse : { email, dejaExistant }   ou   { erreur: "message lisible" }
//
// Sécurité :
//   * l'adresse de retour du lien vient UNIQUEMENT du secret APP_URL de la fonction (jamais du navigateur) ;
//   * une adresse qui a déjà accès à un AUTRE client est refusée (409) : pas d'accès croisé par faute de frappe ;
//   * un compte déjà relié à cette fiche n'est jamais remplacé en silence (409) ;
//   * l'accès du parent exige le consentement écrit du titulaire (clients.consentement_suivi_le) ;
//   * chaque invitation est inscrite au journal (interne) de tous les dossiers du client.
//
// Déploiement : voir docs/MISE-EN-LIGNE.md (étape 5). Secret à définir : APP_URL = adresse exacte du site.
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
  const appUrl = (Deno.env.get('APP_URL') ?? '').trim();
  if (!/^https:\/\/[^/]+/.test(appUrl)) {
    return repondre({ erreur: "Configuration incomplète : le secret APP_URL de la fonction n'est pas défini (voir le guide de mise en ligne)." }, 500);
  }
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
  let corps: { clientId?: string; qui?: string };
  try { corps = await req.json(); } catch { return repondre({ erreur: 'Requête invalide.' }, 400); }
  const qui = corps.qui === 'suivi' ? 'suivi' : 'client';
  if (!corps.clientId) return repondre({ erreur: 'Client non précisé.' }, 400);

  const { data: client } = await admin.from('clients')
    .select('id, nom, prenom, email, contact_suivi, compte_id, compte_suivi_id, consentement_suivi_le').eq('id', corps.clientId).maybeSingle();
  if (!client) return repondre({ erreur: 'Client introuvable.' }, 404);
  if (qui === 'suivi' && !client.consentement_suivi_le) {
    return repondre({ erreur: "Enregistrez d'abord le consentement écrit du titulaire pour l'accès de la personne qui suit le dossier." }, 400);
  }

  const email = String(qui === 'suivi' ? client.contact_suivi?.email ?? '' : client.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return repondre({ erreur: qui === 'suivi'
      ? 'Renseignez d’abord l’e-mail de la personne qui suit le dossier.'
      : 'Renseignez d’abord l’e-mail du client dans sa fiche.' }, 400);
  }
  const nom = qui === 'suivi' ? String(client.contact_suivi?.nom ?? '') : `${client.prenom} ${client.nom}`;
  const redirectTo = appUrl; // seule adresse autorisée ; doit aussi figurer dans Authentication › URL Configuration
  const colonne = qui === 'suivi' ? 'compte_suivi_id' : 'compte_id';
  const actuel: string | null = client[colonne] ?? null;

  // 3. Compte existant ? (recherche par e-mail dans les profils, sans créer de lien de connexion)
  const { data: existant } = await admin.from('profils').select('id, role').eq('email', email).maybeSingle();
  if (existant && existant.role !== 'client') {
    return repondre({ erreur: 'Cette adresse appartient à un compte du personnel.' }, 400);
  }
  if (existant) {
    const { data: autres } = await admin.from('clients').select('id')
      .or(`compte_id.eq.${existant.id},compte_suivi_id.eq.${existant.id}`).neq('id', client.id);
    if (autres && autres.length > 0) {
      return repondre({ erreur: "Cette adresse a déjà accès à un AUTRE client. Vérifiez l'e-mail ; en cas de besoin réel (parent de deux enfants), un administrateur relie le compte dans Supabase." }, 409);
    }
  }
  if (actuel && actuel !== existant?.id) {
    return repondre({ erreur: "Cette fiche est déjà reliée à un autre compte. Un administrateur doit d'abord retirer l'ancien accès." }, 409);
  }

  // 4. Invitation (nouveau compte) ou simple lien de connexion (compte déjà existant).
  let userId = existant?.id as string | undefined;
  const dejaExistant = !!existant;
  if (!existant) {
    const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nom } });
    if (inv.error) {
      console.error('Invitation :', inv.error.message);
      return repondre({ erreur: "L'invitation n'a pas pu être envoyée. Réessayez dans une minute." }, 500);
    }
    userId = inv.data.user?.id;
  } else {
    const envoi = await createClient(url, anon, { auth: { persistSession: false } })
      .auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (envoi.error) {
      console.error('Envoi du lien magique :', envoi.error.message);
      return repondre({ erreur: "Le lien n'a pas pu être envoyé. Réessayez dans une minute." }, 500);
    }
  }
  if (!userId) return repondre({ erreur: 'Compte introuvable après invitation.' }, 500);

  // 5. Relier le compte à la fiche client (le client ne verra que ses dossiers, grâce aux règles RLS).
  if (actuel !== userId) {
    const { error: errMaj } = await admin.from('clients').update({ [colonne]: userId }).eq('id', client.id);
    if (errMaj) return repondre({ erreur: 'Compte créé mais non relié à la fiche. Réessayez.' }, 500);
  }

  // 6. Trace dans le journal interne de chaque dossier du client (auteur = membre du personnel qui invite).
  const { data: dossiers } = await admin.from('dossiers').select('id').eq('client_id', client.id);
  if (dossiers?.length) {
    await admin.from('journal').insert(dossiers.map((d: { id: string }) => ({
      dossier_id: d.id, par: u.user.id, type: 'message', interne: true,
      texte: `Accès à l'espace client envoyé à ${email} (${qui === 'suivi' ? 'personne qui suit le dossier' : 'titulaire'})`,
    })));
  }

  return repondre({ email, dejaExistant });
});
