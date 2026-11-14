# World Destination : gestion des dossiers clients

Logiciel du bureau d'affaires de l'agence World Destination. Pour chaque client, il gère la check-list des documents, les paiements (honoraires et frais de procédure), les étapes de la procédure et le journal de tout ce qui a été fait. Un espace client en français et en arabe complète l'ensemble.

Cahier des charges : `../docs/world-destination-gestion/cahier-des-charges.md`

## État actuel : version de démonstration
- Toutes les fonctions du personnel marchent, et il existe un aperçu de l'espace client.
- Les données sont **fictives** et restent **dans le navigateur** (localStorage et IndexedDB). Rien n'est partagé entre les postes.
- La version en ligne (partage entre le PC, les téléphones et les clients) se branchera sur Supabase. Le schéma de la base et les règles de sécurité sont préparés dans `supabase/schema.sql`.

## Lancer
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests des règles métier
npm run build      # version à héberger (dossier dist/)
```

## Installer comme logiciel
Ouvrez l'application dans Chrome ou Edge, puis cliquez sur l'icône « Installer » dans la barre d'adresse. Le logiciel apparaît dans le menu Démarrer de Windows. Sur Android et iPhone, utilisez « Ajouter à l'écran d'accueil ».

## Règles métier
- **Honoraires** : 2 échéances créées automatiquement, 50 % au dépôt et 50 % à la fin de la procédure. La 2ᵉ devient exigible quand toutes les étapes sont faites ou quand le dossier est clôturé.
- **Frais de procédure** : payés à 100 % d'avance. Une étape liée à des frais est **bloquée** tant qu'ils ne sont pas encaissés.
- **Documents** : un document téléversé par un agent est validé directement. Un document envoyé par le client passe « à vérifier ». Un refus exige un motif, visible par le client.
- **Paiements** : jamais supprimés. Seul un administrateur peut les annuler, avec un motif.
- **Rôles** : un agent ne voit ni la caisse ni les paramètres.

## Structure
- `src/lib/regles.ts` : règles de calcul (testées dans `regles.test.ts`)
- `src/lib/modeles.ts` : modèles des 5 types de dossiers (montants donnés à titre d'exemple)
- `src/lib/store.ts` : accès aux données (à remplacer par Supabase)
- `src/lib/messages.ts` : messages WhatsApp et e-mail en français et en arabe
- `src/pages/` : écrans
