# Mettre World Destination en ligne : guide pas à pas

Ce guide s'adresse à une personne qui n'est pas informaticienne. Comptez environ **1 h 30**, à faire une seule fois.
Vous n'avez rien à installer sur le PC : tout se fait dans le navigateur (Chrome ou Edge).

À la fin :
- les 4 membres de l'équipe se connectent depuis le PC du bureau ou leur téléphone, et voient les mêmes dossiers en temps réel ;
- chaque client ouvre son espace avec un lien reçu par e-mail, sans mot de passe, et ne voit que ses propres dossiers ;
- les documents sont rangés dans un espace de stockage privé, sur des serveurs en Europe.

> Tant que les étapes 6 et 7 ne sont pas faites, l'application reste en **mode démonstration** (données fictives). Rien ne se perd.

**Ce qu'il vous faut :** une adresse e-mail de l'agence (par exemple `contact@…`) pour créer les comptes, et le code de l'application sur GitHub (votre prestataire peut vous donner l'accès). Notez au fur et à mesure, dans un carnet rangé en lieu sûr, les mots de passe que vous créez.

---

## Étape 1 : créer la base de données (Supabase)

1. Allez sur **https://supabase.com** et cliquez sur **Start your project**. Créez un compte avec l'e-mail de l'agence.
2. Cliquez sur **New project**.
   - **Name** : `world-destination`
   - **Database Password** : cliquez sur **Generate a password**, puis **copiez-le dans votre carnet**.
   - **Region** : choisissez **Central EU (Frankfurt)** ou **West EU (Paris)**. Les données restent ainsi en Europe.
   - **Plan** : *Free* pour commencer (voir « Coût et sauvegardes » à la fin).
3. Cliquez sur **Create new project** et attendez 2 minutes que le projet soit prêt.

## Étape 2 : installer les tables et les règles de sécurité

1. Dans le menu de gauche, cliquez sur **SQL Editor**, puis sur **New query**.
2. Ouvrez le fichier `supabase/schema.sql` (sur GitHub : cliquez sur le fichier, puis sur l'icône **Copy raw file**). Collez **tout** le texte dans la page Supabase.
3. Cliquez sur **Run** (en bas à droite). Le message **Success. No rows returned** doit s'afficher.
   - Un avertissement en orange (« destructive operation ») peut apparaître : cliquez sur **Run this query**. Le script ne supprime aucune donnée.
4. Cliquez à nouveau sur **New query**, collez le contenu de `supabase/seed.sql`, puis cliquez sur **Run**. Les types de dossiers (Ausbildung, Campus France, Visa Schengen, Canada, Italie…) sont créés.

> Vous pouvez relancer ces deux fichiers plus tard sans danger, par exemple après une mise à jour de l'application. Vos dossiers et vos tarifs corrigés sont conservés.

## Étape 3 : régler la connexion

Dans le menu de gauche : **Authentication**.

1. **Sign In / Providers** (ou **Providers**) :
   - **désactivez « Allow new users to sign up »** (obligatoire). Seule l'agence crée les comptes : personne ne peut s'inscrire tout seul. Sans ce réglage, n'importe qui pourrait créer un compte, même si l'écran de l'application ne le propose pas ;
   - laissez **Email** activé ;
   - dans **Email**, réglez **Email OTP Expiration** (durée du lien de connexion) sur **1800** secondes (30 minutes). Ne dépassez jamais 3600 (1 heure) ;
   - réglez **Minimum password length** sur **12** caractères au moins. Dans l'offre Pro, activez aussi **Prevent use of leaked passwords**.
2. **Multi-Factor** (ou **MFA**) : vérifiez que **TOTP (App Authenticator)** est activé. Il sert à la double authentification des administrateurs (étape 4 bis).
3. **URL Configuration** : vous y reviendrez à l'étape 7, quand vous connaîtrez l'adresse du site.

## Étape 4 : créer les 4 comptes du personnel

1. **Authentication › Users** › bouton **Add user** › **Create new user**.
2. Saisissez l'e-mail de la personne et un mot de passe de **12 caractères au moins** (par exemple trois mots et deux chiffres : `Palmier-Bleu-Oran-47`), propre à ce compte et jamais utilisé ailleurs. Cochez **Auto Confirm User**, puis cliquez sur **Create user**. Remettez le mot de passe en main propre, jamais par WhatsApp.
3. Recommencez pour les 4 personnes (2 administrateurs, 2 agents).
4. Donnez maintenant à chacun son nom et son rôle. Allez dans **SQL Editor › New query**, collez le texte ci-dessous **en remplaçant les noms et les e-mails**, puis cliquez sur **Run** :

```sql
update profils set role = 'admin', nom = 'Prénom Nom 1' where email = 'admin1@exemple.com';
update profils set role = 'admin', nom = 'Prénom Nom 2' where email = 'admin2@exemple.com';
update profils set role = 'agent', nom = 'Prénom Nom 3' where email = 'agent1@exemple.com';
update profils set role = 'agent', nom = 'Prénom Nom 4' where email = 'agent2@exemple.com';
select nom, email, role, actif from profils;
```

Le tableau du bas doit montrer les 4 personnes avec le bon rôle. Chacun pourra ensuite se connecter avec son e-mail et son mot de passe, ou demander un **lien de connexion par e-mail**.

> Pour un futur employé : refaites les points 1, 2 et 4 pour cette personne. Pour un départ : dans l'application, **Paramètres › Utilisateurs**, désactivez le compte, puis, dans Supabase, **Authentication › Users** › la personne › **Sign out user**. Il ne pourra plus rien voir.

## Étape 4 bis : double authentification des administrateurs

Un administrateur peut tout voir et annuler des paiements. Son mot de passe seul ne suffit pas : il confirme chaque connexion avec un **code à 6 chiffres** affiché par une application gratuite sur son téléphone (Google Authenticator ou Microsoft Authenticator).

1. Chaque administrateur installe l'application sur son téléphone.
2. À sa première connexion au site (étape 7), l'application World Destination propose **« Activer maintenant »**. Il scanne le QR code, puis saisit le code affiché. Ensuite, le code est demandé à chaque connexion.
3. Quand **les deux administrateurs** ont activé leur code, rendez-le **obligatoire** : **SQL Editor › New query** :

```sql
update securite set mfa_admin_obligatoire = true;
```

À partir de là, un administrateur connecté sans son code n'a que les droits d'un agent (ni caisse, ni annulation, ni purge).
- **Téléphone perdu** : l'autre administrateur va dans **Authentication › Users** › la personne › supprime le facteur MFA (*Remove MFA factor*). La personne réactive ensuite son code à la connexion suivante.
- Pour suspendre l'obligation (urgence) : `update securite set mfa_admin_obligatoire = false;`

## Étape 5 : permettre l'invitation des clients

C'est le petit programme qui crée le compte d'un client et lui envoie son lien d'accès. Il garde la clé secrète de Supabase côté serveur : elle n'apparaît jamais dans le navigateur.

1. Dans le menu de gauche, cliquez sur **Edge Functions**, puis sur **Deploy a new function** › **Via Editor**.
2. Nommez-la exactement **`inviter-client`**.
3. Effacez l'exemple, collez tout le contenu du fichier `supabase/functions/inviter-client/index.ts`, puis cliquez sur **Deploy function**.

Supabase fournit lui-même à la fonction les clés dont elle a besoin. Vous ajoutez un seul réglage, **après l'étape 7** quand vous connaissez l'adresse du site :

4. **Edge Functions › Secrets** (ou **Manage secrets**) › **Add new secret** : Name `APP_URL`, Value = l'adresse exacte du site, par exemple `https://world-destination.vercel.app/`, puis **Save**.

Sans ce réglage, l'invitation refuse de partir. C'est voulu : le lien d'accès envoyé au client ne peut mener **que** vers votre site.

Règles appliquées par l'invitation :
- une adresse qui a déjà accès à un **autre** client est refusée (une faute de frappe ne peut pas ouvrir le dossier d'un client à un inconnu) ;
- une fiche déjà reliée à un compte n'est jamais remplacée en silence ;
- pour donner l'accès à un **parent**, il faut d'abord enregistrer le **consentement écrit** du titulaire (formulaire papier signé, à conserver). Retirer ce consentement coupe immédiatement l'accès du parent ;
- chaque invitation est notée dans le journal interne du dossier.

### E-mails (recommandé)
Supabase envoie les e-mails de connexion lui-même, mais seulement **quelques-uns par heure**. Pour inviter des clients chaque jour, branchez un service d'envoi gratuit :
1. Créez un compte gratuit chez **Brevo** (https://www.brevo.com, 300 e-mails par jour). Dans **SMTP & API**, notez le serveur, le port, l'identifiant et la clé SMTP.
2. Dans Supabase : **Authentication › Emails › SMTP Settings** › **Enable custom SMTP**. Recopiez ces informations. L'expéditeur est `World Destination` avec l'e-mail de l'agence.
3. *(Facultatif)* Dans **Authentication › Emails › Templates**, traduisez les modèles « Invite user » et « Magic link » en français et en arabe, par exemple : « Bonjour, voici votre accès à votre dossier World Destination ». **Gardez** le lien `{{ .ConfirmationURL }}`.

### Inviter un client à la main (si le bouton « Inviter » n'est pas encore dans la fiche client)
À faire par un **administrateur** uniquement. Vérifiez deux fois l'adresse : c'est elle qui ouvre l'accès aux documents du client.
1. **Authentication › Users › Add user › Send invitation** : saisissez l'e-mail du client, puis cliquez sur **Send invitation**.
2. **SQL Editor › New query**, en remplaçant les deux adresses :
```sql
update clients set compte_id = (select id from auth.users where email = 'client@exemple.com')
where email = 'client@exemple.com';
```
Pour un parent : n'utilisez cette méthode qu'avec le consentement écrit du titulaire. Mettez `compte_suivi_id` au lieu de `compte_id`, et l'e-mail du parent dans `auth.users`.

## Étape 6 : récupérer les deux codes de connexion

Dans Supabase : **Project Settings › API** (ou le bouton **Connect** en haut de la page).
- **Project URL** : il commence par `https://` et finit par `.supabase.co`.
- **Clé `anon` `public`** (ou **Publishable key**, qui commence par `sb_publishable_`).

> ⚠ **Ne copiez jamais** la clé `service_role` ou la clé **Secret**. Elle donne tous les droits et ne doit sortir de Supabase sous aucun prétexte.

## Étape 7 : mettre le site en ligne (Vercel, gratuit)

1. Allez sur **https://vercel.com** et cliquez sur **Sign Up** › **Continue with GitHub**.
2. Cliquez sur **Add New… › Project**, puis choisissez le dépôt de l'application et cliquez sur **Import**.
3. Réglages :
   - **Root Directory** : cliquez sur **Edit** et choisissez `world-destination-app` ;
   - **Framework Preset** : `Vite`, choisi automatiquement ;
   - **Environment Variables** : ajoutez ces deux lignes.

     | Name | Value |
     |---|---|
     | `VITE_SUPABASE_URL` | le *Project URL* de l'étape 6 |
     | `VITE_SUPABASE_ANON_KEY` | la clé *anon public* de l'étape 6 |
4. Cliquez sur **Deploy**. Après environ une minute, Vercel affiche l'adresse du site, par exemple `https://world-destination.vercel.app`. Notez-la.
5. Retournez dans **Supabase › Authentication › URL Configuration** :
   - **Site URL** : collez l'adresse du site, par exemple `https://world-destination.vercel.app` ;
   - **Redirect URLs** : cliquez sur **Add URL** et collez **exactement** la même adresse terminée par `/`, par exemple `https://world-destination.vercel.app/`. N'ajoutez **aucune** adresse avec `*` ou `**`, ni d'adresse de test : un lien de connexion pourrait sinon être détourné vers un autre site.
   - Cliquez sur **Save**.
6. Revenez à l'étape 5, point 4, et renseignez le secret `APP_URL` avec la même adresse.

Sans ces deux réglages, les liens reçus par e-mail ne fonctionnent pas.

*Autre possibilité : **Netlify** (https://netlify.com) fonctionne de la même façon. Utilisez « Import from Git », Base directory `world-destination-app`, Build command `npm run build`, Publish directory `dist`, et les deux mêmes variables.*

**Mises à jour :** chaque fois que le code change sur GitHub, Vercel met le site à jour tout seul.
**Nom de domaine :** vous pourrez plus tard brancher une adresse à vous (par exemple `dossiers.worlddestination.dz`) dans **Vercel › Settings › Domains**. Mettez alors à jour l'étape 7.5.

## Étape 8 : installer l'application

- **PC Windows** : ouvrez l'adresse du site dans **Chrome** ou **Edge**, puis cliquez sur l'icône **Installer** (un écran avec une flèche) à droite de la barre d'adresse. *World Destination* apparaît dans le menu Démarrer et s'ouvre comme un logiciel.
- **Android** : ouvrez le site dans Chrome, puis appuyez sur le menu **⋮** › **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
- **iPhone** : ouvrez le site dans **Safari**, puis appuyez sur le bouton **Partager** › **Sur l'écran d'accueil**.

## Étape 9 : vérifier que tout marche (10 minutes)

1. Connectez-vous avec un compte **administrateur**. Le tableau de bord s'affiche, vide.
2. Dans **Paramètres**, saisissez le nom, le téléphone et le numéro **WhatsApp** de l'agence. Vérifiez les **tarifs** des types de dossiers : les montants fournis sont des exemples.
3. Créez un client test **avec votre propre e-mail**, puis ouvrez un dossier. Le numéro `WD-2026-0001` est attribué automatiquement.
4. Encaissez un petit montant. Le reçu `R-2026-00001` s'affiche.
5. Sur un autre appareil, connectez-vous avec un compte **agent** : le même dossier apparaît. Vérifiez que l'agent ne voit ni la **Caisse** ni les **Paramètres**, et qu'il ne peut pas annuler le paiement.
6. Invitez le client test : vous recevez l'e-mail. Ouvrez le lien sur votre téléphone : l'espace client s'affiche avec **uniquement** ce dossier. Envoyez une photo pour un document : au bureau, il passe à « À vérifier ».
7. Revenez en administrateur et annulez le paiement test avec un motif. Il reste visible, barré, dans l'historique.

## Sécurité au quotidien

- **Jamais de vraies données dans la version de démonstration** (l'adresse sans Supabase) : elle n'a pas de mot de passe et garde tout dans le navigateur.
- **Qui a consulté quoi** : chaque ouverture d'un document est enregistrée. Un administrateur peut relire ce registre une fois par mois, dans **SQL Editor** :
```sql
select a.le, p.nom as qui, d.nom as document, a.chemin
from acces_documents a left join profils p on p.id = a.par left join documents d on d.id = a.document_id
order by a.le desc limit 200;
```
- **Fin de conservation** (6 à 12 mois après la clôture, ou à la demande du client) : un administrateur **purge** le dossier. Les fichiers (passeport, casier, examens…) sont effacés et la fiche peut être anonymisée. Les paiements, les reçus et le journal sont conservés (comptabilité). Aucun dossier ne peut être supprimé autrement.
- **Montants** : une fois le dossier ouvert, seuls les administrateurs peuvent modifier un montant, une devise ou les frais requis d'une étape. Chaque modification est notée au journal.
- **Agents** : un agent voit le détail des paiements (dates, reçus) des dossiers dont il a la charge et de ceux qu'il a encaissés. Pour les autres, il voit seulement ce qui reste à payer.
- **Lien de l'espace client** : le lien envoyé par WhatsApp ou imprimé sur le reçu (QR code) ne contient aucun mot de passe. Le client doit toujours se connecter avec son e-mail. Ne transférez jamais un e-mail de connexion reçu par un client.

## Coût et sauvegardes

- **Gratuit** (Supabase Free + Vercel Hobby) : il suffit largement pour 4 employés et quelques centaines de clients, avec 500 Mo de données et 1 Go de documents. Deux limites : **pas de sauvegarde automatique**, et un projet resté **7 jours sans aucune connexion** est mis en pause. Il suffit alors de cliquer sur *Restore* dans Supabase.
- **Recommandé dès que de vrais clients sont enregistrés** : Supabase **Pro (25 $ par mois)**. Il apporte des sauvegardes automatiques quotidiennes, 8 Go de données et 100 Go de documents, et supprime la mise en pause. Choisissez-le dans **Project Settings › Billing**.

## En cas de souci

| Problème | Solution |
|---|---|
| L'écran de connexion propose encore les profils de démonstration | Les variables de l'étape 7.3 manquent ou sont mal recopiées. Dans Vercel, corrigez-les dans **Settings › Environment Variables**, puis faites **Deployments › Redeploy**. |
| « Aucun compte n'existe pour cette adresse » | Créez d'abord le compte (étape 4 pour le personnel ; invitation depuis la fiche client pour un client). |
| Le lien reçu par e-mail ouvre une page d'erreur | Vérifiez l'étape 7.5 (Site URL et Redirect URLs). Un lien ne sert qu'une fois et expire après 30 minutes : demandez-en un nouveau. |
| « Si cette adresse est connue… » mais aucun e-mail n'arrive | Le message est volontairement le même pour tout le monde, pour ne pas révéler qui est client. Vérifiez que le compte existe (**Authentication › Users**) et regardez les courriers indésirables. |
| L'invitation affiche « APP_URL n'est pas défini » | Faites l'étape 5, point 4. |
| Un administrateur ne voit plus la caisse | Son code à 6 chiffres n'a pas été saisi (étape 4 bis) : déconnexion, puis reconnexion avec le code. |
| Un employé ne voit rien après connexion | Son rôle n'a pas été donné : refaites l'étape 4.4 avec son e-mail. |
| « Action refusée » | C'est normal si l'action est réservée à un administrateur, par exemple annuler un paiement. |
| Les e-mails n'arrivent pas | Regardez les courriers indésirables, puis branchez Brevo (étape 5, « E-mails »). |
