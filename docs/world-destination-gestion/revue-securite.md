# Revue sécurité et données personnelles : World Destination (gestion des dossiers)

Revue en lecture seule, menée le 14/11/2026. Aucun fichier du dépôt n'a été modifié.

## Ce qui a été relu

| Fichier | Version relue |
|---|---|
| `supabase/schema.sql` | v0 (05:00, 142 lignes), puis **v1 (05:41, 689 lignes, réécrit par l'agent backend)** |
| `supabase/seed.sql`, `supabase/generer-seed.mjs` | 05:40 |
| `src/lib/supabase/{client,config,correspondance,fichiers,synchro}.ts` | 05:42–05:44 |
| `src/lib/fichiers.ts` (mode démo et mode en ligne) | 05:44 |
| `src/lib/store.ts`, `src/App.tsx`, `src/pages/*.tsx`, `src/lib/messages.ts`, `public/sw.js`, `.gitignore` | dernière version |
| `supabase/functions/inviter-client/index.ts` | 05:47 (apparu en toute fin de revue, relu intégralement : voir E-4) |
| `src/lib/supabase/EcranConnexion.tsx`, `correspondance.test.ts` | 05:45–05:46 (lecture rapide) |

Les numéros de ligne renvoient à la v1 de `schema.sql`. L'agent backend travaillait encore à 05:48 : il faudra relire les fichiers modifiés après cette heure.

**Délégation** : la consigne permettait de confier des sous-tâches à des sous-agents, mais aucun outil « Agent » n'était disponible dans cette session. Rien n'a donc été délégué : toute la revue (RLS table par table, recherche de rendus non échappés et de secrets dans `src/`, recherche juridique 18-07/ANPDP) a été faite et vérifiée directement.

## Points positifs de la v1 (à garder)

La v1 corrige presque tous les défauts graves de la v0 :
- **Fonctions `security definer`** : toutes ont un `set search_path = public`. Les fonctions sensibles (`prochain_numero`, `journaliser`) ne peuvent pas être appelées par `anon` ni par `authenticated`.
- **Policies** : toutes sont écrites `to authenticated`, sans aucun `for all`. Tous les droits de `anon` sont retirés (l. 564).
- **Paiements** :
  - un trigger interdit la suppression (`DELETE` levé, l. 467) ;
  - le serveur impose le numéro de reçu, la date et l'auteur ;
  - le montant est plafonné au reste à payer, avec un verrou `for update` ;
  - la devise est vérifiée et la cible doit appartenir au dossier ;
  - en modification, seule l'annulation est permise : une seule fois, par un admin, avec motif (l. 496-513).
- **Journal** : il est en ajout seul (droits `update`/`delete` retirés). Un trigger impose l'auteur et la date. Les triggers serveur l'alimentent pour les documents, les paiements, les étapes, les statuts et les rendez-vous.
- **Document envoyé par le client** :
  - seuls les champs du fichier peuvent changer (diff JSONB, l. 339) ;
  - le statut ne peut passer que de manquant/refusé à `envoye` ;
  - le chemin doit commencer par `<dossier_id>/` ;
  - le `with check` de la policy revérifie `mes_dossiers()`.
- **Étapes** : un trigger refuse de valider une étape tant que ses frais ne sont pas payés à 100 %.
- **Bucket `documents`** :
  - il est privé ;
  - il est limité à 10 Mo ;
  - il accepte une liste fermée de types MIME, sans SVG ni HTML ;
  - le client ne peut ni écraser ni supprimer un fichier ;
  - les URL signées durent 2 minutes (`src/lib/supabase/fichiers.ts:23`).
- **Côté navigateur** : seule la clé `anon` est présente, et un commentaire interdit d'y mettre la clé `service_role` (`config.ts`). Le lien magique est envoyé avec `shouldCreateUser: false` (`synchro.ts:255`).
- **XSS** : React échappe tout, et il n'y a aucun `dangerouslySetInnerHTML`. Les motifs, notes et noms sont affichés en texte.

---

## CRITIQUE

### C-1. Le mode démonstration ne doit jamais recevoir de vraies données
- **Où** :
  - `src/pages/Connexion.tsx` : connexion par simple choix d'un utilisateur, sans mot de passe ;
  - `src/lib/store.ts:105-117` : base et session dans `localStorage` ;
  - `src/lib/fichiers.ts:34-43` : fichiers dans IndexedDB, en clair ;
  - `src/App.tsx` : `#/espace/:id` est servi sans aucun contrôle.
- **Scénario** : l'agence installe la PWA de démo (déjà fonctionnelle et « installable ») et commence à saisir de vrais clients en attendant la version en ligne. Toute personne qui s'assoit au PC voit alors tous les passeports, casiers et examens médicaux, et peut se déclarer « Administrateur ». Le rôle se modifie aussi dans le stockage local en deux clics avec les outils de développement. Les documents restent sur le PC, ce qui contredit le cahier des charges (§5 : « aucun dossier n'est conservé sur le PC »).
- **Correctif** :
  - En production, refuser de démarrer en mode démo, ou afficher un bandeau rouge permanent « Données fictives uniquement ».
  - Ne publier le mode démo que sur une URL distincte.

```ts
// main.tsx (ou config.ts)
if (import.meta.env.PROD && !MODE_EN_LIGNE && location.hostname !== 'demo.<domaine>') {
  document.body.innerHTML = 'Configuration manquante : version en ligne non configurée.';
  throw new Error('Mode démo interdit en production');
}
```

> En v1, il n'y a plus de faille SQL critique au sens strict. Les points ci-dessous viennent surtout d'un **agent malveillant ou d'un compte d'agent volé**. C'est le risque principal d'une petite agence qui manipule des passeports.

---

## ÉLEVÉ

### E-1. Un agent peut détourner l'accès à l'espace client et exfiltrer les documents, sans trace
- **Où** :
  - `schema.sql:598` : `clients_personnel_maj` laisse modifier toutes les colonnes ;
  - aucun trigger ne journalise ni ne protège `clients`.
- **Scénario** :
  1. Un agent (ou quelqu'un qui a volé sa session) écrit `update clients set compte_suivi_id = '<uuid de son compte perso>'`, ou change `email` puis déclenche une invitation.
  2. Son compte « client » lit alors à vie, via `mes_dossiers()` et la policy storage l. 657-661, les passeports et relevés de ce client. Cet accès survit même à la désactivation de son profil d'agent.
  3. Rien n'apparaît au journal, car aucun trigger ne couvre `clients`.
- Il en va de même pour `dossiers.client_id` (l. 605) : déplacer un dossier vers un autre client expose ses pièces au compte de cet autre client.
- **Correctif** :

```sql
create or replace function tg_clients_garde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null then
    if (new.compte_id is distinct from old.compte_id or new.compte_suivi_id is distinct from old.compte_suivi_id)
       and not est_admin() and current_setting('wd.invitation', true) is distinct from 'oui' then
      raise exception 'Seul un administrateur (ou l''invitation officielle) peut relier un compte.';
    end if;
  end if;
  -- traçabilité de toute modification d'identité / contact / accès
  if tg_op = 'UPDATE' and (new.email, new.telephone, new.compte_id, new.compte_suivi_id, new.contact_suivi)
       is distinct from (old.email, old.telephone, old.compte_id, old.compte_suivi_id, old.contact_suivi) then
    insert into journal (dossier_id, par, type, texte, interne)
      select d.id, auth.uid(), 'statut', 'Coordonnées / accès du client modifiés', true from dossiers d where d.client_id = new.id;
  end if;
  return new;
end $$;
create trigger clients_garde before update on clients for each row execute function tg_clients_garde();

-- dossiers : client_id immuable
-- dans tg_dossiers_avant :  elsif new.client_id <> old.client_id then raise exception 'Le client d''un dossier ne peut pas changer.';
```

  Le plus simple : ne faire écrire `compte_id` et `compte_suivi_id` que par l'Edge Function `inviter-client`, qui utilise la clé service.

### E-2. Montants et règles « frais payés d'avance » contournables par un agent, sans journal
- **Où** :
  - `schema.sql:622` et `:630` : `frais_personnel_maj` et `echeances_personnel_maj` laissent modifier `montant` et `devise` ;
  - `schema.sql:626` : `etapes_personnel_maj` laisse modifier `frais_requis`.
- **Scénario** :
  - Un agent ramène l'échéance « honoraires 50 % fin » à 0, ou réduit un frais avant d'encaisser moins en espèces. Le client paraît « à jour » et l'écart disparaît de la caisse.
  - Autre variante : il vide `frais_requis` pour valider une étape non payée. Le cahier des charges réserve pourtant les tarifs à l'administrateur.
- **Correctif** :

```sql
create or replace function tg_montants_garde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not est_admin() and
     (to_jsonb(new) - array['verse','verse_le','verse_par','faite','faite_le','faite_par','ordre','nom','nom_ar','organisme'])
     is distinct from
     (to_jsonb(old) - array['verse','verse_le','verse_par','faite','faite_le','faite_par','ordre','nom','nom_ar','organisme']) then
    raise exception 'Montants, devises et frais requis : modification réservée à un administrateur.';
  end if;
  return new;
end $$;
create trigger frais_garde     before update on frais     for each row execute function tg_montants_garde();
create trigger echeances_garde before update on echeances for each row execute function tg_montants_garde();
create trigger etapes_garde    before update on etapes    for each row execute function tg_montants_garde();
```

  Il faut aussi journaliser (en interne) toute modification de montant faite par un admin.

### E-3. La suppression d'un dossier par un admin efface le journal et laisse les fichiers orphelins
- **Où** :
  - `schema.sql:606` : `dossiers_admin_suppr` ;
  - `:99, :116, :130, :143, :169` : `on delete cascade`, y compris sur `journal` ;
  - `:613` : `documents_admin_suppr` ;
  - aucune suppression des objets Storage.
- **Scénario** : un admin supprime un dossier sans paiement. Les cascades effacent le journal, ce qui contredit le principe affiché « le journal ne peut être ni effacé » (l. 15), car les cascades contournent RLS et les droits. Les passeports restent pour toujours dans le bucket, sans ligne qui les référence : la durée de conservation n'est pas maîtrisée (loi 18-07).
- **Correctif** :
  - Ne pas supprimer : annuler, puis « purger » via une fonction dédiée.
  - Passer `journal.dossier_id` en `on delete restrict`.

```sql
drop policy dossiers_admin_suppr on dossiers;
drop policy documents_admin_suppr on documents;
alter table journal drop constraint journal_dossier_id_fkey,
  add constraint journal_dossier_id_fkey foreign key (dossier_id) references dossiers on delete restrict;
-- Purge RGPD/18-07 : fonction admin qui supprime les OBJETS storage du dossier,
-- vide chemin_fichier/nom_fichier, anonymise le client (hors données comptables) et journalise « purge ».
```

  La suppression des objets passe par l'API Storage (Edge Function admin) ou par `delete from storage.objects where bucket_id='documents' and name like '<id>/%'`.

### E-4. Edge Function `inviter-client` : redirection fournie par le navigateur, invitation non tracée, reliaison silencieuse
- **Où** : `supabase/functions/inviter-client/index.ts`.
- **Ce qui est bien fait** :
  - l'appelant est vérifié par son JWT (`getUser`, l. 34) puis par son profil actif admin ou agent (l. 38-41) ;
  - la clé `service_role` vient de l'environnement de la fonction, jamais du navigateur ;
  - un compte du personnel ne peut pas être relié à une fiche client (l. 84-85).
- **Problèmes** :
  1. **l. 60 et 65 : `redirectTo` vient du corps de la requête.** Avec `flowType: 'implicit'` (`client.ts:17`), la session du client (`#access_token=…`) est envoyée à cette URL. La seule protection est la liste « Redirect URLs » de Supabase. Si elle contient un joker (`https://*.netlify.app/**`, `**`) ou un domaine de test, un agent malveillant (ou un compte d'agent volé) envoie au client une invitation authentique de l'agence qui livre sa session à un site tiers. **Correctif** : ignorer `corps.redirectTo` et lire une origine fixe (`Deno.env.get('APP_URL')`). Dans Supabase › Auth › URL Configuration, ne garder que l'URL de production exacte.
  2. **l. 89 : écrasement silencieux** de `compte_id` ou `compte_suivi_id`. Un nouveau compte remplace l'ancien sans trace ni confirmation, ce qui complète E-1. Si l'adresse appartient déjà à un **autre client** (l. 68-72, `dejaExistant`), ce compte voit désormais aussi ce dossier. Une faute de frappe dans l'e-mail suffit donc à exposer un passeport à un tiers.
  3. **Aucune ligne de journal** pour l'invitation : qui a invité, quelle adresse, compte titulaire ou de suivi.
  4. l. 71 : `generateLink` crée un lien magique valide qui sert seulement à retrouver l'identifiant. Il n'est pas divulgué, mais `admin.auth.admin.listUsers` filtré ou une RPC sur `profils.email` serait plus propre (Faible).
  5. l. 15 : CORS `*`. C'est acceptable parce qu'un JWT porteur est exigé (Faible).
- **Correctif (extrait)** :

```ts
const ORIGINE = Deno.env.get('APP_URL')!;               // https://gestion.<domaine>/  (secret de la fonction)
const redirectTo = ORIGINE;                             // jamais corps.redirectTo
// Refuser de relier un compte déjà relié à un AUTRE client, sauf confirmation explicite
const { data: autres } = await admin.from('clients').select('id')
  .or(`compte_id.eq.${userId},compte_suivi_id.eq.${userId}`).neq('id', client.id);
if (autres?.length && !corps.confirmerPartage) return repondre({ erreur: 'Cette adresse a déjà accès à un autre client. Confirmez.' }, 409);
// Tracer
const { data: ds } = await admin.from('dossiers').select('id').eq('client_id', client.id);
if (ds?.length) await admin.from('journal').insert(ds.map((d) => ({ dossier_id: d.id, par: u.user.id, type: 'message',
  texte: `Accès à l'espace client envoyé à ${email} (${qui === 'suivi' ? 'personne qui suit' : 'titulaire'})`, interne: true })));
```

  Note : avec la clé service, `auth.uid()` est nul, donc le trigger `tg_journal_avant` conserve `par` tel qu'il est fourni (c'est voulu ici).

### E-6. Énumération des clients de l'agence par l'écran de connexion
- **Où** : `src/lib/supabase/synchro.ts:258-259`, qui affiche « Aucun compte n'existe pour cette adresse. Contactez l'agence. », et `EcranConnexion.tsx` (formulaire public).
- **Scénario** : n'importe qui (employeur, ex-conjoint, voisin) saisit une adresse e-mail et apprend si cette personne est cliente d'une agence d'immigration et de visas. C'est une information personnelle sensible en soi (projet d'émigration).
- **Correctif** : afficher toujours le même message, « Si cette adresse est connue de l'agence, un lien vient d'être envoyé. », et garder la limitation de débit de Supabase.

### E-5. Comptes du personnel protégés par un simple mot de passe
- **Où** : `synchro.ts:246` (`signInWithPassword`). Aucun MFA, aucune règle de mot de passe.
- **Scénario** : hameçonnage ou mot de passe réutilisé sur un compte admin. L'attaquant accède alors à tous les dossiers et peut annuler des paiements.
- **Correctif** (proportionné à 4 comptes) :
  - activer le MFA TOTP de Supabase pour les admins, et idéalement pour les agents ;
  - exiger `aal2` dans les fonctions d'accès ;
  - fixer une longueur minimale de 12 caractères ;
  - activer la « leaked password protection » (offre Pro).

```sql
create or replace function est_personnel() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin','agent') from profils where id = auth.uid() and actif), false)
          and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' $$;
```

  À faire d'abord pour `est_admin()` seulement, si le MFA des agents paraît trop lourd.

---

## MOYEN

### M-1. Un agent voit la caisse globale via l'API
- **Où** : `schema.sql:635`. `paiements_lire` donne `est_personnel()` sur **tous** les paiements, et `:640` ouvre aussi le journal entier.
- **Scénario** : la page Caisse est cachée par l'interface (`App.tsx`, `admin: true`), mais un agent qui exécute `supabase.from('paiements').select('montant,devise,date')` dans la console du navigateur obtient le chiffre d'affaires. Le cahier des charges l'interdit (§3, §11 : « montants visibles par les administrateurs seulement »). `synchro.ts:69` charge d'ailleurs déjà **toutes** les tables dans le navigateur de l'agent.
- **Correctif proportionné** : limiter l'agent aux dossiers qu'il suit, plus les paiements qu'il a lui-même encaissés.

```sql
drop policy paiements_lire on paiements;
create policy paiements_lire on paiements for select to authenticated using (
  est_admin()
  or (est_personnel() and (par = auth.uid() or dossier_id in (select id from dossiers where agent_id = auth.uid())))
  or dossier_id in (select mes_dossiers()));
```

  Sinon, accepter et documenter le risque, car les deux agents encaissent sur tous les dossiers.

### M-2. `total_paye()` peut être appelée par n'importe quel compte connecté, y compris un client
- **Où** : `schema.sql:247`. Le `revoke` vise seulement `public` et `anon`.
- **Scénario** : un client fait `rpc('total_paye', {p_type:'frais', p_cible:'<uuid>'})`. Il obtient la somme payée par un autre client s'il connaît l'UUID (difficile à deviner, mais ces UUID circulent dans les URL et les reçus).
- **Correctif** :

```sql
revoke execute on function total_paye(text, uuid) from authenticated;
```

  La fonction reste appelée par les triggers `security definer`.

### M-3. Entrées de journal forgées, visibles par le client
- **Où** : `schema.sql:641`. `journal_personnel_ajout` accepte tout `type` et `interne = false`.
- **Scénario** : un agent insère `type='paiement', texte='Encaissement 120 000 DA (reçu R-2026-00042)', interne=false`. Le client voit un faux encaissement dans « Ce qui a été fait ». L'auteur est bien imposé par le serveur, donc le faux est attribuable, mais il reste trompeur.
- **Correctif** :

```sql
drop policy journal_personnel_ajout on journal;
create policy journal_personnel_ajout on journal for insert to authenticated
  with check (est_personnel() and type in ('note','message'));
```

### M-4. Fichiers : écrasement sans trace et aucun journal des consultations
- **Où** :
  - `schema.sql:667-668` : `wd_documents_personnel_maj` permet de remplacer un fichier existant (upsert) sans changer la ligne `documents`, donc sans trace ;
  - aucun journal des téléchargements ou des URL signées.
- **Scénario** :
  - Un agent remplace un relevé bancaire validé par un autre fichier.
  - Une fuite de documents ne peut pas être attribuée, alors que la loi 25-11 demande de pouvoir tracer les accès aux données.
- **Correctif** :
  - supprimer la policy `update` du storage (le chemin contient un UUID neuf à chaque envoi, `fichiers.ts:22`, donc l'écrasement est inutile) ;
  - tracer les consultations : passer `urlSignee` par une RPC qui écrit dans une table `acces_documents`.

```sql
drop policy wd_documents_personnel_maj on storage.objects;

create table acces_documents (id bigserial primary key, le timestamptz default now(), par uuid default auth.uid(),
  document_id uuid references documents on delete set null, chemin text);
alter table acces_documents enable row level security;
create policy acces_lire on acces_documents for select to authenticated using (est_admin());
create or replace function tracer_acces(p_doc uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_chemin text;
begin
  select chemin_fichier into v_chemin from documents
   where id = p_doc and (est_personnel() or dossier_id in (select mes_dossiers()));
  if v_chemin is null then raise exception 'Accès refusé'; end if;
  insert into acces_documents (document_id, chemin) values (p_doc, v_chemin);
  return v_chemin;
end $$;
-- côté navigateur : const chemin = await rpc('tracer_acces', { p_doc }); puis createSignedUrl(chemin, 120)
```

  Version la plus simple : n'activer ce suivi que pour les consultations par le personnel.

### M-5. Inscription libre et lien magique
- Supabase › Auth › **désactiver « Allow new users to sign up »**. `shouldCreateUser: false` (`synchro.ts:255`) n'est qu'un réglage du navigateur : l'API `/signup` reste ouverte tant que l'option est active. Le trigger `tg_nouveau_compte` (l. 259) donne un profil `client` à tout inscrit, qui lit alors `parametres` et `modeles` (les tarifs). Il n'y a pas d'autre fuite.
- Réduire la durée de validité de l'OTP / lien magique (Auth › Email, ≤ 1 h, idéalement 15-30 min).
- Le QR code du reçu (`Recu.tsx`) et les liens WhatsApp (`messages.ts:81`) doivent continuer à pointer vers `#/espace/<id>` **sans jeton**. Un lien magique imprimé ou transféré sur WhatsApp donnerait accès au dossier à n'importe qui. C'est bien le cas aujourd'hui, à conserver.
- `#/espace/:id` (`App.tsx`) :
  - en ligne, l'ID seul ne donne rien, car les données viennent de RLS ;
  - l'écran de connexion client est prévu (`EcranConnexion.tsx`, commentaire l. 7) : vérifier qu'il est bien branché dans `EspaceClient.tsx`.
  - En démo, l'ID donne tout (voir C-1). Hors contexte sécurisé, `uid()` (`regles.ts:6`) retombe sur `Math.random()` : servir uniquement en HTTPS.

### M-6. `.gitignore` ne protège pas les fichiers `.env`
- **Où** : `.gitignore` ne contient que `node_modules`, `dist`, `*.tsbuildinfo`.
- **Scénario** : quelqu'un crée `.env` ou `.env.local` avec, par erreur, la clé `service_role` à côté des `VITE_*`, puis lance `git add .`. La clé est alors publiée, et cette clé contourne toute la RLS.
- **Correctif** :

```gitignore
.env
.env.*
!.env.example
supabase/.temp
supabase/.branches
```

### M-7. Accès du « parent qui suit le dossier » et majorité du titulaire
- **Où** : `clients.compte_suivi_id` (l. 56), `mes_dossiers()` (l. 210), `clients_soi` (l. 600).
- Le parent voit la fiche complète, les documents (y compris examen médical, casier, relevés bancaires) et les paiements de l'étudiant. Si l'étudiant est **majeur**, il faut son consentement écrit avant de donner cet accès (loi 18-07, données sensibles).
- **Correctif** : ajouter une colonne `consentement_suivi_le timestamptz`, exigée par l'Edge Function avant d'inviter un compte de suivi. Envisager aussi de masquer au parent certains documents (santé, casier) avec un indicateur `sensible` dans `documents`.

---

## FAIBLE

| # | Où | Constat | Correctif |
|---|---|---|---|
| F-1 | Droits par défaut Supabase | `authenticated` garde `TRUNCATE`, `REFERENCES` et `TRIGGER` sur les tables. PostgREST n'expose pas ces commandes, mais `TRUNCATE` ignore la RLS. | `revoke truncate, references, trigger on all tables in schema public from anon, authenticated;` |
| F-2 | `schema.sql:342` | `like '<dossier>/%'` laisse passer `<dossier>/../<autre>/x`. Les clés Storage sont littérales, donc ce n'est pas exploitable aujourd'hui. | Ajouter `or new.chemin_fichier ~ '\.\.'` à la condition de refus, et imposer le format `^<uuid>/<uuid>\.[a-z0-9]{1,5}$`. |
| F-3 | `wd_documents_envoyer` l. 662 | Un client peut téléverser un nombre illimité de fichiers dans le dossier de son dossier (10 Mo chacun), ce qui permet de saturer le quota. | Accepter, ou vérifier côté Edge Function. Purger les fichiers non référencés chaque mois. |
| F-4 | `src/lib/fichiers.ts:58` | `window.open('about:blank')` sans `noopener` : l'onglet ouvert garde `window.opener`. | `const f = window.open('about:blank','_blank'); if (f) f.opener = null;` |
| F-5 | `fichiers.ts:73` (démo) | `image/*` accepte le SVG. En démo, `createObjectURL` hérite de l'origine de l'application, donc un SVG piégé s'exécute avec accès au `localStorage`. En ligne, le bucket refuse le SVG (correct). | `TYPES_ACCEPTES = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif'`, contrôle de `f.type` avant envoi et vérification des octets magiques (`%PDF`, `FFD8FF`, `89504E47`). |
| F-6 | `DossierDetail.tsx:525` | `mailto:${cible.email}` n'est pas encodé : un e-mail saisi `x@y.dz?bcc=autre@z` ajoute un destinataire caché. | `mailto:${encodeURIComponent(cible.email)}?…`, plus une validation stricte de l'e-mail à la saisie. |
| F-7 | `messages.ts:75-77` | Correct (numéro réduit aux chiffres, texte encodé). Le message passe par Meta : n'y mettre ni montants détaillés ni données sensibles, seulement le lien. | Ne rien envoyer d'autre que le lien et l'étape. |
| F-8 | `correspondance.ts:79,85` | Le navigateur envoie `cree_le`, `cree_par` (clients) et `ouvert_le` (dossiers), sans contrôle serveur. Un agent peut antidater ou attribuer à un collègue. | Trigger : `new.cree_le := now(); new.cree_par := auth.uid();` et `new.ouvert_le := now()` à l'insertion. |
| F-9 | `tg_paiements_avant` l. 471 | Un encaissement reste possible sur un dossier `annule`. | Si `(select statut from dossiers where id = new.dossier_id) = 'annule'`, lever une erreur. |
| F-10 | `client.ts:17` | `flowType: 'implicit'` : les jetons passent dans le fragment d'URL et restent dans l'historique du navigateur. Les aperçus de lien WhatsApp peuvent aussi consommer un lien à usage unique. Le choix d'ergonomie se défend (lien ouvert sur un autre appareil). | Garder, mais avec la liste de redirections exacte (E-4) et `history.replaceState` après lecture (déjà fait pour `token_hash`, à faire aussi pour `#access_token`). |
| F-11 | Hébergement | Aucun en-tête de sécurité. | Chez l'hébergeur (Netlify, Vercel, Cloudflare) : CSP `default-src 'self'; connect-src 'self' https://<projet>.supabase.co wss://<projet>.supabase.co; img-src 'self' data: blob: https://<projet>.supabase.co; frame-ancestors 'none'`, plus `Referrer-Policy: no-referrer` et `X-Content-Type-Options: nosniff`. |
| F-12 | `public/sw.js` | Il met en cache toute réponse GET de même origine. Pas de souci tant que les données viennent de `supabase.co`, mais ne jamais servir d'API ni de fichiers depuis la même origine. | Limiter le cache aux ressources de l'application (`/assets/*`, `index.html`). |
| F-13 | Temps réel (l. 674-686) | La RLS est bien appliquée aux `postgres_changes`. La table `compteurs` est publiée alors qu'elle est inutile pour les clients. | Facultatif : retirer `compteurs` et `profils` de la publication. |

---

## Ce qui est réellement imposé par le serveur (v1)

| Règle métier | Interface | Serveur (RLS/trigger) |
|---|---|---|
| Un client ne voit que ses dossiers | oui | **oui** (`mes_dossiers`, storage) |
| Un client ne change que l'envoi d'un document | oui | **oui** (trigger l. 334-349) |
| Le client ne peut pas modifier son rôle, ses montants ou le journal | n/a | **oui** (aucune policy d'écriture) |
| Un agent ne supprime ni n'annule un paiement | oui | **oui** (trigger l. 467, 505) |
| Paiements jamais effacés | oui | **oui** (sauf `service_role` et propriétaire de la base) |
| Annulation avec motif | oui | **oui** |
| Agent : pas de caisse globale | oui | **NON** (M-1) |
| Tarifs gérés par l'admin seulement | oui (Paramètres) | **NON** pour les montants copiés dans le dossier (E-2) |
| Journal non effaçable | oui | **partiel** : effacé par la suppression d'un dossier (E-3) |
| Toute action tracée | partiel | **partiel** : fiche client, fichiers et consultations non tracés (E-1, M-4) |

---

## Données personnelles : loi 18-07 modifiée par la loi 25-11

**Réserve sur les sources** : les sites officiels (texte du JO) n'étaient pas joignables depuis cette session. Les points ci-dessous viennent de synthèses de cabinets (Gide, LPA), de la presse algérienne et de blogs spécialisés. Les numéros d'article et les délais signalés « à confirmer » doivent être vérifiés dans le JO n° 34 du 10/06/2018 (loi 18-07) et dans le JO de la loi 25-11 du 24/07/2025, ou auprès de l'ANPDP (anpdp.dz).

### Ce que dit la loi (état vérifié au mieux)
1. **Déclaration préalable** de tout traitement à l'ANPDP, via sa plateforme en ligne (formulaires de déclaration et d'autorisation). L'ANPDP peut soumettre à **autorisation préalable** un traitement présentant des risques manifestes (art. 17 selon les sources).
2. **Données sensibles** : le traitement des données de santé (examens médicaux) est en principe interdit. Il est permis avec un **consentement exprès** de la personne, une disposition légale ou une autorisation de l'ANPDP (art. 18). Le **casier judiciaire** relève des données sur les infractions, au régime restrictif (article exact non vérifié).
3. **Transfert hors d'Algérie** : le régime d'**autorisation préalable de l'ANPDP** s'applique, avec exigence d'un niveau de protection suffisant dans le pays destinataire. C'est le point qui bloque le plus souvent les projets. Héberger sur Supabase en Europe (cahier des charges §2) est **un transfert à l'étranger**.
4. **Loi 25-11 (24/07/2025)** :
   - désignation obligatoire d'un **délégué à la protection des données** (DPD), dont les coordonnées sont communiquées à l'ANPDP ;
   - **registre** des traitements ;
   - **analyse d'impact** pour les traitements à risque élevé ;
   - **notification des violations** à l'ANPDP et aux personnes concernées (art. 41 bis 2 et 41 bis 3, registre des violations art. 43). Le délai est **à confirmer** : « 5 jours » selon une source secondaire, d'autres parlent de 72 h ;
   - pouvoirs renforcés de l'ANPDP.
5. **Droits des personnes** : information préalable (art. 32-33), accès (art. 34), rectification (art. 35), opposition (art. 36). L'ANPDP a ouvert en septembre 2025 un portail de plaintes pour les particuliers.
6. **Sécurité** : obligation de mesures techniques et organisationnelles contre l'accès non autorisé, la perte, l'altération ou la divulgation.
7. **Sanctions** : pénales, jusqu'à 5 ans d'emprisonnement et 500 000 DA d'amende selon un cabinet. Ces montants ont pu changer avec la loi 25-11.

### Obligations et actions pour l'agence (par ordre de priorité)

| # | Action | Qui / quand | Effort |
|---|---|---|---|
| 1 | **Ne pas saisir de vrais clients dans la version de démonstration** (C-1). | Tout de suite | nul |
| 2 | **Désigner un DPD** (un des deux administrateurs suffit pour une petite agence) et déclarer ses coordonnées à l'ANPDP. | Avant la mise en ligne | faible |
| 3 | **Déposer la déclaration du traitement** « gestion des dossiers clients » sur la plateforme ANPDP. Y joindre la **demande d'autorisation** pour les données sensibles (santé, casier) et pour le **transfert vers l'hébergeur en Europe**. Garder l'accusé de réception. | Avant la mise en ligne, avec un juriste | moyen |
| 4 | **Choisir l'hébergement en connaissance de cause** : (a) Supabase UE avec autorisation de transfert, ou (b) un hébergeur en Algérie si l'autorisation tarde ou est refusée. Dans tous les cas, signer le DPA (accord de sous-traitance) de Supabase et choisir la région UE (Francfort ou Paris). | Admin | faible |
| 5 | **Minimiser** : ne stocker le casier judiciaire et l'examen médical que le temps de constituer le dossier, puis supprimer le fichier en gardant seulement le statut « fourni le … ». Ne jamais envoyer de document par WhatsApp. | Paramétrage + routine | faible |
| 6 | **Consentement exprès et écrit** à l'ouverture du dossier (formulaire papier signé, ou case à cocher horodatée dans l'espace client) : finalités, catégories (dont santé et casier), destinataires (ambassades, VFS/TLS, Campus France, employeurs), hébergement à l'étranger, durée de conservation, droits. Recueillir séparément le consentement de l'étudiant majeur pour l'accès d'un parent (M-7). | Modèle FR/AR | faible |
| 7 | **Notice d'information** (art. 32-33) en français et en arabe, affichée dans l'espace client et à l'accueil. | Texte | faible |
| 8 | **Durées de conservation** à fixer et à appliquer :<br>• pièces justificatives (passeport, diplômes, relevés, casier, examens) : **suppression 6 à 12 mois après la clôture** (sauf procédure en cours ou demande du client) ;<br>• paiements, reçus et journal comptable : **10 ans** (obligation comptable, art. 12 du code de commerce, à confirmer avec le comptable), conservés même si le client demande la suppression ;<br>• fiche client : anonymisée à la fin de cette durée.<br>Outil : fonction admin « purger le dossier » (E-3) et rappel mensuel. | Admin + développement | moyen |
| 9 | **Droits des personnes** : une adresse e-mail dédiée (ex. `donnees@…`) et une procédure simple (vérifier l'identité, répondre sous 30 jours, délai interne prudent). L'espace client sert de droit d'accès en lecture. Prévoir un export PDF du dossier. La suppression s'arrête aux données comptables (à expliquer au client). | Admin | faible |
| 10 | **Journalisation des accès** : activer le suivi des consultations de documents (M-4) et relire `acces_documents` une fois par mois. | Développement | moyen |
| 11 | **Sécurité des comptes** : MFA pour les admins (E-5), un compte nominatif par personne, aucun compte partagé, désactivation immédiate au départ d'un employé, clause de confidentialité signée par les agents. | Admin | faible |
| 12 | **Sauvegardes** : le plan gratuit de Supabase ne fournit pas de sauvegardes quotidiennes exploitables et met le projet en pause s'il est inactif. Prendre le plan **Pro (~25 $/mois)**, conforme au budget du cahier des charges. Tester une restauration une fois. | Admin | faible |
| 13 | **Plan en cas de violation** (fuite, vol de PC ou de téléphone, compte compromis) : désactiver le compte, changer les mots de passe, révoquer les sessions (Auth › Users › Sign out), noter l'incident au registre des violations, **prévenir l'ANPDP dans le délai légal (à confirmer, viser au plus tard 72 h)** et prévenir les clients concernés. | Fiche d'une page | faible |
| 14 | **Registre des traitements** : une page avec finalité, catégories de données, personnes concernées, destinataires, transferts, durées, mesures de sécurité. | DPD | faible |
| 15 | **Postes de travail** : vider régulièrement le dossier Téléchargements, verrouiller la session, chiffrer les disques (BitLocker), ne pas garder de scans sur le PC (cahier des charges §5). | Bureau | faible |

### Sources consultées
- [Protection des données à caractère personnel · JO n° 34 du 10 juin 2018 (upgrowth.dz)](https://www.upgrowth.dz/journal-officiel/loi-18-07-protection-donnees-personnelles)
- [Gide : alerte client ANPDP (2023)](https://www.gide.com/sites/default/files/2023-07gide_alerteclient_anpdp_fr_7.pdf)
- [Gide : Protection of personal data, focus on Algerian regulations](https://www.gide.com/en/news-insights/protection-of-personal-data-focus-on-algerian-regulations/)
- [Gide : analysis & trends](https://www.gide.com/en/?p=93297)
- [TSA : Données personnelles, l'Algérie modifie sa législation](https://www.tsa-algerie.com/donnees-personnelles-lalgerie-modifie-sa-legislation-ce-qui-va-changer/)
- [TSA : nouvelle obligation (DPD)](https://www.tsa-algerie.com/protection-de-donnees-personnelles-nouvelle-obligation-en-algerie/)
- [Algérie360 : la loi alignée sur les standards internationaux](https://www.algerie360.com/?p=886858)
- [AllAfrica : loi 25-11, violations, art. 41 bis](https://fr.allafrica.com/stories/202508050266.html)
- [AllAfrica : autorisation d'interconnexion ANPDP](https://fr.allafrica.com/stories/202501290119.html)
- [Radio Algérie : portail numérique ANPDP pour les personnes concernées](https://news.radioalgerie.dz/fr/node/70904)
- [Legal Doctrine : quand les données sensibles peuvent-elles être traitées](https://legal-doctrine.com/edition/dans-quels-cas-les-donnees-sensibles-peuvent-elles-etre-traitees)
- [Zoom Algérie : loi 18-07, obligations ANPDP](https://zoomalgerie.com/loi-18-07-protection-donnees-algerie/)
- [AlgeriaTech : What Law 25-11 Changes for Cross-Border Data Flows](https://algeriatech.news/?p=26670)
- [AlgeriaTech : Algeria's Data Protection Law Just Got Teeth (2025)](https://algeriatech.news/?p=24845)
- [APA News : un encadrement plus symbolique que réel](https://fr.apanews.net/society/algerie-protection-des-donnees-personnelles-un-encadrement-plus-symbolique-que-reel/)
- [Texte de la loi 18-07 (PDF, Univ. Boumerdès)](https://fhc.univ-boumerdes.dz/wp-content/uploads/2026/07/loi_18-07_fr.pdf) : non consultable depuis la session (réseau), à lire pour les numéros d'article.

Hôtes bloqués par le réseau de la session : `cms.law` et `jst.sonatrach.dz`. Il faut les autoriser pour vérifier le texte officiel.
