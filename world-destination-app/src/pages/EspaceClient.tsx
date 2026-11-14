import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Barre, notifier, tenter } from '../components/ui';
import { TAILLE_MAX, TYPES_ACCEPTES } from '../lib/fichiers';
import { echeanceExigible, montant, progression, resteEcheance, resteFrais } from '../lib/regles';
import { televerserParClient, useBase, useUtilisateur } from '../lib/store';
import type { Dossier, Evenement, Langue, StatutDocument } from '../lib/types';

/** Libellé affiché selon la langue : arabe si disponible, sinon français. */
const libelle = (x: { nom: string; nomAr?: string }, ar: boolean) => (ar && x.nomAr) || x.nom;

/** Libellés arabes génériques du journal, quand l'événement n'a pas de version arabe. */
const JOURNAL_AR: Record<Evenement['type'], string> = {
  creation: 'تم فتح الملف',
  document: 'تحديث يخص وثائقكم',
  paiement: 'تم تسجيل دفعة',
  etape: 'تم إنجاز مرحلة من ملفكم',
  note: 'ملاحظة من الوكالة',
  rdv: 'تم تحديد موعد أو تعديله',
  statut: 'تم تحديث حالة الملف',
  message: 'رسالة من الوكالة',
};

/**
 * Texte arabe d'un événement du journal visible par le client.
 * Reconnaît les textes produits par le logiciel pour y mettre le nom arabe du document / de l'étape ;
 * les motifs de refus restent tels quels. À défaut, libellé générique selon le type.
 */
function journalArabe(e: Evenement, d: Dossier): React.ReactNode {
  if (e.texteAr) return e.texteAr;
  const t = e.texte;
  if (e.type === 'etape') {
    const m = /^Étape terminée : (.+)$/.exec(t);
    const et = m && d.etapes.find((x) => x.nom === m[1]);
    if (et) return <>تم إنجاز المرحلة: <bdi>{libelle(et, true)}</bdi></>;
  }
  if (e.type === 'document') {
    const doc = [...d.documents].sort((a, b) => b.nom.length - a.nom.length).find((x) => t.startsWith(`${x.nom} : `));
    if (doc) {
      const nom = <bdi>{libelle(doc, true)}</bdi>;
      const reste = t.slice(doc.nom.length + 3);
      if (reste.startsWith('reçu à l')) return <>تم استلام الوثيقة: {nom}</>;
      if (reste.startsWith('envoyé par le client')) return <>تم إرسال الوثيقة: {nom} (قيد المراجعة)</>;
      if (reste.startsWith('validé')) return <>تم قبول الوثيقة: {nom}</>;
      if (reste.startsWith('refusé')) {
        const motif = reste.replace(/^refusé\s*–?\s*/, '');
        return <>الوثيقة غير مقبولة: {nom}{motif && <> – <bdi>{motif}</bdi></>}</>;
      }
    }
    const m = /^Document demandé en plus : (.+)$/.exec(t);
    if (m) return <>وثيقة إضافية مطلوبة: <bdi>{m[1]}</bdi></>;
  }
  if (e.type === 'paiement') {
    if (/annulé/.test(t)) return 'تم إلغاء دفعة';
    const m = /^Encaissement (.+?)(?: –| \(reçu)/.exec(t);
    if (m) return <>تم تسجيل دفعة بقيمة <bdi>{m[1]}</bdi></>;
  }
  return JOURNAL_AR[e.type];
}

const T = {
  fr: {
    bonjour: 'Bonjour', dossier: 'Votre dossier', avancement: 'Avancement', etapeCours: 'Étape en cours', toutFait: 'Toutes les étapes sont terminées',
    documents: 'Vos documents', manquants: 'document(s) à fournir', paiements: 'Vos paiements', reste: 'Reste à payer', aJour: 'Vous êtes à jour',
    envoyer: 'Envoyer', renvoyer: 'Renvoyer', motif: 'Motif', honoraires: "Honoraires de l'agence", frais: 'Frais de procédure (payables d’avance)',
    paye: 'Payé', aPayer: 'À payer', fin: 'À la fin de la procédure', historique: 'Ce qui a été fait', rdv: 'Votre rendez-vous',
    statut: { manquant: 'À fournir', envoye: 'Reçu, en vérification', valide: 'Validé', refuse: 'À renvoyer' } as Record<StatutDocument, string>,
    aide: 'Prenez une photo nette ou envoyez un PDF (10 Mo maximum).', envoye: 'Document envoyé. L’agence va le vérifier.', introuvable: 'Ce lien n’est pas valide. Contactez l’agence.',
    lienApercu: 'Aperçu de l’espace client (démonstration). Dans la version en ligne, le client y accède par un lien reçu par e-mail.', retour: 'Retour au dossier (personnel)',
  },
  ar: {
    bonjour: 'مرحبًا', dossier: 'ملفكم', avancement: 'تقدّم الملف', etapeCours: 'المرحلة الحالية', toutFait: 'تم إنجاز جميع المراحل',
    documents: 'وثائقكم', manquants: 'وثيقة مطلوبة', paiements: 'مدفوعاتكم', reste: 'المبلغ المتبقي', aJour: 'لا توجد مبالغ مستحقة',
    envoyer: 'إرسال', renvoyer: 'إعادة الإرسال', motif: 'السبب', honoraires: 'أتعاب الوكالة', frais: 'مصاريف الإجراءات (تُدفع مسبقًا)',
    paye: 'مدفوع', aPayer: 'للدفع', fin: 'عند نهاية الإجراءات', historique: 'ما تم إنجازه', rdv: 'موعدكم',
    statut: { manquant: 'مطلوبة', envoye: 'قيد المراجعة', valide: 'مقبولة', refuse: 'يجب إعادة إرسالها' } as Record<StatutDocument, string>,
    aide: 'التقطوا صورة واضحة أو أرسلوا ملف PDF (10 ميغابايت كحد أقصى).', envoye: 'تم إرسال الوثيقة. ستقوم الوكالة بمراجعتها.', introuvable: 'هذا الرابط غير صالح. يرجى الاتصال بالوكالة.',
    lienApercu: 'معاينة فضاء الزبون (نسخة تجريبية).', retour: 'العودة إلى الملف',
  },
};
const CLS: Record<StatutDocument, string> = { manquant: 'b-gris', envoye: 'b-bleu', valide: 'b-vert', refuse: 'b-rouge' };

export default function EspaceClient() {
  const { id } = useParams();
  const base = useBase();
  const staff = useUtilisateur();
  const d = base.dossiers.find((x) => x.id === id);
  const c = d && base.clients.find((x) => x.id === d.clientId);
  const [langue, setLangue] = useState<Langue>(c?.langue ?? 'fr');
  const input = useRef<HTMLInputElement>(null);
  const cible = useRef('');
  const t = T[langue];
  const ar = langue === 'ar';
  const loc = ar ? 'ar-DZ' : 'fr-FR';

  if (!d || !c) return <div className="connexion"><div className="carte">{t.introuvable}</div></div>;
  const p = progression(d);
  const manquants = d.documents.filter((x) => x.statut === 'manquant' || x.statut === 'refuse').length;
  const lignes = [
    ...d.echeances.map((e) => ({ id: e.id, lib: e.moment === 'depot' ? (ar ? 'أتعاب – 50٪ عند إيداع الملف' : e.libelle) : (ar ? 'أتعاب – 50٪ عند نهاية الإجراءات' : e.libelle), groupe: 'h', montant: e.montant, reste: resteEcheance(d, e.id), devise: e.devise, exig: echeanceExigible(d, e.moment) })),
    ...d.frais.map((f) => ({ id: f.id, lib: libelle(f, ar), groupe: 'f', montant: f.montant, reste: resteFrais(d, f), devise: f.devise, exig: true })),
  ];
  const resteTotal = lignes.filter((l) => l.exig && l.reste > 0);

  const choisir = (docId: string) => { cible.current = docId; input.current?.click(); };
  const fichier = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > TAILLE_MAX) { notifier(t.aide, true); return; }
    await tenter(() => televerserParClient(d.id, cible.current, f), t.envoye);
  };

  return (
    <div className={ar ? 'rtl' : ''} dir={ar ? 'rtl' : 'ltr'} lang={langue} style={{ minHeight: '100vh', background: 'var(--fond)' }}>
      <input ref={input} type="file" accept={TYPES_ACCEPTES} hidden onChange={fichier} />
      {staff && (
        <div className="alerte alerte-bleu" style={{ borderRadius: 0, margin: 0, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }} dir="ltr">
          <span>{T.fr.lienApercu}</span><Link to={`/dossiers/${d.id}`}>← {T.fr.retour}</Link>
        </div>
      )}
      <header style={{ background: 'var(--primaire-fonce)', color: '#fff', padding: '14px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="./logo.png" alt="" style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff' }} />
          <b style={{ flex: 1 }}>World Destination</b>
          <button onClick={() => setLangue(ar ? 'fr' : 'ar')} style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>{ar ? 'Français' : 'العربية'}</button>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 60px', display: 'grid', gap: 16 }}>
        <div>
          <h1>{t.bonjour} {c.prenom}</h1>
          <div className="muted">{t.dossier} : {d.intitule} · {d.numero}</div>
        </div>

        <section className="carte">
          <h2>{t.avancement}</h2>
          <Barre pourcent={p.pourcent} />
          <p style={{ marginBottom: 0 }}>{p.courante ? <>{t.etapeCours} : <b>{libelle(p.courante, ar)}</b></> : <b>{t.toutFait}</b>} <span className="muted">({p.faites}/{p.total})</span></p>
          {d.rdv && <div className="alerte alerte-bleu" style={{ marginTop: 12, marginBottom: 0 }}>📅 {t.rdv} : <b>{new Date(d.rdv.date).toLocaleString(loc, { dateStyle: 'full', timeStyle: 'short' })}</b> – {d.rdv.lieu}</div>}
        </section>

        <section className="carte">
          <h2>{t.documents} {manquants > 0 && <span className="badge b-orange">{manquants} {t.manquants}</span>}</h2>
          <p className="petit muted">{t.aide}</p>
          <ul className="liste-simple">
            {d.documents.map((doc) => (
              <li key={doc.id}>
                <div>
                  <b>{libelle(doc, ar)}</b>
                  {doc.statut === 'refuse' && <div className="petit" style={{ color: 'var(--rouge)' }}>{t.motif} : {doc.motifRefus}</div>}
                </div>
                <div className="actions">
                  <span className={`badge ${CLS[doc.statut]}`}>{t.statut[doc.statut]}</span>
                  {(doc.statut === 'manquant' || doc.statut === 'refuse') && d.statut === 'en_cours' && (
                    <button className="btn-petit btn-primaire" onClick={() => choisir(doc.id)}>⬆ {doc.statut === 'refuse' ? t.renvoyer : t.envoyer}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="carte">
          <h2>{t.paiements}</h2>
          {resteTotal.length === 0
            ? <div className="alerte alerte-bleu">✔ {t.aJour}</div>
            : <div className="alerte alerte-orange">{t.reste} : <b>{resteTotal.map((l, i) => <span key={l.id}>{i > 0 && ' + '}<bdi>{montant(l.reste, l.devise)}</bdi></span>)}</b></div>}
          {(['h', 'f'] as const).map((g) => (
            <div key={g} style={{ marginTop: 10 }}>
              <h3>{g === 'h' ? t.honoraires : t.frais}</h3>
              <ul className="liste-simple">
                {lignes.filter((l) => l.groupe === g).map((l) => (
                  <li key={l.id}>
                    <span>{l.lib}</span>
                    <span className="actions">
                      <bdi className="num">{montant(l.montant, l.devise)}</bdi>
                      {l.reste === 0 ? <span className="badge b-vert">{t.paye}</span> : l.exig ? <span className="badge b-orange">{t.aPayer}</span> : <span className="badge b-gris">{t.fin}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="carte">
          <h2>{t.historique}</h2>
          <ul className="journal">
            {[...d.journal].filter((e) => !e.interne).reverse().slice(0, 15).map((e) => (
              <li key={e.id}><div style={{ flex: 1 }}><div>{ar ? journalArabe(e, d) : e.texte}</div><div className="petit muted">{new Date(e.date).toLocaleDateString(loc)}</div></div></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
