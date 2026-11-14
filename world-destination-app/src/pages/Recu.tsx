import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icone } from '../components/Icone';
import { Vide } from '../components/ui';
import { lienEspaceClient } from '../lib/messages';
import { dateHeure, montant, nomClient, resteEcheance, resteFrais } from '../lib/regles';
import { useBase } from '../lib/store';

const MODES = { especes: 'Espèces', ccp: 'CCP', baridimob: 'BaridiMob', virement: 'Virement bancaire' };

/** Reçu imprimable : conservé volontairement sans animation GSAP pour garantir `@media print` et lecture instantanée. */
export default function Recu() {
  const { id, paiementId } = useParams();
  const base = useBase();
  const [qr, setQr] = useState('');
  const d = base.dossiers.find((x) => x.id === id);
  const p = d?.paiements.find((x) => x.id === paiementId);
  useEffect(() => {
    if (d) QRCode.toDataURL(lienEspaceClient(d), { margin: 1, width: 160, color: { dark: '#047a8c' } }).then(setQr).catch(() => setQr(''));
  }, [d]);
  if (!d || !p) return <Vide icone="recu" action={<Link className="btn btn-petit" to="/dossiers">Retour aux dossiers</Link>}>Reçu introuvable.</Vide>;
  const c = base.clients.find((x) => x.id === d.clientId);
  const agent = base.utilisateurs.find((u) => u.id === p.par);
  const objet = p.cible.type === 'echeance' ? d.echeances.find((e) => e.id === p.cible.id) : d.frais.find((f) => f.id === p.cible.id);
  const libelle = objet ? ('libelle' in objet ? objet.libelle : `Frais de procédure : ${objet.nom}`) : '';
  const reste = p.cible.type === 'echeance' ? resteEcheance(d, p.cible.id) : objet && 'organisme' in objet ? resteFrais(d, objet) : 0;
  const ag = base.parametres;

  return (
    <>
      <div className="actions no-print" style={{ marginBottom: 16, justifyContent: 'space-between', maxWidth: 720, marginInline: 'auto' }}>
        <Link className="btn" to={`/dossiers/${d.id}?onglet=paiements`}>
          <Icone nom="retour" taille={16} /> Retour au dossier
        </Link>
        <button type="button" className="btn-primaire" onClick={() => window.print()}>
          <Icone nom="imprimer" taille={16} /> Imprimer le reçu
        </button>
      </div>

      {p.annule && (
        <div className="alerte alerte-rouge" style={{ maxWidth: 720, marginInline: 'auto', marginBottom: 16 }}>
          <Icone nom="alerte" />
          <div>Ce paiement a été annulé : {p.annule.motif}</div>
        </div>
      )}

      <article className="recu carte" aria-label={`Reçu ${p.numeroRecu}`}>
        <div className="tete">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <img src="./logo.png" alt="Logo World Destination" />
            <div>
              <b style={{ fontSize: '1.15rem', letterSpacing: '-0.01em' }}>{ag.nom}</b>
              <div className="petit muted" style={{ marginTop: 2 }}>{[ag.adresse, ag.telephone, ag.email].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '.08em', color: '#036b7c' }}>REÇU</div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>N° {p.numeroRecu}</div>
            <div className="petit muted">{dateHeure(p.date)}</div>
          </div>
        </div>

        <table>
          <tbody>
            <tr>
              <td>Client</td>
              <td><b>{nomClient(c)}</b> · <bdi>+{c?.telephone}</bdi></td>
            </tr>
            <tr>
              <td>Dossier</td>
              <td><b>{d.numero}</b> – {d.intitule}</td>
            </tr>
            <tr>
              <td>Objet</td>
              <td>{libelle}</td>
            </tr>
            <tr>
              <td>Mode de paiement</td>
              <td>{MODES[p.mode]}</td>
            </tr>
            <tr style={{ background: '#f0f5f7' }}>
              <td>Montant reçu</td>
              <td className="montant" style={p.annule ? { textDecoration: 'line-through', color: '#b42318' } : undefined}>
                {montant(p.montant, p.devise)}
              </td>
            </tr>
            <tr>
              <td>Reste sur cet objet</td>
              <td style={{ textAlign: 'start', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{montant(reste, p.devise)}</td>
            </tr>
            <tr>
              <td>Encaissé par</td>
              <td>{agent?.nom}</td>
            </tr>
          </tbody>
        </table>

        <div className="pied-recu">
          <div className="petit muted" style={{ maxWidth: 380 }}>
            Scannez ce code pour suivre votre dossier en ligne (étape, documents manquants, reste à payer).<br />
            <span dir="rtl" lang="ar">امسحوا الرمز لمتابعة ملفكم عبر الإنترنت.</span>
            <div className="signature">Signature et cachet de l'agence</div>
          </div>
          {qr && (
            <div style={{ padding: 6, border: '1px solid #dce6e9', borderRadius: 10, background: '#ffffff', flexShrink: 0 }}>
              <img src={qr} alt="QR code d'accès à l'espace client" width={120} height={120} style={{ display: 'block' }} />
            </div>
          )}
        </div>
      </article>
    </>
  );
}
