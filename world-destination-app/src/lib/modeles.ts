import type { ModeleDocument, ModeleDossier } from './types';

/**
 * Modèles pré-remplis.
 * - Les HONORAIRES de l'agence sont des EXEMPLES : l'administrateur les corrige dans Paramètres › Types de dossiers.
 * - Les FRAIS DE TIERS ont été vérifiés le 14/11/2026 (source en commentaire à côté de chaque frais).
 *   « Tarif agence » = montant communiqué par l'agence (ce qu'elle paie réellement).
 *   Les montants marqués « À CONFIRMER » n'ont pas pu être vérifiés sur une source officielle : valeur raisonnable.
 * - `nomAr` : libellé affiché dans l'espace client et les messages quand la langue est l'arabe.
 */

/* ---------------- Visa Schengen : un modèle par pays ---------------- */

interface PaysSchengen {
  id: string;
  pays: string;
  couleur: string;
  /** Qui reçoit le dossier en Algérie, et où. */
  depot: string;
  /** Organisme qui encaisse les frais de service (absent si dépôt direct à l'ambassade, sans frais de service). */
  prestataire?: string;
  fraisService?: number;
  /** Documents propres à ce pays, ajoutés à la liste commune. */
  documentsEnPlus?: ModeleDocument[];
  /** Nom du dernier document commun (formulaire + rendez-vous), adapté au prestataire. */
  formulaire?: { nom: string; nomAr: string };
  /** false : modèle masqué à la création de dossier (l'administrateur le réactive dans Paramètres). */
  actif?: boolean;
}

const FORMULAIRE_STANDARD = { nom: 'Formulaire de demande signé + confirmation de rendez-vous', nomAr: 'استمارة الطلب موقّعة مع تأكيد الموعد' };

function modeleSchengen(p: PaysSchengen): ModeleDossier {
  const f = p.formulaire ?? FORMULAIRE_STANDARD;
  const avecService = p.fraisService !== undefined && p.prestataire !== undefined;
  return {
    id: p.id,
    nom: `Visa Schengen – ${p.pays}`,
    couleur: p.couleur,
    honoraires: 25000,
    deviseHonoraires: 'DZD',
    actif: p.actif ?? true,
    documents: [
      { id: 'd1', nom: 'Passeport (+ anciens visas)', nomAr: 'جواز السفر (مع التأشيرات السابقة)', avecExpiration: true },
      { id: 'd2', nom: "Photos d'identité", nomAr: 'صور شمسية', avecExpiration: false },
      { id: 'd3', nom: 'Assurance voyage (couverture 30 000 € minimum)', nomAr: 'تأمين السفر (تغطية 30.000 يورو على الأقل)', avecExpiration: true },
      { id: 'd4', nom: 'Réservation de vol', nomAr: 'حجز تذكرة الطيران', avecExpiration: false },
      { id: 'd5', nom: "Réservation d'hôtel / attestation d'accueil", nomAr: 'حجز الفندق أو شهادة الإيواء', avecExpiration: false },
      { id: 'd6', nom: 'Relevés bancaires / CCP (3 à 6 mois)', nomAr: 'كشوف الحساب البنكي أو البريدي (من 3 إلى 6 أشهر)', avecExpiration: false },
      { id: 'd7', nom: 'Attestation de travail + fiches de paie / registre de commerce', nomAr: 'شهادة العمل وكشوف الراتب أو السجل التجاري', avecExpiration: false },
      { id: 'd8', nom: 'Titre de congé', nomAr: 'سند العطلة', avecExpiration: false },
      { id: 'd9', nom: 'Fiche familiale', nomAr: 'شهادة عائلية للحالة المدنية', avecExpiration: false },
      { id: 'd10', nom: f.nom, nomAr: f.nomAr, avecExpiration: false },
      ...(p.documentsEnPlus ?? []),
    ],
    frais: [
      // 90 € adulte (45 € de 6 à 12 ans, gratuit avant 6 ans) : tarif Schengen depuis le 11/06/2024, aucune réduction pour les
      // Algériens (pas d'accord de facilitation). Confirmé sur les pages VFS Algérie (Allemagne, Italie, Suisse, Finlande, Croatie,
      // Malte), BLS Oran (13 625 DA) et france-visas. Payé en DA au taux de change du jour. Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de visa (court séjour)', nomAr: 'رسوم التأشيرة (إقامة قصيرة)', organisme: `Consulat – ${p.pays}`, montant: 90, devise: 'EUR' },
      ...(avecService ? [{ id: 'f2', nom: `Frais de service ${p.prestataire}`, nomAr: `رسوم خدمة مركز التأشيرات (${p.prestataire})`, organisme: p.prestataire!, montant: p.fraisService!, devise: 'DZD' as const }] : []),
      // À CONFIRMER : prix variable selon l'assureur et la durée du séjour (exemple). Vérifié le 14/11/2026 : aucune grille officielle.
      { id: 'f3', nom: 'Assurance voyage', nomAr: 'تأمين السفر', organisme: 'Assureur', montant: 4000, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: 'Collecte des documents', nomAr: 'جمع الوثائق', fraisRequis: [] },
      { id: 'e3', nom: 'Remplissage du formulaire', nomAr: 'ملء استمارة الطلب', fraisRequis: [] },
      { id: 'e4', nom: 'Assurance souscrite', nomAr: 'اكتتاب تأمين السفر', fraisRequis: ['f3'] },
      { id: 'e5', nom: `Prise de rendez-vous (${p.depot})`, nomAr: 'حجز الموعد', fraisRequis: [] },
      { id: 'e6', nom: avecService ? 'Dépôt au centre de visa' : "Dépôt à l'ambassade", nomAr: avecService ? 'إيداع الملف في مركز التأشيرات' : 'إيداع الملف لدى السفارة', fraisRequis: avecService ? ['f1', 'f2'] : ['f1'] },
      { id: 'e7', nom: 'Retrait du passeport / décision', nomAr: 'استلام جواز السفر ومعرفة القرار', fraisRequis: [] },
    ],
  };
}

/**
 * Pays Schengen qui reçoivent des demandes de visa en Algérie (hors France, modèle `m-schengen` ci-dessous).
 * Frais de service vérifiés le 14/11/2026 ; source indiquée pour chaque pays.
 * Pays SANS modèle (représentés par un autre pays ou sans poste en Algérie) : voir le rapport / la doc de l'agence.
 */
const PAYS_SCHENGEN: PaysSchengen[] = [
  // BLS International, Alger et Oran (Oran : voyages de 90 jours max.). 2 560 DA par demande, en espèces.
  // Source : algeria.blsspainvisa.com (page Oran, lue via recherche web : le site bloque les accès automatisés). Vérifié le 14/11/2026.
  { id: 'm-schengen-es', pays: 'Espagne', couleur: '#e67e22', depot: 'BLS Alger / Oran', prestataire: 'BLS International', fraisService: 2560 },
  // VFS Global Alger. 40 € = 6 100 DA (TVA incluse). Source : vfsglobal.com/one-pager/italy/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-it', pays: 'Italie', couleur: '#27ae60', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 6100 },
  // VFS Global Alger (seul prestataire de l'ambassade, algier.diplo.de). 3 200 DA tous demandeurs.
  // Source : vfsglobal.com/one-pager/germany/algeria + algier.diplo.de (Schengen-Visa). Vérifié le 14/11/2026.
  {
    id: 'm-schengen-de', pays: 'Allemagne', couleur: '#34495e', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 3200,
    formulaire: { nom: 'Formulaire VIDEX imprimé et signé + confirmation de rendez-vous', nomAr: 'استمارة VIDEX مطبوعة وموقّعة مع تأكيد الموعد' },
  },
  // TLScontact Alger. 4 190 DA ; depuis le 05/01/2026, rendez-vous confirmé seulement après prépaiement chez Algérie Poste (3 jours ouvrés).
  // Source : visas-be.tlscontact.com (page « application fees » Algérie, lue via recherche web) + presse. Vérifié le 14/11/2026.
  {
    id: 'm-schengen-be', pays: 'Belgique', couleur: '#f1c40f', depot: 'TLScontact Alger', prestataire: 'TLScontact', fraisService: 4190,
    formulaire: { nom: 'Formulaire signé + confirmation de rendez-vous TLScontact + reçu de prépaiement', nomAr: 'الاستمارة موقّعة مع تأكيد موعد TLScontact ووصل الدفع المسبق' },
  },
  // TLScontact Alger. À CONFIRMER : frais de service non publiés lisiblement, et inconnus de l'agence (14/11/2026) ;
  // valeur reprise de TLScontact Belgique.
  // Source : listes de documents static.tlscontact.com (dz2pt). Vérifié le 14/11/2026.
  {
    id: 'm-schengen-pt', pays: 'Portugal', couleur: '#16a085', depot: 'TLScontact Alger', prestataire: 'TLScontact', fraisService: 4190,
    formulaire: { nom: 'Formulaire signé + confirmation de rendez-vous TLScontact', nomAr: 'الاستمارة موقّعة مع تأكيد موعد TLScontact' },
  },
  // VFS Global Alger. 3 766 DA (avec biométrie, TVA incluse). Source : vfsglobal.com/one-pager/netherlands/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-nl', pays: 'Pays-Bas', couleur: '#d35400', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 3766 },
  // VFS Global Alger. 3 500 DA depuis le 01/07/2025 (espèces ou carte). Source : vfsglobal.com/one-pager/switzerland/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-ch', pays: 'Suisse', couleur: '#c0392b', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 3500 },
  // VFS Global Alger et Oran. 5 500 DA payables en ligne. Traite aussi la Slovénie (gov.si). Source : vfsglobal.com/one-pager/austria/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-at', pays: 'Autriche (et Slovénie)', couleur: '#e74c3c', depot: 'VFS Global Alger / Oran', prestataire: 'VFS Global', fraisService: 5500 },
  // VFS Global Alger. 1 400 DA (TVA incluse). Source : vfsglobal.com/one-pager/hungary/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-hu', pays: 'Hongrie', couleur: '#8e44ad', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 1400 },
  // VFS Global Alger. 2 900 DA (20 €), à prépayer en banque sous 72 h ou au centre. Source : vfsglobal.com/one-pager/finland/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-fi', pays: 'Finlande', couleur: '#2980b9', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 2900 },
  // VFS Global Alger ; frais de visa payés en ligne sur ApplyVisa.um.dk. Traite la Suède depuis le 01/06/2026 (swedenabroad.se).
  // Frais de service publiés en euros : 19 €, payés en DA au taux du jour. À CONFIRMER : conversion ≈ 2 900 DA.
  // Source : vfsglobal.com/one-pager/denmark/algeria. Vérifié le 14/11/2026.
  {
    id: 'm-schengen-dk', pays: 'Danemark (et Suède)', couleur: '#a93226', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 2900,
    documentsEnPlus: [{ id: 'd11', nom: 'Reçu du paiement en ligne des frais de visa (ApplyVisa)', nomAr: 'وصل دفع رسوم التأشيرة عبر الإنترنت (ApplyVisa)', avecExpiration: false }],
  },
  // VFS Global. 2 430 DA (16 €), en espèces au dépôt. Source : vfsglobal.com/one-pager/norway/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-no', pays: 'Norvège', couleur: '#1f618d', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 2430 },
  // VFS Global. 3 200 DA (TVA incluse) par demande. Source : vfsglobal.com/one-pager/greece/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-gr', pays: 'Grèce', couleur: '#5dade2', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 3200 },
  // VFS Global Alger et Oran. 4 510 DA (TVA incluse) ; + 2 000 DA de courrier pour un dépôt à Oran.
  // Source : vfsglobal.com/one-pager/malta/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-mt', pays: 'Malte', couleur: '#b03a2e', depot: 'VFS Global Alger / Oran', prestataire: 'VFS Global', fraisService: 4510 },
  // VFS Global. 4 800 DA (33 €), en espèces. Source : vfsglobal.com/one-pager/croatia/algeria. Vérifié le 14/11/2026.
  { id: 'm-schengen-hr', pays: 'Croatie', couleur: '#0e6655', depot: 'VFS Global Alger', prestataire: 'VFS Global', fraisService: 4800 },
  // Dépôt direct à l'ambassade de Pologne à Alger, rendez-vous sur e-Konsulat ; seuls les frais consulaires sont perçus.
  // Source : gov.pl/web/algerie (« Un visa Schengen (type C) »), lue via recherche web. Vérifié le 14/11/2026.
  {
    id: 'm-schengen-pl', pays: 'Pologne', couleur: '#cb4335', depot: 'Ambassade de Pologne, Alger (e-Konsulat)',
    formulaire: { nom: 'Formulaire enregistré sur e-Konsulat, signé + confirmation de rendez-vous', nomAr: 'الاستمارة المسجّلة على منصة e-Konsulat موقّعة مع تأكيد الموعد' },
  },
  // Dépôt en personne à l'ambassade de Bulgarie à Alger (13, bd Colonel Bougara), empreintes prises sur place, pas de prestataire
  // ni de dépôt par courrier ou par un tiers ; traitement de 15 jours au moins (prévoir 4 à 6 semaines).
  // À CONFIRMER : aucune page officielle de l'ambassade trouvée (mfa.bg ne donne que le titre ; Commission européenne :
  // représentation bulgare listée en Algérie). Source : guides en ligne (embassyinformation.com, entrybrief.com) lus via
  // recherche web. Revérifié le 14/11/2026.
  { id: 'm-schengen-bg', pays: 'Bulgarie', couleur: '#229954', depot: 'Ambassade de Bulgarie, Alger' },
  // Dépôt direct à l'ambassade de la République tchèque à Alger, sans prestataire : rendez-vous gratuit demandé par e-mail
  // à l'ambassade (une boîte pour le tourisme, avec un quota mensuel ; une autre pour les autres motifs), un e-mail par demandeur
  // avec le justificatif du motif. Frais de visa (90 €) payés uniquement en espèces, en dinars, au taux de la Banque nationale
  // tchèque. Section consulaire fermée du 08 au 19/03/2026 (page « Fermeture de la section consulaire et du visa » mise à jour
  // le 28/05/2026). À CONFIRMER : état actuel de la section (site injoignable depuis la session).
  // Source : mzv.gov.cz/algiers (pages « Enregistrement pour les visas Schengen », « La quota », « Augmentation des frais
  // de visas Schengen »), lues via recherche web. Vérifié le 14/11/2026.
  {
    id: 'm-schengen-cz', pays: 'République tchèque', couleur: '#6c3483', depot: 'Ambassade de la République tchèque, Alger (rendez-vous par e-mail)',
    formulaire: { nom: "Formulaire signé + confirmation de rendez-vous reçue par e-mail de l'ambassade", nomAr: 'الاستمارة موقّعة مع تأكيد الموعد المرسل من السفارة عبر البريد الإلكتروني' },
  },
  // INACTIF : l'ambassade de Roumanie à Alger a suspendu ses activités consulaires, visas compris, depuis le 07/10/2026
  // (manque de personnel ; déjà suspendues du 25/06 au 16/09/2026, brève reprise du 17 au 30/09/2026). Aucune date de reprise
  // annoncée. Le modèle est prêt mais masqué : l'administrateur l'active dans Paramètres › Types de dossiers à la reprise.
  // À CONFIRMER à la reprise : mode de dépôt (ambassade ou prestataire) et frais éventuels de service.
  // Sources : observalgerie.com (07/10/2026), tsa-algerie.com, algerie360.com, relayant le communiqué de l'ambassade. Vérifié le 14/11/2026.
  { id: 'm-schengen-ro', pays: 'Roumanie', couleur: '#d4ac0d', depot: 'Ambassade de Roumanie, Alger', actif: false },
];

export const MODELES_INITIAUX: ModeleDossier[] = [
  {
    id: 'm-ausbildung',
    nom: 'Ausbildung (Allemagne)',
    couleur: '#c0392b',
    honoraires: 200000,
    deviseHonoraires: 'DZD',
    actif: true,
    // Liste alignée sur la checklist officielle « Visum zur Berufsausbildung (§ 16a AufenthG) » de l'ambassade d'Allemagne à Alger
    // (algier.diplo.de), consultée le 14/11/2026.
    documents: [
      { id: 'd1', nom: 'Passeport valide (signé, 2 pages vierges) + copie', nomAr: 'جواز سفر صالح (موقّع، فيه صفحتان فارغتان) مع نسخة', avecExpiration: true },
      { id: 'd2', nom: "Photo d'identité biométrique récente", nomAr: 'صورة شمسية بيومترية حديثة', avecExpiration: false },
      { id: 'd3', nom: 'Baccalauréat + relevé de notes', nomAr: 'شهادة البكالوريا وكشف النقاط', avecExpiration: false },
      { id: 'd4', nom: 'Diplômes / attestations de formation', nomAr: 'الشهادات وشهادات التكوين', avecExpiration: false },
      { id: 'd5', nom: "Certificat d'allemand B1 (Goethe, telc, ÖSD)", nomAr: 'شهادة اللغة الألمانية مستوى B1 (Goethe أو telc أو ÖSD)', avecExpiration: false },
      { id: 'd6', nom: 'Attestations de travail / stages', nomAr: 'شهادات العمل أو التربصات', avecExpiration: false },
      { id: 'd7', nom: "Extrait de casier judiciaire (si demandé par l'employeur)", nomAr: 'صحيفة السوابق العدلية (إذا طلبتها المؤسسة)', avecExpiration: true },
      { id: 'd8', nom: 'Diplômes en original, légalisés par le ministère des Affaires étrangères + traduction en allemand', nomAr: 'الشهادات الأصلية مصادق عليها من وزارة الشؤون الخارجية مع ترجمتها إلى الألمانية', avecExpiration: false },
      { id: 'd9', nom: "Contrat d'Ausbildung signé (en allemand) + plan de formation", nomAr: 'عقد التكوين المهني موقّع (بالألمانية) مع برنامج التكوين', avecExpiration: false },
      { id: 'd10', nom: 'Justificatif de ressources (822 € net / mois minimum, sinon compte bloqué)', nomAr: 'إثبات الموارد المالية (822 يورو صافية شهريًا على الأقل، أو حساب بنكي مجمّد)', avecExpiration: false },
      { id: 'd11', nom: "Assurance maladie privée (jusqu'au début de la formation)", nomAr: 'تأمين صحي خاص (إلى غاية بداية التكوين)', avecExpiration: true },
      { id: 'd12', nom: 'Lettre de motivation en allemand', nomAr: 'رسالة التحفيز باللغة الألمانية', avecExpiration: false },
      { id: 'd13', nom: "Approbation préalable de l'Agence fédérale pour l'emploi (si l'employeur l'a obtenue)", nomAr: 'الموافقة المسبقة للوكالة الفيدرالية للتشغيل (إن وُجدت)', avecExpiration: false },
    ],
    frais: [
      // À CONFIRMER : tarif variable selon le traducteur et le nombre de pages (exemple). Vérifié le 14/11/2026 : aucune grille officielle.
      { id: 'f1', nom: 'Traductions assermentées', nomAr: 'الترجمة الرسمية', organisme: 'Traducteur agréé', montant: 30000, devise: 'DZD' },
      // 75 €, payables en dinars au taux du jour de l'ambassade. Dépôt À L'AMBASSADE (pas de prestataire, donc pas de frais de service).
      // Source : algier.diplo.de, checklist « Visum zur Berufsausbildung ». Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Frais de visa national (D)', nomAr: 'رسوم التأشيرة الوطنية (D)', organisme: "Ambassade d'Allemagne à Alger", montant: 75, devise: 'EUR' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: "Certificat d'allemand B1", nomAr: 'الحصول على شهادة اللغة الألمانية B1', fraisRequis: [] },
      { id: 'e3', nom: 'Légalisation et traduction des documents', nomAr: 'المصادقة على الوثائق وترجمتها', fraisRequis: ['f1'] },
      { id: 'e4', nom: 'Rédaction CV et lettres de motivation (allemand)', nomAr: 'إعداد السيرة الذاتية ورسائل التحفيز بالألمانية', fraisRequis: [] },
      { id: 'e5', nom: "Recherche d'offres et candidatures", nomAr: 'البحث عن عروض التكوين وإرسال الترشيحات', fraisRequis: [] },
      { id: 'e6', nom: 'Entretiens avec les employeurs', nomAr: 'المقابلات مع المؤسسات المكوِّنة', fraisRequis: [] },
      { id: 'e7', nom: "Contrat d'Ausbildung signé", nomAr: 'توقيع عقد التكوين', fraisRequis: [] },
      // Ambassade : demande sur l'Auslandsportal, pré-vérification, puis lien de rendez-vous (en général sous 2 semaines).
      { id: 'e8', nom: "Demande sur l'Auslandsportal puis dépôt à l'ambassade d'Allemagne", nomAr: 'تقديم الطلب عبر Auslandsportal ثم إيداع الملف لدى سفارة ألمانيا', fraisRequis: ['f2'] },
      { id: 'e9', nom: "Approbation de l'Agence fédérale pour l'emploi (BA)", nomAr: 'موافقة الوكالة الفيدرالية الألمانية للتشغيل', fraisRequis: [] },
      // Délai de traitement annoncé par l'ambassade : environ 3 mois.
      { id: 'e10', nom: 'Décision du visa (environ 3 mois)', nomAr: 'قرار التأشيرة (حوالي 3 أشهر)', fraisRequis: [] },
      { id: 'e11', nom: 'Départ et installation en Allemagne', nomAr: 'السفر والاستقرار في ألمانيا', fraisRequis: [] },
    ],
  },
  {
    id: 'm-campus',
    nom: 'Campus France',
    couleur: '#2c5ea8',
    honoraires: 120000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport', nomAr: 'جواز السفر', avecExpiration: true },
      { id: 'd2', nom: "Photo d'identité", nomAr: 'صورة شمسية', avecExpiration: false },
      { id: 'd3', nom: 'Baccalauréat + relevé de notes', nomAr: 'شهادة البكالوريا وكشف النقاط', avecExpiration: false },
      { id: 'd4', nom: 'Relevés de notes universitaires', nomAr: 'كشوف النقاط الجامعية', avecExpiration: false },
      { id: 'd5', nom: 'Diplômes universitaires', nomAr: 'الشهادات الجامعية', avecExpiration: false },
      { id: 'd6', nom: 'Test de français (TCF SO, ou DELF / DALF)', nomAr: 'اختبار اللغة الفرنسية (TCF SO أو DELF / DALF)', avecExpiration: true },
      { id: 'd7', nom: 'CV', nomAr: 'السيرة الذاتية', avecExpiration: false },
      { id: 'd8', nom: "Projet d'études / lettres de motivation", nomAr: 'مشروع الدراسة ورسائل التحفيز', avecExpiration: false },
      { id: 'd9', nom: 'Justificatif de ressources (615 €/mois minimum : prise en charge, bourse…)', nomAr: 'إثبات الموارد المالية (615 يورو شهريًا على الأقل: تعهّد بالتكفّل أو منحة)', avecExpiration: false },
      { id: 'd10', nom: "Attestation d'hébergement en France", nomAr: 'شهادة الإيواء في فرنسا', avecExpiration: false },
      { id: 'd11', nom: 'Acte de naissance', nomAr: 'شهادة الميلاد', avecExpiration: false },
    ],
    frais: [
      // 20 000 DA, payés en ligne après soumission du dossier, non remboursables. Source : calendrier officiel Études en France
      // 2026-2027 (algerie.campusfrance.org, via recherche web : site injoignable depuis la session) + presse 2026. Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de dossier Campus France', nomAr: 'رسوم ملف كامبوس فرانس', organisme: 'Campus France Algérie', montant: 20000, devise: 'DZD' },
      // 13 000 DA : tarif agence (TCF SO, candidatures hors DAP), communiqué le 14/11/2026.
      { id: 'f2', nom: 'Test de français – TCF SO', nomAr: 'اختبار اللغة الفرنسية – TCF SO', organisme: "Institut français d'Algérie", montant: 13000, devise: 'DZD' },
      // 50 € (visa long séjour étudiant, tarif réduit). Source : france-visas.gouv.fr. Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Frais de visa étudiant (long séjour)', nomAr: 'رسوم تأشيرة الدراسة (إقامة طويلة)', organisme: 'Consulat de France / France-Visas', montant: 50, devise: 'EUR' },
      // 5 150 DA depuis le 15/06/2026. Capago est le seul prestataire pour la France en Algérie depuis le 08/04/2025 (fin de TLScontact).
      // Depuis le 07/10/2026 : paiement en espèces au centre le jour du dépôt. Source : annonces Capago Algérie relayées par
      // observalgerie.com / tsa-algerie.com (capago.eu injoignable depuis la session). Vérifié le 14/11/2026.
      { id: 'f4', nom: 'Frais de service Capago', nomAr: 'رسوم خدمة مركز Capago', organisme: 'Capago Algérie', montant: 5150, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: 'Test de français', nomAr: 'اجتياز اختبار اللغة الفرنسية', fraisRequis: ['f2'] },
      { id: 'e3', nom: 'Création du compte Études en France', nomAr: 'إنشاء حساب على منصة Études en France', fraisRequis: [] },
      { id: 'e4', nom: 'Saisie du dossier et choix des formations', nomAr: 'ملء الملف واختيار التكوينات', fraisRequis: [] },
      { id: 'e5', nom: 'Paiement des frais Campus France (après soumission du dossier)', nomAr: 'دفع رسوم كامبوس فرانس (بعد إرسال الملف)', fraisRequis: ['f1'] },
      { id: 'e6', nom: 'Entretien Campus France', nomAr: 'مقابلة كامبوس فرانس', fraisRequis: [] },
      { id: 'e7', nom: 'Réponses des établissements', nomAr: 'ردود المؤسسات الجامعية', fraisRequis: [] },
      { id: 'e8', nom: 'Acceptation définitive (« Je m’inscris »)', nomAr: 'القبول النهائي وتأكيد التسجيل', fraisRequis: [] },
      { id: 'e9', nom: 'Formulaire France-Visas et dépôt chez Capago', nomAr: 'ملء استمارة France-Visas وإيداع الملف لدى Capago', fraisRequis: ['f3', 'f4'] },
      { id: 'e10', nom: 'Décision du visa', nomAr: 'قرار التأشيرة', fraisRequis: [] },
    ],
  },
  {
    // Demande d'admission préalable (DAP) : 1re année de licence à l'université, candidat résidant à l'étranger = « dossier blanc »
    // (le « dossier vert » concerne les candidats résidant en France). Dépôt sur Études en France, 3 vœux au maximum,
    // date limite habituelle le 15 décembre (2026 pour la rentrée 2027). Sources : enseignementsup-recherche.gouv.fr (notices
    // dossier blanc / vert DAP 2027-2028, publiées en 10/2026), u-paris.fr, france-education-international.fr, lues via recherche web.
    // Vérifié le 14/11/2026 ; calendrier précis à reconfirmer sur algerie.campusfrance.org (injoignable depuis la session).
    id: 'm-campus-dap',
    nom: 'Campus France – 1re année (DAP)',
    couleur: '#5b7fc4',
    honoraires: 120000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport', nomAr: 'جواز السفر', avecExpiration: true },
      { id: 'd2', nom: "Photo d'identité", nomAr: 'صورة شمسية', avecExpiration: false },
      { id: 'd3', nom: 'Acte de naissance', nomAr: 'شهادة الميلاد', avecExpiration: false },
      { id: 'd4', nom: 'Relevés de notes de 2de, 1re et terminale', nomAr: 'كشوف نقاط السنوات الأولى والثانية والثالثة ثانوي', avecExpiration: false },
      { id: 'd5', nom: 'Baccalauréat + relevé de notes (ou certificat de scolarité en terminale)', nomAr: 'شهادة البكالوريا وكشف النقاط (أو شهادة التمدرس في السنة الثالثة ثانوي)', avecExpiration: false },
      { id: 'd6', nom: 'Attestation du TCF DAP', nomAr: 'شهادة اختبار TCF DAP', avecExpiration: true },
      { id: 'd7', nom: 'Lettre de motivation (projet d’études)', nomAr: 'رسالة التحفيز (مشروع الدراسة)', avecExpiration: false },
      { id: 'd8', nom: 'CV', nomAr: 'السيرة الذاتية', avecExpiration: false },
      { id: 'd9', nom: 'Justificatif de ressources (615 €/mois minimum : prise en charge, bourse…)', nomAr: 'إثبات الموارد المالية (615 يورو شهريًا على الأقل: تعهّد بالتكفّل أو منحة)', avecExpiration: false },
      { id: 'd10', nom: "Attestation d'hébergement en France", nomAr: 'شهادة الإيواء في فرنسا', avecExpiration: false },
    ],
    frais: [
      // 20 000 DA : mêmes frais Études en France que hors DAP (voir modèle Campus France). Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de dossier Campus France', nomAr: 'رسوم ملف كامبوس فرانس', organisme: 'Campus France Algérie', montant: 20000, devise: 'DZD' },
      // 19 500 DA : tarif agence (TCF DAP), communiqué le 14/11/2026.
      { id: 'f2', nom: 'Test de français – TCF DAP', nomAr: 'اختبار اللغة الفرنسية – TCF DAP', organisme: "Institut français d'Algérie", montant: 19500, devise: 'DZD' },
      // 50 € (visa long séjour étudiant). Source : france-visas.gouv.fr. Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Frais de visa étudiant (long séjour)', nomAr: 'رسوم تأشيرة الدراسة (إقامة طويلة)', organisme: 'Consulat de France / France-Visas', montant: 50, devise: 'EUR' },
      // 5 150 DA depuis le 15/06/2026 (voir modèle Campus France). Vérifié le 14/11/2026.
      { id: 'f4', nom: 'Frais de service Capago', nomAr: 'رسوم خدمة مركز Capago', organisme: 'Capago Algérie', montant: 5150, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: 'Inscription et passage du TCF DAP', nomAr: 'التسجيل في اختبار TCF DAP واجتيازه', fraisRequis: ['f2'] },
      { id: 'e3', nom: 'Création du compte Études en France', nomAr: 'إنشاء حساب على منصة Études en France', fraisRequis: [] },
      { id: 'e4', nom: 'Saisie de la DAP (dossier blanc) et choix des licences (3 vœux max.)', nomAr: 'ملء طلب القبول المسبق (الملف الأبيض) واختيار التخصصات (3 اختيارات كحد أقصى)', fraisRequis: [] },
      { id: 'e5', nom: 'Paiement des frais Campus France (avant le 15 décembre)', nomAr: 'دفع رسوم كامبوس فرانس (قبل 15 ديسمبر)', fraisRequis: ['f1'] },
      { id: 'e6', nom: 'Entretien Campus France', nomAr: 'مقابلة كامبوس فرانس', fraisRequis: [] },
      { id: 'e7', nom: 'Réponses des universités', nomAr: 'ردود الجامعات', fraisRequis: [] },
      { id: 'e8', nom: 'Acceptation définitive (« Je m’inscris »)', nomAr: 'القبول النهائي وتأكيد التسجيل', fraisRequis: [] },
      { id: 'e9', nom: 'Formulaire France-Visas et dépôt chez Capago', nomAr: 'ملء استمارة France-Visas وإيداع الملف لدى Capago', fraisRequis: ['f3', 'f4'] },
      { id: 'e10', nom: 'Décision du visa', nomAr: 'قرار التأشيرة', fraisRequis: [] },
    ],
  },
  {
    // France : Capago, seul prestataire depuis le 08/04/2025 (centres d'Alger, Oran, Annaba et autres wilayas).
    id: 'm-schengen',
    nom: 'Visa Schengen – France',
    couleur: '#7d3c98',
    honoraires: 25000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport (+ anciens visas)', nomAr: 'جواز السفر (مع التأشيرات السابقة)', avecExpiration: true },
      { id: 'd2', nom: "Photos d'identité", nomAr: 'صور شمسية', avecExpiration: false },
      { id: 'd3', nom: 'Assurance voyage (couverture 30 000 € minimum)', nomAr: 'تأمين السفر (تغطية 30.000 يورو على الأقل)', avecExpiration: true },
      { id: 'd4', nom: 'Réservation de vol', nomAr: 'حجز تذكرة الطيران', avecExpiration: false },
      { id: 'd5', nom: "Réservation d'hôtel / attestation d'accueil", nomAr: 'حجز الفندق أو شهادة الإيواء', avecExpiration: false },
      { id: 'd6', nom: 'Relevés bancaires / CCP (3 à 6 mois)', nomAr: 'كشوف الحساب البنكي أو البريدي (من 3 إلى 6 أشهر)', avecExpiration: false },
      { id: 'd7', nom: 'Attestation de travail + fiches de paie / registre de commerce', nomAr: 'شهادة العمل وكشوف الراتب أو السجل التجاري', avecExpiration: false },
      { id: 'd8', nom: 'Titre de congé', nomAr: 'سند العطلة', avecExpiration: false },
      { id: 'd9', nom: 'Fiche familiale', nomAr: 'شهادة عائلية للحالة المدنية', avecExpiration: false },
      // Depuis le 26/07/2026, l'accès aux centres Capago est réservé aux personnes munies de leur confirmation de rendez-vous.
      { id: 'd10', nom: 'Formulaire France-Visas signé + confirmation de rendez-vous Capago', nomAr: 'استمارة France-Visas موقّعة مع تأكيد موعد Capago', avecExpiration: false },
    ],
    frais: [
      // 90 € adulte (45 € de 6 à 12 ans) depuis le 11/06/2024. Source : france-visas.gouv.fr (tarifs Schengen). Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de visa (court séjour)', nomAr: 'رسوم التأشيرة (إقامة قصيرة)', organisme: 'Consulat de France', montant: 90, devise: 'EUR' },
      // 5 150 DA depuis le 15/06/2026, en espèces au centre le jour du dépôt depuis le 07/10/2026.
      // Source : annonces Capago Algérie relayées par observalgerie.com / tsa-algerie.com. Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Frais de service Capago', nomAr: 'رسوم خدمة مركز Capago', organisme: 'Capago Algérie', montant: 5150, devise: 'DZD' },
      // À CONFIRMER : prix variable selon l'assureur et la durée du séjour (exemple). Vérifié le 14/11/2026 : aucune grille officielle.
      { id: 'f3', nom: 'Assurance voyage', nomAr: 'تأمين السفر', organisme: 'Assureur', montant: 4000, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: 'Collecte des documents', nomAr: 'جمع الوثائق', fraisRequis: [] },
      { id: 'e3', nom: 'Remplissage du formulaire France-Visas', nomAr: 'ملء استمارة France-Visas', fraisRequis: [] },
      { id: 'e4', nom: 'Assurance souscrite', nomAr: 'اكتتاب تأمين السفر', fraisRequis: ['f3'] },
      { id: 'e5', nom: 'Prise de rendez-vous (Capago)', nomAr: 'حجز الموعد', fraisRequis: [] },
      { id: 'e6', nom: 'Dépôt au centre Capago', nomAr: 'إيداع الملف في مركز Capago', fraisRequis: ['f1', 'f2'] },
      { id: 'e7', nom: 'Retrait du passeport / décision', nomAr: 'استلام جواز السفر ومعرفة القرار', fraisRequis: [] },
    ],
  },
  {
    id: 'm-canada',
    nom: 'Résidence permanente – Entrée express (Canada)',
    couleur: '#d35400',
    honoraires: 350000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport', nomAr: 'جواز السفر', avecExpiration: true },
      { id: 'd2', nom: 'Résultats du test de langue (TEF Canada / TCF Canada / IELTS / CELPIP)', nomAr: 'نتائج اختبار اللغة (TEF Canada أو TCF Canada أو IELTS أو CELPIP)', avecExpiration: true },
      { id: 'd3', nom: 'Évaluation des diplômes (EDE / WES)', nomAr: 'تقييم الشهادات التعليمية (ECA / WES)', avecExpiration: true },
      { id: 'd4', nom: 'Diplômes et relevés de notes', nomAr: 'الشهادات وكشوف النقاط', avecExpiration: false },
      { id: 'd5', nom: "Lettres de référence d'employeurs", nomAr: 'رسائل مرجعية من أصحاب العمل', avecExpiration: false },
      { id: 'd6', nom: 'Preuve de fonds', nomAr: 'إثبات الأموال الكافية', avecExpiration: false },
      { id: 'd7', nom: 'Certificats de police (casier judiciaire + chaque pays de séjour de 6 mois ou plus)', nomAr: 'شهادات السوابق العدلية (الجزائر وكل بلد أقمتم فيه 6 أشهر أو أكثر)', avecExpiration: true },
      { id: 'd8', nom: "Examen médical (sur demande d'IRCC)", nomAr: 'الفحص الطبي (عند طلبه من سلطات الهجرة الكندية)', avecExpiration: true },
      { id: 'd9', nom: 'Acte de naissance', nomAr: 'شهادة الميلاد', avecExpiration: false },
      { id: 'd10', nom: 'Photos', nomAr: 'صور شمسية', avecExpiration: false },
      { id: 'd11', nom: 'Acte de mariage / fiche familiale (si applicable)', nomAr: 'عقد الزواج أو الشهادة العائلية (عند الاقتضاء)', avecExpiration: false },
    ],
    frais: [
      // À CONFIRMER : TCF Canada ≈ 37 000 à 38 200 DA selon les sources 2025-2026 (IFA). Source : presse algérienne. Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Test de langue (TCF Canada / TEF Canada)', nomAr: 'اختبار اللغة (TCF Canada أو TEF Canada)', organisme: "Institut français d'Algérie", montant: 38000, devise: 'DZD' },
      // 264 $ CA hors frais d'envoi (14 à 97 $ CA) et taxes. Source : wes.org/ca (ECA pour IRCC). Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Évaluation des diplômes WES (EDE)', nomAr: 'تقييم الشهادات لدى WES', organisme: 'WES', montant: 264, devise: 'CAD' },
      // 990 $ (traitement) + 600 $ (droit de RP) = 1 590 $ CA par demandeur principal depuis le 30/04/2026 (+ frais par conjoint/enfant).
      // Source : grille IRCC (canada.ca), relayée par cicnews.com 04/2026. Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Frais de traitement + droit de RP', nomAr: 'رسوم معالجة الطلب وحق الإقامة الدائمة', organisme: 'IRCC', montant: 1590, devise: 'CAD' },
      // 85 $ CA par personne (170 $ max. par famille). Source : canada.ca (biométrie). Vérifié le 14/11/2026.
      { id: 'f4', nom: 'Données biométriques', nomAr: 'رسوم أخذ البصمات', organisme: 'IRCC / VFS Global Alger', montant: 85, devise: 'CAD' },
      // À CONFIRMER : tarif fixé par le médecin désigné par IRCC à Alger (exemple). Vérifié le 14/11/2026 : non publié.
      { id: 'f5', nom: 'Examen médical', nomAr: 'الفحص الطبي', organisme: 'Médecin désigné par IRCC', montant: 25000, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Évaluation du profil', nomAr: 'تقييم الملف الشخصي', fraisRequis: [] },
      { id: 'e2', nom: 'Test de langue', nomAr: 'اجتياز اختبار اللغة', fraisRequis: ['f1'] },
      { id: 'e3', nom: 'Évaluation des diplômes (EDE)', nomAr: 'تقييم الشهادات التعليمية', fraisRequis: ['f2'] },
      { id: 'e4', nom: 'Création du profil Entrée express', nomAr: 'إنشاء ملف «الدخول السريع»', fraisRequis: [] },
      { id: 'e5', nom: 'Invitation à présenter une demande (ITA)', nomAr: 'استلام الدعوة لتقديم الطلب', fraisRequis: [] },
      { id: 'e6', nom: 'Constitution et envoi de la demande de RP (sous 60 jours)', nomAr: 'إعداد طلب الإقامة الدائمة وإرساله (خلال 60 يومًا)', fraisRequis: ['f3'] },
      { id: 'e7', nom: 'Biométrie', nomAr: 'أخذ البصمات', fraisRequis: ['f4'] },
      { id: 'e8', nom: 'Examen médical', nomAr: 'الفحص الطبي', fraisRequis: ['f5'] },
      { id: 'e9', nom: 'Décision / confirmation de RP', nomAr: 'القرار وتأكيد الإقامة الدائمة', fraisRequis: [] },
    ],
  },
  {
    id: 'm-italie',
    nom: 'Études en Italie',
    couleur: '#1e8449',
    honoraires: 150000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport', nomAr: 'جواز السفر', avecExpiration: true },
      { id: 'd2', nom: "Photo d'identité", nomAr: 'صورة شمسية', avecExpiration: false },
      { id: 'd3', nom: 'Baccalauréat + relevé de notes', nomAr: 'شهادة البكالوريا وكشف النقاط', avecExpiration: false },
      { id: 'd4', nom: 'Relevés et diplômes universitaires', nomAr: 'كشوف النقاط والشهادات الجامعية', avecExpiration: false },
      { id: 'd5', nom: 'Certificat de langue (italien ou anglais, B2 en général)', nomAr: 'شهادة اللغة (الإيطالية أو الإنجليزية، مستوى B2 عادةً)', avecExpiration: true },
      { id: 'd6', nom: 'CV et lettre de motivation', nomAr: 'السيرة الذاتية ورسالة التحفيز', avecExpiration: false },
      { id: 'd7', nom: 'Traductions + attestation CIMEA / Dichiarazione di valore', nomAr: 'الترجمات الرسمية وشهادة المعادلة (CIMEA أو Dichiarazione di valore)', avecExpiration: false },
      { id: 'd8', nom: 'Preuve de ressources (783,06 €/mois sur 13 mois en 2026-2027)', nomAr: 'إثبات الموارد المالية (783,06 يورو شهريًا لمدة 13 شهرًا)', avecExpiration: false },
      { id: 'd9', nom: 'Assurance santé', nomAr: 'تأمين صحي', avecExpiration: true },
      { id: 'd10', nom: 'Justificatif de logement en Italie', nomAr: 'إثبات السكن في إيطاليا', avecExpiration: false },
    ],
    frais: [
      // À CONFIRMER : variable selon l'université (souvent 0 à 100 €) (exemple). Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de candidature université', nomAr: 'رسوم الترشح لدى الجامعة', organisme: 'Université', montant: 30, devise: 'EUR' },
      // 245,90 € + TVA 54,10 € = 300 € par diplôme (délai 60 jours ouvrés ; +100 € en procédure urgente).
      // Source : cimea-diplome.it (Statement of comparability). Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Attestation CIMEA (comparabilité)', nomAr: 'شهادة المعادلة من CIMEA', organisme: 'CIMEA', montant: 300, devise: 'EUR' },
      // À CONFIRMER : tarif variable selon le traducteur (exemple). Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Traductions assermentées', nomAr: 'الترجمة الرسمية', organisme: 'Traducteur agréé', montant: 25000, devise: 'DZD' },
      // 50 € (≈ 7 700 DA) visa long séjour étudiant. Source : visa.vfsglobal.com (Italie / Algérie). Vérifié le 14/11/2026.
      { id: 'f4', nom: 'Frais de visa études', nomAr: 'رسوم تأشيرة الدراسة', organisme: "Ambassade d'Italie à Alger", montant: 50, devise: 'EUR' },
      // 40 € = 6 100 DA (TVA incluse). Source : vfsglobal.com/one-pager/italy/algeria (qui confirme aussi le visa études à 50 € = 7 700 DA).
      // Vérifié le 14/11/2026.
      { id: 'f5', nom: 'Frais de service VFS', nomAr: 'رسوم خدمة مركز VFS', organisme: 'VFS Global Alger', montant: 6100, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Choix des universités et formations', nomAr: 'اختيار الجامعات والتخصصات', fraisRequis: [] },
      { id: 'e2', nom: 'Traductions et attestation CIMEA / Dichiarazione di valore', nomAr: 'الترجمات وشهادة المعادلة', fraisRequis: ['f2', 'f3'] },
      { id: 'e3', nom: 'Candidatures aux universités', nomAr: 'الترشح لدى الجامعات', fraisRequis: ['f1'] },
      { id: 'e4', nom: "Lettre d'admission reçue", nomAr: 'استلام رسالة القبول', fraisRequis: [] },
      { id: 'e5', nom: 'Préinscription Universitaly (validée par l’université)', nomAr: 'التسجيل المسبق عبر منصة Universitaly', fraisRequis: [] },
      { id: 'e6', nom: 'Rendez-vous VFS et dépôt de la demande de visa', nomAr: 'موعد VFS وإيداع طلب التأشيرة', fraisRequis: ['f4', 'f5'] },
      { id: 'e7', nom: 'Décision du visa', nomAr: 'قرار التأشيرة', fraisRequis: [] },
      { id: 'e8', nom: 'Arrivée et permesso di soggiorno (sous 8 jours)', nomAr: 'الوصول وطلب بطاقة الإقامة (خلال 8 أيام)', fraisRequis: [] },
    ],
  },
  ...PAYS_SCHENGEN.map(modeleSchengen),
];
