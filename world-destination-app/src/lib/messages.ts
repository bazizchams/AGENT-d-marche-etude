import { impayesExigibles, montant, progression } from './regles';
import type { Client, Dossier, ParametresAgence } from './types';

export type TypeMessage = 'manquants' | 'refuse' | 'paiement' | 'etape' | 'rdv' | 'acces';

export const LIBELLES_MESSAGES: Record<TypeMessage, string> = {
  manquants: 'Documents manquants',
  refuse: 'Documents refusés',
  paiement: 'Rappel de paiement',
  etape: 'Avancement du dossier',
  rdv: 'Rendez-vous',
  acces: 'Accès à l’espace client',
};

/** Libellé dans la langue du message : arabe si disponible, sinon français. */
const nomLangue = (x: { nom: string; nomAr?: string }, ar: boolean) => (ar && x.nomAr) || x.nom;

/** Libellé arabe d'une ligne d'impayé (échéance d'honoraires ou frais de procédure). */
function libelleImpayeAr(d: Dossier, libelle: string): string {
  const e = d.echeances.find((x) => x.libelle === libelle);
  if (e) return e.moment === 'depot' ? 'أتعاب الوكالة – 50٪ عند إيداع الملف' : 'أتعاب الوكالة – 50٪ عند نهاية الإجراءات';
  const f = d.frais.find((x) => x.nom === libelle);
  return f ? nomLangue(f, true) : libelle;
}

/** Message pré-rédigé dans la langue du client (français ou arabe). */
export function rediger(type: TypeMessage, c: Client, d: Dossier, p: ParametresAgence, lienEspace: string): string {
  const ar = c.langue === 'ar';
  const agence = p.nom || 'World Destination';
  const salut = ar ? `السلام عليكم ${c.prenom}،` : `Bonjour ${c.prenom},`;
  const fin = ar ? `\n\nمع خالص التحيات،\nوكالة ${agence}` : `\n\n${agence}`;
  const liste = (l: string[]) => l.map((x) => `• ${x}`).join('\n');

  switch (type) {
    case 'manquants': {
      const docs = d.documents.filter((x) => x.statut === 'manquant').map((x) => nomLangue(x, ar));
      if (!docs.length) return ar ? `${salut}\nيسعدنا إعلامكم بأن ملفكم رقم ${d.numero} مكتمل. شكرًا لكم على ثقتكم.${fin}` : `${salut}\nVotre dossier ${d.numero} est complet, merci.${fin}`;
      return ar
        ? `${salut}\nلاستكمال ملفكم رقم ${d.numero}، نرجو منكم تزويدنا بالوثائق التالية:\n${liste(docs)}\n\nيمكنكم إرسالها مباشرة من فضائكم الخاص: ${lienEspace}\nأو إحضارها إلى الوكالة.${fin}`
        : `${salut}\nPour compléter votre dossier ${d.numero} (${d.intitule}), merci de nous fournir :\n${liste(docs)}\n\nVous pouvez les envoyer depuis votre espace : ${lienEspace}${fin}`;
    }
    case 'refuse': {
      const docs = d.documents.filter((x) => x.statut === 'refuse').map((x) => `${nomLangue(x, ar)} : ${x.motifRefus ?? ''}`);
      return ar
        ? `${salut}\nنعتذر، لم نتمكّن من قبول الوثائق التالية في ملفكم رقم ${d.numero}:\n${liste(docs)}\n\nنرجو منكم إعادة إرسالها بعد التصحيح عبر فضائكم الخاص: ${lienEspace}${fin}`
        : `${salut}\nLes documents suivants de votre dossier ${d.numero} n'ont pas pu être acceptés :\n${liste(docs)}\n\nMerci de les renvoyer depuis votre espace : ${lienEspace}${fin}`;
    }
    case 'paiement': {
      const lignes = impayesExigibles(d).map((x) => `${ar ? libelleImpayeAr(d, x.libelle) : x.libelle} : ${montant(x.reste, x.devise)}`);
      return ar
        ? `${salut}\nنودّ تذكيركم بالمبالغ المستحقة لملفكم رقم ${d.numero}:\n${liste(lignes)}\n\nنذكّركم بأن مصاريف الإجراءات تُدفع كاملةً مسبقًا، ولا يمكن مواصلة المرحلة المعنية قبل تسديدها.${fin}`
        : `${salut}\nPetit rappel concernant votre dossier ${d.numero}, montants à régler :\n${liste(lignes)}\n\nLes frais de procédure sont à régler à 100 % d'avance.${fin}`;
    }
    case 'etape': {
      const pr = progression(d);
      const derniere = [...d.etapes].reverse().find((e) => e.faite);
      return ar
        ? `${salut}\nإليكم آخر مستجدات ملفكم رقم ${d.numero}: تم إنجاز ${pr.faites} من أصل ${pr.total} مراحل.\n${derniere ? `آخر مرحلة تم إنجازها: ${nomLangue(derniere, true)}\n` : ''}${pr.courante ? `المرحلة الحالية: ${nomLangue(pr.courante, true)}` : 'تم إنجاز جميع المراحل بنجاح.'}\n\nيمكنكم متابعة ملفكم في أي وقت عبر: ${lienEspace}${fin}`
        : `${salut}\nVotre dossier ${d.numero} avance : ${pr.faites}/${pr.total} étapes.\n${derniere ? `Dernière étape terminée : ${derniere.nom}\n` : ''}${pr.courante ? `Étape en cours : ${pr.courante.nom}` : 'Toutes les étapes sont terminées.'}\n\nSuivez votre dossier : ${lienEspace}${fin}`;
    }
    case 'rdv': {
      if (!d.rdv) return '';
      const quand = new Date(d.rdv.date).toLocaleString(ar ? 'ar-DZ' : 'fr-FR', { dateStyle: 'full', timeStyle: 'short' });
      return ar
        ? `${salut}\nنعلمكم بأن موعدكم محدد كما يلي:\nالتاريخ والساعة: ${quand}\nالمكان: ${d.rdv.lieu}\n\nنرجو منكم الحضور قبل الموعد بـ 30 دقيقة، مع جواز السفر وجميع الوثائق الأصلية.${fin}`
        : `${salut}\nVotre rendez-vous : ${quand}\nLieu : ${d.rdv.lieu}\nMerci de vous présenter 30 minutes avant avec votre passeport et tous les originaux.${fin}`;
    }
    case 'acces':
      return ar
        ? `${salut}\nيمكنكم من الآن متابعة ملفكم رقم ${d.numero} عبر فضائكم الخاص: المرحلة الحالية، الوثائق الناقصة والمبالغ المتبقية.\n${lienEspace}${fin}`
        : `${salut}\nVous pouvez désormais suivre votre dossier ${d.numero} (étape, documents manquants, reste à payer) depuis votre espace personnel :\n${lienEspace}${fin}`;
  }
}

export function lienWhatsApp(telephone: string, texte: string) {
  const num = telephone.replace(/\D/g, '').replace(/^0/, '213');
  return `https://wa.me/${num}?text=${encodeURIComponent(texte)}`;
}

/** Adresse de l'espace client (sera servie par la version en ligne). */
export function lienEspaceClient(d: Dossier) {
  return `${location.origin}${location.pathname}#/espace/${d.id}`;
}
