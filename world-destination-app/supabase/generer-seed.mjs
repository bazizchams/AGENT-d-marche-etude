// Génère supabase/seed.sql à partir de src/lib/modeles.ts (source unique des 5 modèles).
// Usage : npm run seed   (Node 22.18 ou plus récent, qui lit directement le TypeScript)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODELES_INITIAUX } from '../src/lib/modeles.ts';

const q = (v) => (v === undefined || v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
// Dollar-quoting pour le JSON : aucun échappement à gérer.
const j = (v) => `$json$${JSON.stringify(v)}$json$::jsonb`;

const lignes = MODELES_INITIAUX.map((m) => `  (${[
  q(m.id), q(m.nom), q(m.nomAr), q(m.couleur), Number(m.honoraires), q(m.deviseHonoraires),
  j(m.documents), j(m.etapes), j(m.frais), m.actif ? 'true' : 'false',
].join(', ')})`);

const sql = `-- =====================================================================================
-- World Destination : données de départ (à exécuter APRÈS schema.sql).
-- Fichier GÉNÉRÉ par supabase/generer-seed.mjs à partir de src/lib/modeles.ts : ne pas modifier à la main
-- (pour le régénérer : npm run seed).
-- Les montants sont des EXEMPLES : l'administrateur les corrige dans Paramètres › Types de dossiers.
-- Relancer ce fichier ne remplace pas un modèle déjà présent (vos corrections sont conservées).
-- =====================================================================================

insert into modeles (id, nom, nom_ar, couleur, honoraires, devise_honoraires, documents, etapes, frais, actif) values
${lignes.join(',\n')}
on conflict (id) do nothing;

insert into parametres (id, nom, jours_alerte_expiration) values (1, 'World Destination', 60)
on conflict (id) do nothing;
`;

const cible = fileURLToPath(new URL('./seed.sql', import.meta.url));
writeFileSync(cible, sql);
console.log(`seed.sql écrit (${MODELES_INITIAUX.length} modèles) : ${cible}`);
