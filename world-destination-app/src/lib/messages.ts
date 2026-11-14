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

/** Message pré-rédigé dans la langue du client (français ou arabe). */
export function rediger(type: TypeMessage, c: Client, d: Dossier, p: ParametresAgence, lienEspace: string): string {
  const ar = c.langue === 'ar';
  const agence = p.nom || 'World Destination';
  const salut = ar ? `السلام عليكم ${c.prenom}،` : `Bonjour ${c.prenom},`;
  const fin = ar ? `\n\nوكالة ${agence}` : `\n\n${agence}`;
  const liste = (l: string[]) => l.map((x) => `• ${x}`).join('\n');

  switch (type) {
    case 'manquants': {
      const docs = d.documents.filter((x) => x.statut === 'manquant').map((x) => x.nom);
      if (!docs.length) return ar ? `${salut}\nملفكم ${d.numero} مكتمل، شكرًا لكم.${fin}` : `${salut}\nVotre dossier ${d.numero} est complet, merci.${fin}`;
      return ar
        ? `${salut}\nلإكمال ملفكم ${d.numero} (${d.intitule})، نرجو تزويدنا بالوثائق التالية:\n${liste(docs)}\n\nيمكنكم إرسالها عبر فضائكم: ${lienEspace}${fin}`
        : `${salut}\nPour compléter votre dossier ${d.numero} (${d.intitule}), merci de nous fournir :\n${liste(docs)}\n\nVous pouvez les envoyer depuis votre espace : ${lienEspace}${fin}`;
    }
    case 'refuse': {
      const docs = d.documents.filter((x) => x.statut === 'refuse').map((x) => `${x.nom} : ${x.motifRefus ?? ''}`);
      return ar
        ? `${salut}\nالوثائق التالية في ملفكم ${d.numero} غير مقبولة:\n${liste(docs)}\n\nنرجو إعادة إرسالها عبر فضائكم: ${lienEspace}${fin}`
        : `${salut}\nLes documents suivants de votre dossier ${d.numero} n'ont pas pu être acceptés :\n${liste(docs)}\n\nMerci de les renvoyer depuis votre espace : ${lienEspace}${fin}`;
    }
    case 'paiement': {
      const lignes = impayesExigibles(d).map((x) => `${x.libelle} : ${montant(x.reste, x.devise)}`);
      return ar
        ? `${salut}\nنذكّركم بالمبالغ المستحقة لملفكم ${d.numero}:\n${liste(lignes)}\n\nتُدفع مصاريف الإجراءات مسبقًا بنسبة 100٪.${fin}`
        : `${salut}\nPetit rappel concernant votre dossier ${d.numero}, montants à régler :\n${liste(lignes)}\n\nLes frais de procédure sont à régler à 100 % d'avance.${fin}`;
    }
    case 'etape': {
      const pr = progression(d);
      const derniere = [...d.etapes].reverse().find((e) => e.faite);
      return ar
        ? `${salut}\nتقدّم ملفكم ${d.numero}: ${pr.faites}/${pr.total} مراحل.\n${derniere ? `آخر مرحلة منجزة: ${derniere.nom}\n` : ''}${pr.courante ? `المرحلة الحالية: ${pr.courante.nom}` : 'تم إنجاز جميع المراحل.'}\n\nتابعوا ملفكم: ${lienEspace}${fin}`
        : `${salut}\nVotre dossier ${d.numero} avance : ${pr.faites}/${pr.total} étapes.\n${derniere ? `Dernière étape terminée : ${derniere.nom}\n` : ''}${pr.courante ? `Étape en cours : ${pr.courante.nom}` : 'Toutes les étapes sont terminées.'}\n\nSuivez votre dossier : ${lienEspace}${fin}`;
    }
    case 'rdv': {
      if (!d.rdv) return '';
      const quand = new Date(d.rdv.date).toLocaleString(ar ? 'ar-DZ' : 'fr-FR', { dateStyle: 'full', timeStyle: 'short' });
      return ar
        ? `${salut}\nموعدكم: ${quand}\nالمكان: ${d.rdv.lieu}\nالرجاء الحضور قبل الموعد بـ 30 دقيقة مع جواز السفر وجميع الوثائق الأصلية.${fin}`
        : `${salut}\nVotre rendez-vous : ${quand}\nLieu : ${d.rdv.lieu}\nMerci de vous présenter 30 minutes avant avec votre passeport et tous les originaux.${fin}`;
    }
    case 'acces':
      return ar
        ? `${salut}\nيمكنكم الآن متابعة ملفكم ${d.numero} (المرحلة، الوثائق الناقصة، المبالغ المتبقية) عبر فضائكم الخاص:\n${lienEspace}${fin}`
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
