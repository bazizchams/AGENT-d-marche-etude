# État de la mise en ligne (16/11/2026)

## Fait (par Claude, via l'API d'administration Supabase)
- Projet Supabase `world-destination` (réf. `vhnqazlyrbqfegpbedgv`, région UE eu-west-1), Postgres 17.
- `supabase/schema.sql` puis `supabase/seed.sql` exécutés : 14 tables, RLS active sur toutes, 43 règles sur les données,
  3 règles sur le stockage, bucket `documents` privé, 25 types de dossiers (24 actifs, Roumanie inactive).
- Authentification : inscriptions libres désactivées, liens magiques valables 30 min, mots de passe ≥ 12 caractères
  (minuscule + majuscule + chiffre), réauthentification exigée pour changer de mot de passe. MFA TOTP disponible.
- Edge Function `inviter-client` déployée (vérification du JWT activée).
- Vérifié de l'extérieur avec la clé publique sans connexion : lecture et écriture refusées sur toutes les tables,
  inscription refusée.
- Version en ligne de l'application testée localement contre ce projet : écran de connexion réel, erreur propre
  pour un compte inconnu.

## Reste à faire
1. ✅ Site publié : https://world-destination.vercel.app (Vercel, projet `world-destination`), en-têtes de sécurité actifs.
2. ✅ Supabase : Site URL + Redirect URLs = https://world-destination.vercel.app ; secret `APP_URL` posé pour `inviter-client`.
3. Créer les 4 comptes du personnel (Authentication › Users › Add user, « Auto Confirm »), puis leur donner
   nom et rôle :
   `update profils set nom = '…', role = 'admin' where email = '…';` (role : 'admin' ou 'agent').
4. Activer la double authentification des administrateurs après leur enrôlement (voir MISE-EN-LIGNE.md, étape 4 bis).
5. Passer en offre Pro avant d'enregistrer de vrais clients (sauvegardes quotidiennes, pas de mise en pause).
