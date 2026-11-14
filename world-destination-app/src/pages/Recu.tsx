import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Vide } from '../components/ui';
import { lienEspaceClient } from '../lib/messages';
import { dateHeure, montant, nomClient, resteEcheance, resteFrais } from '../lib/regles';
import { useBase } from '../lib/store';

const MODES = { especes: 'Espèces', ccp: 'CCP', baridimob: 'BaridiMob', virement: 'Virement bancaire' };

export default function Recu() {
  const { id, paiementId } = useParams();
  const base = useBase();
  const [qr, setQr] = useState('');
  const d = base.dossiers.find((x) => x.id === id);
  const p = d?.paiements.find((x) => x.id === paiementId);
  useEffect(() => {
    if (d) QRCode.toDataURL(lienEspaceClient(d), { margin: 1, width: 160, color: { dark: '#165f73' } }).then(setQr).catch(() => setQr(''));
  }, [d]);
  if (!d || !p) return <Vide>Reçu introuvable. <Link to="/dossiers">Retour aux dossiers</Link></Vide>;
  const c = base.clients.find((x) => x.id === d.clientId);
  const agent = base.utilisateurs.find((u) => u.id === p.par);
  const objet = p.cible.type === 'echeance' ? d.echeances.find((e) => e.id === p.cible.id) : d.frais.find((f) => f.id === p.cible.id);
  const libelle = objet ? ('libelle' in objet ? objet.libelle : `Frais de procédure : ${objet.nom}`) : '';
  const reste = p.cible.type === 'echeance' ? resteEcheance(d, p.cible.id) : objet && 'organisme' in objet ? resteFrais(d, objet) : 0;
  const ag = base.parametres;

  return (
    <>
      <div className="actions no-print" style={{ marginBottom: 16 }}>
        <Link className="btn" to={`/dossiers/${d.id}?onglet=paiements`}>← Retour au dossier</Link>
        <button className="btn-primaire" onClick={() => window.print()}>🖨 Imprimer</button>
      </div>
      <div className="recu carte">
        <div className="tete">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <img src="./logo.png" alt="Logo World Destination" />
            <div>
              <b style={{ fontSize: '1.2rem' }}>{ag.nom}</b>
              <div className="petit muted">{[ag.adresse, ag.telephone, ag.email].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>REÇU</div>
            <div>N° {p.numeroRecu}</div>
            <div className="petit muted">{dateHeure(p.date)}</div>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td className="muted">Client</td><td><b>{nomClient(c)}</b> · +{c?.telephone}</td></tr>
            <tr><td className="muted">Dossier</td><td>{d.numero} – {d.intitule}</td></tr>
            <tr><td className="muted">Objet</td><td>{libelle}</td></tr>
            <tr><td className="muted">Mode de paiement</td><td>{MODES[p.mode]}</td></tr>
            <tr><td className="muted">Montant reçu</td><td style={{ fontSize: '1.3rem' }}><b>{montant(p.montant, p.devise)}</b></td></tr>
            <tr><td className="muted">Reste sur cet objet</td><td>{montant(reste, p.devise)}</td></tr>
            <tr><td className="muted">Encaissé par</td><td>{agent?.nom}</td></tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24, gap: 16 }}>
          <div className="petit muted" style={{ maxWidth: 380 }}>
            Scannez ce code pour suivre votre dossier en ligne (étape, documents manquants, reste à payer).<br />
            <span dir="rtl">امسحوا الرمز لمتابعة ملفكم عبر الإنترنت.</span>
            <div style={{ marginTop: 28 }}>Signature et cachet de l'agence :</div>
          </div>
          {qr && <img src={qr} alt="QR code d'accès à l'espace client" width={120} height={120} />}
        </div>
      </div>
    </>
  );
}
