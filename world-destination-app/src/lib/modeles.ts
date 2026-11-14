import type { ModeleDossier } from './types';

/**
 * Modèles pré-remplis.
 * - Les HONORAIRES de l'agence sont des EXEMPLES : l'administrateur les corrige dans Paramètres › Types de dossiers.
 * - Les FRAIS DE TIERS ont été vérifiés le 14/11/2026 (source en commentaire à côté de chaque frais).
 *   Les montants marqués « À CONFIRMER » n'ont pas pu être vérifiés sur une source officielle : valeur raisonnable.
 * - `nomAr` : libellé affiché dans l'espace client et les messages quand la langue est l'arabe.
 */
export const MODELES_INITIAUX: ModeleDossier[] = [
  {
    id: 'm-ausbildung',
    nom: 'Ausbildung (Allemagne)',
    couleur: '#c0392b',
    honoraires: 200000,
    deviseHonoraires: 'DZD',
    actif: true,
    documents: [
      { id: 'd1', nom: 'Passeport (valide pendant toute la formation)', nomAr: 'جواز السفر (صالح طوال مدة التكوين)', avecExpiration: true },
      { id: 'd2', nom: "Photos d'identité biométriques", nomAr: 'صور شمسية بيومترية', avecExpiration: false },
      { id: 'd3', nom: 'Baccalauréat + relevé de notes', nomAr: 'شهادة البكالوريا وكشف النقاط', avecExpiration: false },
      { id: 'd4', nom: 'Diplômes / attestations de formation', nomAr: 'الشهادات وشهادات التكوين', avecExpiration: false },
      { id: 'd5', nom: "Certificat d'allemand B1 complet (Goethe, telc, ÖSD)", nomAr: 'شهادة اللغة الألمانية مستوى B1 كاملة (Goethe أو telc أو ÖSD)', avecExpiration: false },
      { id: 'd6', nom: 'Attestations de travail / stages', nomAr: 'شهادات العمل أو التربصات', avecExpiration: false },
      { id: 'd7', nom: 'Extrait de casier judiciaire (bulletin n° 3)', nomAr: 'صحيفة السوابق العدلية (البطاقة رقم 3)', avecExpiration: true },
      { id: 'd8', nom: 'Documents légalisés + traductions assermentées en allemand', nomAr: 'الوثائق المصادق عليها مع ترجمتها الرسمية إلى الألمانية', avecExpiration: false },
      { id: 'd9', nom: "Contrat d'Ausbildung signé", nomAr: 'عقد التكوين المهني (Ausbildung) موقّع', avecExpiration: false },
      { id: 'd10', nom: "Justificatif de ressources (rémunération d'apprentissage ou compte bloqué)", nomAr: 'إثبات الموارد المالية (منحة التكوين أو حساب بنكي مجمّد)', avecExpiration: false },
      { id: 'd11', nom: "Assurance maladie (jusqu'à l'affiliation en Allemagne)", nomAr: 'تأمين صحي (إلى غاية الانتساب إلى التأمين في ألمانيا)', avecExpiration: true },
    ],
    frais: [
      // À CONFIRMER : tarif variable selon le traducteur et le nombre de pages (exemple). Vérifié le 14/11/2026 : aucune grille officielle.
      { id: 'f1', nom: 'Traductions assermentées', nomAr: 'الترجمة الرسمية', organisme: 'Traducteur agréé', montant: 30000, devise: 'DZD' },
      // 75 € (visa national D, adulte). Source : make-it-in-germany.com (frais de visa national) + guides 2026. Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Frais de visa national (D)', nomAr: 'رسوم التأشيرة الوطنية (D)', organisme: "Ambassade d'Allemagne à Alger", montant: 75, devise: 'EUR' },
      // À CONFIRMER : l'ambassade d'Allemagne à Alger passe par VFS Global (et non TLScontact) ; frais de service indexés sur le taux
      // de change mensuel, montant non publié. Sans objet si le dépôt se fait directement à l'ambassade. Source : visa.vfsglobal.com
      // (page Allemagne / Algérie). Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Frais de service du centre de visa', nomAr: 'رسوم خدمة مركز التأشيرات', organisme: 'VFS Global Alger', montant: 6000, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: "Certificat d'allemand B1", nomAr: 'الحصول على شهادة اللغة الألمانية B1', fraisRequis: [] },
      { id: 'e3', nom: 'Légalisation et traduction des documents', nomAr: 'المصادقة على الوثائق وترجمتها', fraisRequis: ['f1'] },
      { id: 'e4', nom: 'Rédaction CV et lettres de motivation (allemand)', nomAr: 'إعداد السيرة الذاتية ورسائل التحفيز بالألمانية', fraisRequis: [] },
      { id: 'e5', nom: "Recherche d'offres et candidatures", nomAr: 'البحث عن عروض التكوين وإرسال الترشيحات', fraisRequis: [] },
      { id: 'e6', nom: 'Entretiens avec les employeurs', nomAr: 'المقابلات مع المؤسسات المكوِّنة', fraisRequis: [] },
      { id: 'e7', nom: "Contrat d'Ausbildung signé", nomAr: 'توقيع عقد التكوين', fraisRequis: [] },
      { id: 'e8', nom: 'Demande de visa en ligne (Auslandsportal) et dépôt au rendez-vous', nomAr: 'طلب التأشيرة عبر الإنترنت وإيداع الملف في الموعد', fraisRequis: ['f2', 'f3'] },
      { id: 'e9', nom: "Approbation de l'Agence fédérale pour l'emploi (BA)", nomAr: 'موافقة الوكالة الفيدرالية الألمانية للتشغيل', fraisRequis: [] },
      { id: 'e10', nom: 'Décision du visa', nomAr: 'قرار التأشيرة', fraisRequis: [] },
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
      { id: 'd6', nom: 'Test de français (TCF tout public / TCF DAP, ou DELF / DALF)', nomAr: 'اختبار اللغة الفرنسية (TCF أو DELF / DALF)', avecExpiration: true },
      { id: 'd7', nom: 'CV', nomAr: 'السيرة الذاتية', avecExpiration: false },
      { id: 'd8', nom: "Projet d'études / lettres de motivation", nomAr: 'مشروع الدراسة ورسائل التحفيز', avecExpiration: false },
      { id: 'd9', nom: 'Justificatif de ressources (615 €/mois minimum : prise en charge, bourse…)', nomAr: 'إثبات الموارد المالية (615 يورو شهريًا على الأقل: تعهّد بالتكفّل أو منحة)', avecExpiration: false },
      { id: 'd10', nom: "Attestation d'hébergement en France", nomAr: 'شهادة الإيواء في فرنسا', avecExpiration: false },
      { id: 'd11', nom: 'Acte de naissance', nomAr: 'شهادة الميلاد', avecExpiration: false },
    ],
    frais: [
      // 20 000 DA, payés en ligne après soumission du dossier, non remboursables. Source : calendrier officiel Études en France
      // 2026-2027 (algerie.campusfrance.org) + presse algérienne 2026. Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de dossier Campus France', nomAr: 'رسوم ملف كامبوس فرانس', organisme: 'Campus France Algérie', montant: 20000, devise: 'DZD' },
      // À CONFIRMER : grille IFA non publiée en ligne pour 2026. Relevés : TCF TP ≈ 13 000 DA, TCF DAP ≈ 19 500 DA (+ frais de
      // service de l'inscription). Source : presse algérienne (algerie360). Vérifié le 14/11/2026.
      { id: 'f2', nom: 'Test TCF', nomAr: 'اختبار TCF', organisme: "Institut français d'Algérie", montant: 17000, devise: 'DZD' },
      // 50 € (visa long séjour étudiant, tarif réduit). Source : france-visas.gouv.fr. Vérifié le 14/11/2026.
      { id: 'f3', nom: 'Frais de visa étudiant (long séjour)', nomAr: 'رسوم تأشيرة الدراسة (إقامة طويلة)', organisme: 'Consulat de France / France-Visas', montant: 50, devise: 'EUR' },
      // 5 150 DA depuis le 15/06/2026. Capago est le seul prestataire pour la France en Algérie depuis le 08/04/2025 (fin de TLScontact).
      // Depuis le 07/10/2026 : paiement en espèces au centre le jour du dépôt. Source : annonces Capago Algérie relayées par
      // observalgerie.com / tsa-algerie.com. Vérifié le 14/11/2026.
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
    id: 'm-schengen',
    nom: 'Visa Schengen',
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
      { id: 'd10', nom: 'Formulaire de demande signé + confirmation de rendez-vous', nomAr: 'استمارة الطلب موقّعة مع تأكيد الموعد', avecExpiration: false },
    ],
    frais: [
      // 90 € adulte (45 € enfant de 6 à 12 ans) depuis le 11/06/2024. Source : france-visas.gouv.fr (tarifs Schengen). Vérifié le 14/11/2026.
      { id: 'f1', nom: 'Frais de visa (court séjour)', nomAr: 'رسوم التأشيرة (إقامة قصيرة)', organisme: 'Consulat', montant: 90, devise: 'EUR' },
      // 5 150 DA = Capago (France, depuis le 15/06/2026). Les autres pays varient : VFS ≈ 2 900 à 6 000 DA, BLS (Espagne) ≈ 2 560 DA.
      // Sources : annonces Capago Algérie (observalgerie.com), pages VFS Algérie. Vérifié le 14/11/2026. À ajuster selon le pays.
      { id: 'f2', nom: 'Frais de service du centre de visa', nomAr: 'رسوم خدمة مركز التأشيرات', organisme: 'Capago (France) / VFS / TLScontact / BLS', montant: 5150, devise: 'DZD' },
      // À CONFIRMER : prix variable selon l'assureur et la durée du séjour (exemple). Vérifié le 14/11/2026 : aucune grille officielle.
      { id: 'f3', nom: 'Assurance voyage', nomAr: 'تأمين السفر', organisme: 'Assureur', montant: 4000, devise: 'DZD' },
    ],
    etapes: [
      { id: 'e1', nom: 'Ouverture du dossier', nomAr: 'فتح الملف', fraisRequis: [] },
      { id: 'e2', nom: 'Collecte des documents', nomAr: 'جمع الوثائق', fraisRequis: [] },
      { id: 'e3', nom: 'Remplissage du formulaire', nomAr: 'ملء استمارة الطلب', fraisRequis: [] },
      { id: 'e4', nom: 'Assurance souscrite', nomAr: 'اكتتاب تأمين السفر', fraisRequis: ['f3'] },
      { id: 'e5', nom: 'Prise de rendez-vous', nomAr: 'حجز الموعد', fraisRequis: [] },
      { id: 'e6', nom: 'Dépôt au centre de visa', nomAr: 'إيداع الملف في مركز التأشيرات', fraisRequis: ['f1', 'f2'] },
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
      // À CONFIRMER : frais de service VFS Italie non lus sur la page officielle ; ≈ 6 000 DA selon des guides 2026. Vérifié le 14/11/2026.
      { id: 'f5', nom: 'Frais de service VFS', nomAr: 'رسوم خدمة مركز VFS', organisme: 'VFS Global Alger', montant: 6000, devise: 'DZD' },
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
];
