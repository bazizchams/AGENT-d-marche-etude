# Cahier des charges : logiciel de gestion des dossiers clients de World Destination

Validé par entretien le 14/11/2026. Logo : `logo-world-destination.jpg` (couleur principale : bleu canard).

## 1. Objectif
Gérer le bureau d'affaires de l'agence : pour chaque client, la check-list des documents (fournis ou manquants), les paiements (honoraires et frais de procédure) et le suivi du dossier (étape en cours, historique de ce qui a été fait).

## 2. Plateformes
- Une seule application web, installable comme logiciel sur **Windows** et comme application sur **Android et iPhone** (PWA).
- Base de données et stockage des fichiers **en ligne** (type Supabase, serveurs en Europe), avec sauvegardes automatiques. Coût estimé : 0 à 25 $ par mois.
- Internet stable au bureau, donc pas de mode hors-ligne complet. Un bandeau prévient en cas de coupure.

## 3. Utilisateurs et rôles
| Rôle | Nombre | Droits |
|---|---|---|
| Administrateur | 2 | Tout, y compris la caisse et les statistiques financières ; gère les modèles de dossiers, les tarifs et les comptes |
| Agent | 2 | Crée et suit les dossiers, téléverse et valide les documents, encaisse ; ne peut ni supprimer un paiement ni voir le chiffre d'affaires global |
| Client | illimité | Voit uniquement ses propres dossiers ; téléverse ses documents |

- Un seul bureau.
- Chaque action est enregistrée avec l'auteur, la date et l'heure.
- Un paiement ne s'efface jamais : il s'annule, avec un motif obligatoire.

## 4. Types de dossiers (modèles modifiables par un administrateur)
Pré-remplis : **Ausbildung (Allemagne), Campus France, Visa Schengen, Résidence permanente / Entrée express (Canada), Études en Italie**. L'administrateur peut en ajouter d'autres.
Chaque modèle définit :
- la liste des documents demandés (avec l'indication d'une date d'expiration éventuelle) ;
- les étapes ordonnées de la procédure ;
- le montant des honoraires ;
- la liste des frais de procédure.

À la création d'un dossier, le choix du type génère automatiquement la check-list, les étapes et les échéances.

## 5. Documents
- **Aucun dossier n'est conservé sur le PC** : tout document reçu au bureau est téléversé par l'agent.
- Le client peut téléverser depuis son espace (dépôt en ligne).
- Formats acceptés : PDF et images (photo prise au téléphone).
- Statuts : ⬜ Manquant → 📤 Envoyé (par le client, à vérifier) → ✅ Validé, ou ❌ Refusé avec un motif visible par le client.
- Un document téléversé par un agent est validé directement.
- Date d'expiration (passeport, certificat de langue, assurance) avec une alerte avant l'échéance.

## 6. Paiements
- **Honoraires de l'agence** : 2 échéances créées automatiquement, **50 % au dépôt du dossier et 50 % à la fin de la procédure**.
- **Frais de procédure** (Campus France, VFS/TLS, IRCC, université, traduction, assurance…) : **100 % payés d'avance**. Une étape payante est signalée, voire bloquée, tant que les frais correspondants ne sont pas encaissés.
- Pour chaque encaissement : date, montant, devise (DZD, EUR, CAD), mode de paiement (espèces, CCP, virement), auteur et justificatif.
- Calcul automatique du reste à payer, signalement des échéances en retard, reçu imprimable avec QR code d'accès à l'espace client.

## 7. Suivi du dossier
- Barre de progression des étapes, avec l'étape en cours bien visible.
- Journal horodaté de toutes les actions : documents, paiements, étapes, notes, rendez-vous.
- Notes internes, invisibles pour le client.

## 8. Notifications au client
- Notification dans l'application et e-mail automatique.
- Bouton **« Envoyer sur WhatsApp »** qui ouvre WhatsApp avec le message pré-rédigé dans la langue du client. Le numéro WhatsApp de l'agence est réglable dans les paramètres.
- L'envoi WhatsApp automatique via l'API officielle viendra plus tard.

## 9. Langues
- Interface du personnel : français.
- Espace client, e-mails et messages WhatsApp : **français et arabe** (affichage de droite à gauche), avec un sélecteur de langue.

## 10. Accès client
- Le compte est **créé par l'agence** ; pas d'inscription libre.
- Connexion par **lien magique envoyé par e-mail** (pas de mot de passe). Lien d'accès également envoyable par WhatsApp et QR code sur le reçu.
- Un compte peut regrouper plusieurs dossiers. Un parent peut recevoir l'accès à la place de l'étudiant.

## 11. Tableau de bord du personnel
- Dossiers par type et par étape.
- Documents à vérifier (envoyés par les clients).
- Clients ayant un reste à payer et échéances en retard (montants visibles par les administrateurs seulement).
- Frais de procédure non encaissés.
- Documents qui expirent bientôt.
- Recherche rapide par nom, téléphone ou numéro de dossier.

## 12. Hors périmètre de la première version
Mode hors-ligne complet, envoi WhatsApp automatique, SMS, publication sur le Play Store et l'App Store, gestion de plusieurs agences.
