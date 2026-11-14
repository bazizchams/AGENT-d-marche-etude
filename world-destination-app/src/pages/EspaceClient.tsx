import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icone, type NomIcone } from '../components/Icone';
import { EntreePage, StaggerListe } from '../components/Motion';
import { Barre, notifier, tenter } from '../components/ui';
import { TAILLE_MAX, TYPES_ACCEPTES, typeAutorise } from '../lib/fichiers';
import { echeanceExigible, montant, progression, resteEcheance, resteFrais } from '../lib/regles';
import { modeEnLigne, televerserParClient, useBase, useUtilisateur } from '../lib/store';
import EcranConnexion from '../lib/supabase/EcranConnexion';
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

const ICONE_JOURNAL: Record<Evenement['type'], NomIcone> = {
  creation: 'dossier',
  document: 'fichier',
  paiement: 'paiement',
  etape: 'coche',
  note: 'note',
  rdv: 'calendrier',
  statut: 'info',
  message: 'message',
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
    bonjour: 'Bonjour', dossier: 'Votre dossier', sousTitre: 'Suivi de votre dossier',
    avancement: 'Avancement', etapeCours: 'Étape en cours', toutFait: 'Toutes les étapes sont terminées',
    documents: 'Vos documents', manquants: 'document(s) à fournir', paiements: 'Vos paiements', reste: 'Reste à payer', aJour: 'Vous êtes à jour',
    envoyer: 'Envoyer', renvoyer: 'Renvoyer', motif: 'Motif', honoraires: "Honoraires de l'agence", frais: 'Frais de procédure (payables d’avance)',
    paye: 'Payé', aPayer: 'À payer', fin: 'À la fin de la procédure', historique: 'Ce qui a été fait', rdv: 'Votre rendez-vous',
    statut: { manquant: 'À fournir', envoye: 'Reçu, en vérification', valide: 'Validé', refuse: 'À renvoyer' } as Record<StatutDocument, string>,
    aide: 'Prenez une photo nette ou envoyez un PDF (10 Mo maximum).', envoye: 'Document envoyé. L’agence va le vérifier.', introuvable: 'Ce lien n’est pas valide. Contactez l’agence.',
    lienApercu: 'Aperçu de l’espace client (démonstration). Dans la version en ligne, le client y accède par un lien reçu par e-mail.', retour: 'Retour au dossier (personnel)',
  },
  ar: {
    bonjour: 'مرحبًا', dossier: 'ملفكم', sousTitre: 'متابعة ملفكم',
    avancement: 'تقدّم الملف', etapeCours: 'المرحلة الحالية', toutFait: 'تم إنجاز جميع المراحل',
    documents: 'وثائقكم', manquants: 'وثيقة مطلوبة', paiements: 'مدفوعاتكم', reste: 'المبلغ المتبقي', aJour: 'لا توجد مبالغ مستحقة',
    envoyer: 'إرسال', renvoyer: 'إعادة الإرسال', motif: 'السبب', honoraires: 'أتعاب الوكالة', frais: 'مصاريف الإجراءات (تُدفع مسبقًا)',
    paye: 'مدفوع', aPayer: 'للدفع', fin: 'عند نهاية الإجراءات', historique: 'ما تم إنجازه', rdv: 'موعدكم',
    statut: { manquant: 'مطلوبة', envoye: 'قيد المراجعة', valide: 'مقبولة', refuse: 'يجب إعادة إرسالها' } as Record<StatutDocument, string>,
    aide: 'التقطوا صورة واضحة أو أرسلوا ملف PDF (10 ميغابايت كحد أقصى).', envoye: 'تم إرسال الوثيقة. ستقوم الوكالة بمراجعتها.', introuvable: 'هذا الرابط غير صالح. يرجى الاتصال بالوكالة.',
    lienApercu: 'معاينة فضاء الزبون (نسخة تجريبية).', retour: 'العودة إلى الملف',
  },
};
const CLS: Record<StatutDocument, { badge: string; icone: NomIcone }> = {
  manquant: { badge: 'b-gris', icone: 'vide' },
  envoye: { badge: 'b-bleu', icone: 'horloge' },
  valide: { badge: 'b-vert', icone: 'coche' },
  refuse: { badge: 'b-rouge', icone: 'alerte' },
};

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

  if (modeEnLigne && !d) return <EcranConnexion client />;
  if (!d || !c) {
    return (
      <div className="connexion">
        <EntreePage className="carte" style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
          <span className="logo-medaillon"><img src="./logo.png" alt="Logo World Destination" /></span>
          <div className="alerte alerte-orange" style={{ marginBottom: 0 }}>
            <Icone nom="alerte" />
            <span>{t.introuvable}</span>
          </div>
        </EntreePage>
      </div>
    );
  }

  const p = progression(d);
  const manquants = d.documents.filter((x) => x.statut === 'manquant' || x.statut === 'refuse').length;
  const lignes = [
    ...d.echeances.map((e) => ({ id: e.id, lib: e.moment === 'depot' ? (ar ? 'أتعاب – 50٪ عند إيداع الملف' : e.libelle) : (ar ? 'أتعاب – 50٪ عند نهاية الإجراءات' : e.libelle), groupe: 'h', montant: e.montant, reste: resteEcheance(d, e.id), devise: e.devise, exig: echeanceExigible(d, e.moment) })),
    ...d.frais.map((f) => ({ id: f.id, lib: libelle(f, ar), groupe: 'f', montant: f.montant, reste: resteFrais(d, f), devise: f.devise, exig: true })),
  ];
  const resteTotal = lignes.filter((l) => l.exig && l.reste > 0);
  const journalPublic = [...d.journal].filter((e) => !e.interne).reverse().slice(0, 15);

  const choisir = (docId: string) => { cible.current = docId; input.current?.click(); };
  const fichier = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!typeAutorise(f) || f.size > TAILLE_MAX) { notifier(t.aide, true); return; }
    await tenter(() => televerserParClient(d.id, cible.current, f), t.envoye);
  };

  return (
    <div className={ar ? 'rtl' : ''} dir={ar ? 'rtl' : 'ltr'} lang={langue} style={{ minHeight: '100vh', background: 'var(--c-fond)' }}>
      <input ref={input} type="file" accept={TYPES_ACCEPTES} hidden onChange={fichier} />
      {staff && (
        <div className="alerte alerte-bleu" style={{ borderRadius: 0, margin: 0, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }} dir="ltr">
          <span>{T.fr.lienApercu}</span><Link to={`/dossiers/${d.id}`}>← {T.fr.retour}</Link>
        </div>
      )}
      <header className="portail-entete">
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="logo-medaillon logo-medaillon-sm"><img src="./logo.png" alt="" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', lineHeight: 1.2 }}>World Destination</b>
            <span className="petit" style={{ color: 'var(--c-chrome-texte)', opacity: 0.9 }}>{t.sousTitre}</span>
          </div>
          <button type="button" onClick={() => setLangue(ar ? 'fr' : 'ar')}>
            <Icone nom="globe" taille={15} /> {ar ? 'Français' : 'العربية'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '22px 16px 64px' }}>
        <EntreePage style={{ display: 'grid', gap: 16 }}>
          <div>
            <h1>{t.bonjour} {c.prenom}</h1>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{t.dossier} : {d.intitule}</span>
              <span className="badge b-bleu">{d.numero}</span>
            </div>
          </div>

          <section className="carte">
            <h2 className="titre-section">
              <Icone nom="avion" taille={18} />
              <span>{t.avancement}</span>
              <span className="compteur ton-info">{p.faites}/{p.total}</span>
            </h2>
            <Barre pourcent={p.pourcent} label={t.avancement} />
            <p style={{ marginBottom: 0, marginTop: 10 }}>
              {p.courante ? <>{t.etapeCours} : <b>{libelle(p.courante, ar)}</b></> : <b>{t.toutFait}</b>}
            </p>
            {d.etapes.length > 0 && (
              <div className="portail-etapes" role="group" aria-label={t.avancement}>
                {d.etapes.map((et, idx) => {
                  const courante = !et.faite && p.courante?.id === et.id;
                  return (
                    <span
                      key={et.id}
                      className={`etape-pilule ${et.faite ? 'est-faite' : courante ? 'est-courante' : ''}`}
                      aria-current={courante ? 'step' : undefined}
                    >
                      {et.faite ? <Icone nom="coche" taille={13} /> : <span>{idx + 1}.</span>}
                      <span>{libelle(et, ar)}</span>
                    </span>
                  );
                })}
              </div>
            )}
            {d.rdv && (
              <div className="alerte alerte-bleu" style={{ marginTop: 14, marginBottom: 0 }}>
                <Icone nom="calendrier" taille={18} />
                <div>
                  {t.rdv} : <b><bdi>{new Date(d.rdv.date).toLocaleString(loc, { dateStyle: 'full', timeStyle: 'short' })}</bdi></b> – {d.rdv.lieu}
                </div>
              </div>
            )}
          </section>

          <section className="carte">
            <h2 className="titre-section">
              <Icone nom="fichier" taille={18} />
              <span>{t.documents}</span>
              {manquants > 0 && <span className="badge b-orange" style={{ marginInlineStart: 'auto' }}>{manquants} {t.manquants}</span>}
            </h2>
            <p className="petit muted" style={{ marginTop: 0 }}>{t.aide}</p>
            <StaggerListe as="ul" className="liste-simple">
              {d.documents.map((doc) => {
                const styleDoc = CLS[doc.statut];
                return (
                  <li key={doc.id}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <b>{libelle(doc, ar)}</b>
                      {doc.statut === 'refuse' && doc.motifRefus && (
                        <div className="petit" style={{ color: 'var(--c-danger)', fontWeight: 500 }}>
                          {t.motif} : {doc.motifRefus}
                        </div>
                      )}
                    </div>
                    <div className="actions">
                      <span className={`badge ${styleDoc.badge}`}>
                        <Icone nom={styleDoc.icone} taille={13} /> {t.statut[doc.statut]}
                      </span>
                      {(doc.statut === 'manquant' || doc.statut === 'refuse') && d.statut === 'en_cours' && (
                        <button type="button" className="btn-petit btn-primaire" onClick={() => choisir(doc.id)}>
                          <Icone nom="televerser" taille={14} /> {doc.statut === 'refuse' ? t.renvoyer : t.envoyer}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </StaggerListe>
          </section>

          <section className="carte">
            <h2 className="titre-section">
              <Icone nom="paiement" taille={18} />
              <span>{t.paiements}</span>
            </h2>
            {resteTotal.length === 0 ? (
              <div className="alerte alerte-bleu">
                <Icone nom="coche" taille={18} />
                <span>{t.aJour}</span>
              </div>
            ) : (
              <div className="alerte alerte-orange">
                <Icone nom="paiement" taille={18} />
                <div>
                  {t.reste} : <b>{resteTotal.map((l, i) => <span key={l.id}>{i > 0 && ' + '}<bdi>{montant(l.reste, l.devise)}</bdi></span>)}</b>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              {(['h', 'f'] as const).map((g) => {
                const sousLignes = lignes.filter((l) => l.groupe === g);
                if (!sousLignes.length) return null;
                return (
                  <div key={g} className="section-formulaire" style={{ marginBottom: 0 }}>
                    <h3 className="section-formulaire-titre">{g === 'h' ? t.honoraires : t.frais}</h3>
                    <ul className="liste-simple">
                      {sousLignes.map((l) => (
                        <li key={l.id}>
                          <span>{l.lib}</span>
                          <span className="actions">
                            <bdi className="num" style={{ fontWeight: 600 }}>{montant(l.montant, l.devise)}</bdi>
                            {l.reste === 0 ? (
                              <span className="badge b-vert">{t.paye}</span>
                            ) : l.exig ? (
                              <span className="badge b-orange">{t.aPayer}</span>
                            ) : (
                              <span className="badge b-gris">{t.fin}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="carte">
            <h2 className="titre-section">
              <Icone nom="horloge" taille={18} />
              <span>{t.historique}</span>
            </h2>
            <ul className="journal">
              {journalPublic.map((e) => (
                <li key={e.id}>
                  <span className="icone" aria-hidden="true">
                    <Icone nom={ICONE_JOURNAL[e.type]} taille={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{ar ? journalArabe(e, d) : e.texte}</div>
                    <div className="petit muted">{new Date(e.date).toLocaleDateString(loc)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </EntreePage>
      </main>
    </div>
  );
}
