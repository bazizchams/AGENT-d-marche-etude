\set ON_ERROR_STOP 1
-- Valeurs tirées du modèle Campus France (le contenu des modèles évolue : rien n'est codé en dur).
select f ->> 'nom' as tnom, (f ->> 'montant')::numeric as tmt, (f ->> 'montant')::numeric - 1000 as tmt2
  from modeles, jsonb_array_elements(frais) f
  where id = 'm-campus' and f ->> 'devise' = 'DZD' and (f ->> 'montant')::numeric between 2000 and 39000
  order by (f ->> 'montant')::numeric limit 1 \gset
select e ->> 'nom' as tetape from modeles, jsonb_array_elements(etapes) e
  where id = 'm-campus' and jsonb_array_length(e -> 'fraisRequis') = 1 limit 1 \gset
select round(honoraires / 2) as tdep, devise_honoraires as tdev from modeles where id = 'm-campus' \gset
-- Comptes de test (comme créés par Supabase Auth)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'admin@wd.test'),
 ('00000000-0000-0000-0000-00000000000b', 'agent@wd.test'),
 ('00000000-0000-0000-0000-00000000000c', 'client1@exemple.test'),
 ('00000000-0000-0000-0000-00000000000d', 'client2@exemple.test');
update profils set role = 'admin', nom = 'Admin' where email = 'admin@wd.test';
update profils set role = 'agent', nom = 'Agent' where email = 'agent@wd.test';

-- Outil : vérifie qu'une requête échoue avec le message attendu.
create or replace function public.doit_echouer(p_sql text, p_motif text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_motif || '%' then raise notice 'OK refusé : %', sqlerrm; return; end if;
    raise exception 'Mauvaise erreur pour [%] : %', p_sql, sqlerrm;
  end;
  raise exception 'Aurait dû échouer : %', p_sql;
end $$;
grant execute on function public.doit_echouer(text, text) to authenticated;

create or replace function public.verifier(p_ok boolean, p_lib text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'ÉCHEC : %', p_lib; end if;
  raise notice 'OK : %', p_lib;
end $$;
grant execute on function public.verifier(boolean, text) to authenticated;

-- ============ Agent : client + dossier ============
-- Fiches reliées à des comptes (fait par l'invitation officielle = clé service, auth.uid() nul)
insert into clients (id, compte_id, nom, prenom, telephone, email) values
 ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Test', 'Un', '2135', 'c1@x'),
 ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'Test', 'Deux', '2136', 'c2@x');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into dossiers (id, numero, client_id, modele_id, intitule, agent_id) values
 ('22222222-0000-0000-0000-000000000001', 'WD-PREDIT', '11111111-0000-0000-0000-000000000001', 'm-campus', 'Campus', '00000000-0000-0000-0000-00000000000b'),
 ('22222222-0000-0000-0000-000000000002', 'x', '11111111-0000-0000-0000-000000000002', 'm-schengen', 'Schengen', '00000000-0000-0000-0000-00000000000b');
select verifier((select numero from dossiers where id = '22222222-0000-0000-0000-000000000001') ~ '^WD-\d{4}-0001$', 'numéro de dossier attribué par le serveur');
select verifier((select numero from dossiers where id = '22222222-0000-0000-0000-000000000002') ~ '^WD-\d{4}-0002$', 'numéro suivant sans doublon');
insert into documents (id, dossier_id, ordre, nom) values
 ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 0, 'Passeport'),
 ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 1, 'Photo');
insert into frais (id, dossier_id, ordre, nom, organisme, montant, devise) values
 ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 0, :'tnom', 'Organisme', :tmt, 'DZD');
insert into echeances (id, dossier_id, ordre, libelle, moment, montant, devise) values
 ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 0, 'Honoraires 50 %', 'depot', :tdep, :'tdev');
insert into etapes (id, dossier_id, ordre, nom, frais_requis) values
 ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 0, :'tetape', '{44444444-0000-0000-0000-000000000001}');
select verifier((select count(*) from journal where dossier_id = '22222222-0000-0000-0000-000000000001') = 1, 'journal : seule la création (pas les documents initiaux)');

-- Encaissements
select doit_echouer($$insert into paiements (dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('22222222-0000-0000-0000-000000000001', 'frais', '44444444-0000-0000-0000-000000000001', 40000, 'DZD', 'especes', '00000000-0000-0000-0000-00000000000b')$$, 'dépasse le reste');
select doit_echouer($$insert into paiements (dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('22222222-0000-0000-0000-000000000001', 'frais', '44444444-0000-0000-0000-000000000001', 100, 'EUR', 'especes', '00000000-0000-0000-0000-00000000000b')$$, 'devise');
select doit_echouer($$insert into paiements (dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('22222222-0000-0000-0000-000000000002', 'frais', '44444444-0000-0000-0000-000000000001', 100, 'DZD', 'especes', '00000000-0000-0000-0000-00000000000b')$$, 'introuvable dans ce dossier');
insert into paiements (id, dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('77777777-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'frais', '44444444-0000-0000-0000-000000000001', 1000, 'DZD', 'especes', '00000000-0000-0000-0000-00000000000b');
select verifier((select numero_recu from paiements where id = '77777777-0000-0000-0000-000000000001') ~ '^R-\d{4}-00001$', 'numéro de reçu R-AAAA-00001');
select doit_echouer($$update etapes set faite = true where id = '66666666-0000-0000-0000-000000000001'$$, 'Étape bloquée');
insert into paiements (id, dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('77777777-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'frais', '44444444-0000-0000-0000-000000000001', :tmt2, 'DZD', 'ccp', '00000000-0000-0000-0000-00000000000b');
update etapes set faite = true where id = '66666666-0000-0000-0000-000000000001';
select verifier((select faite_par from etapes where id = '66666666-0000-0000-0000-000000000001') = auth.uid(), 'étape validée après paiement à 100 %, auteur imposé');

-- L'agent ne peut ni annuler, ni modifier, ni supprimer un paiement
update paiements set annule_le = now(), motif_annulation = 'essai' where id = '77777777-0000-0000-0000-000000000001';
select verifier((select annule_le is null from paiements where id = '77777777-0000-0000-0000-000000000001'), 'agent : annulation sans effet (RLS)');
select doit_echouer($$delete from paiements where id = '77777777-0000-0000-0000-000000000001'$$, 'permission denied');
select doit_echouer($$update journal set texte = 'falsifié'$$, 'permission denied');
select doit_echouer($$insert into compteurs values ('recu', 2026, 0)$$, 'permission denied');

-- Document refusé sans motif
select doit_echouer($$update documents set statut = 'refuse' where id = '33333333-0000-0000-0000-000000000002'$$, 'motif du refus');
update documents set statut = 'refuse', motif_refus = 'Floue' where id = '33333333-0000-0000-0000-000000000002';
insert into journal (dossier_id, type, texte, interne) values ('22222222-0000-0000-0000-000000000001', 'note', 'Note interne secrète', true);
-- Document ajouté plus tard : journalisé (transaction différente => cree_le plus récent)
insert into documents (dossier_id, ordre, nom) values ('22222222-0000-0000-0000-000000000001', 2, 'Attestation');
select verifier(exists (select 1 from journal where texte = 'Document demandé en plus : Attestation'), 'journal : document ajouté plus tard');

-- ============ Admin : annulation ============
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select doit_echouer($$update paiements set annule_le = now(), motif_annulation = ' ' where id = '77777777-0000-0000-0000-000000000001'$$, 'motif');
select doit_echouer($$update paiements set montant = 1 where id = '77777777-0000-0000-0000-000000000001'$$, 'ne peut pas être modifié');
update paiements set annule_le = now(), motif_annulation = 'Erreur de saisie' where id = '77777777-0000-0000-0000-000000000001';
select verifier((select annule_par from paiements where id = '77777777-0000-0000-0000-000000000001') = auth.uid(), 'admin : annulation avec motif');
select doit_echouer($$update paiements set annule_le = null, motif_annulation = null where id = '77777777-0000-0000-0000-000000000001'$$, 'déjà annulé');
select doit_echouer($$delete from paiements$$, 'permission denied');
select doit_echouer($$update profils set role = 'agent' where id = auth.uid()$$, 'propre rôle');

-- ============ Client 1 ============
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select verifier((select count(*) from dossiers) = 1, 'client : ne voit que son dossier');
select verifier((select count(*) from clients) = 1, 'client : ne voit que sa fiche');
select verifier((select count(*) from journal where interne) = 0, 'client : pas de note interne');
select verifier((select count(*) from journal) > 0, 'client : voit le journal public');
select verifier((select count(*) from profils) = 1, 'client : ne voit que son profil');
select verifier((select count(*) from compteurs) = 0, 'client : pas les compteurs');
select doit_echouer($$update documents set nom = 'X', statut = 'envoye', chemin_fichier = '22222222-0000-0000-0000-000000000001/aaaaaaaa-0000-0000-0000-000000000001.pdf' where id = '33333333-0000-0000-0000-000000000001'$$, 'Seul le fichier');
select doit_echouer($$update documents set statut = 'envoye', chemin_fichier = 'autre/a.pdf' where id = '33333333-0000-0000-0000-000000000001'$$, 'Fichier invalide');
select doit_echouer($$update documents set statut = 'valide' where id = '33333333-0000-0000-0000-000000000001'$$, 'seulement envoyer');
update documents set statut = 'envoye', chemin_fichier = '22222222-0000-0000-0000-000000000001/aaaaaaaa-0000-0000-0000-000000000001.pdf', nom_fichier = 'a.pdf', type_fichier = 'application/pdf'
  where id = '33333333-0000-0000-0000-000000000002';
select verifier((select statut = 'envoye' and motif_refus is null and maj_par = auth.uid() from documents where id = '33333333-0000-0000-0000-000000000002'), 'client : envoi d''un document refusé');
select verifier(exists (select 1 from journal where texte like 'Photo : envoyé par le client%'), 'journal automatique de l''envoi client');
-- M-4 : le client trace sa consultation ; pas d'accès au fichier d'un autre
select verifier(tracer_acces('22222222-0000-0000-0000-000000000001/aaaaaaaa-0000-0000-0000-000000000001.pdf') is not null, 'M-4 client : consultation de son fichier tracée');
select doit_echouer($$select tracer_acces('22222222-0000-0000-0000-000000000002/x.pdf')$$, 'Accès refusé');
select verifier((select count(*) from acces_documents) = 0, 'M-4 client : registre des consultations invisible');
-- M-2 : total_paye non appelable ; M-1 : pas de résumé des paiements pour un client
select doit_echouer($$select total_paye('frais', '44444444-0000-0000-0000-000000000001')$$, 'permission denied');
select verifier((select count(*) from paiements_resumes()) = 0, 'M-1 client : paiements_resumes vide');
-- E-1 : un client ne modifie pas sa fiche
update clients set compte_suivi_id = auth.uid() where id = '11111111-0000-0000-0000-000000000001';
select verifier((select compte_suivi_id is null from clients where id = '11111111-0000-0000-0000-000000000001'), 'E-1 client : fiche non modifiable (RLS)');
update documents set statut = 'manquant' where id = '33333333-0000-0000-0000-000000000002'; -- sans effet (RLS)
select verifier((select statut from documents where id = '33333333-0000-0000-0000-000000000002') = 'envoye', 'client : ne peut pas repasser un document envoyé');
select doit_echouer($$insert into paiements (dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('22222222-0000-0000-0000-000000000001', 'echeance', '55555555-0000-0000-0000-000000000001', 1, 'DZD', 'especes', auth.uid())$$, 'row-level security');
select doit_echouer($$insert into journal (dossier_id, type, texte) values ('22222222-0000-0000-0000-000000000001', 'note', 'pirate')$$, 'row-level security');
-- Storage
select doit_echouer($$insert into storage.objects (bucket_id, name) values ('documents', '22222222-0000-0000-0000-000000000002/x.pdf')$$, 'row-level security');
insert into storage.objects (bucket_id, name) values ('documents', '22222222-0000-0000-0000-000000000001/x.pdf');
select doit_echouer($$insert into storage.objects (bucket_id, name) values ('documents', 'pas-un-uuid/x.pdf')$$, 'row-level security');

-- ============ Client 2 ne voit rien du dossier 1 ============
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select verifier((select count(*) from documents where dossier_id = '22222222-0000-0000-0000-000000000001') = 0, 'client 2 : aucun document du client 1');
select verifier((select count(*) from storage.objects) = 0, 'client 2 : aucun fichier du client 1');
select verifier((select count(*) from paiements) = 0, 'client 2 : aucun paiement du client 1');

-- ============ Correctifs de la revue sécurité ============
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'agent2@wd.test'), ('00000000-0000-0000-0000-0000000000f1', 'pirate@exemple.test');
update profils set role = 'agent', nom = 'Agent 2' where email = 'agent2@wd.test';
set role authenticated;

-- Agent 1
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
-- E-1 : relier son propre compte ou changer le client d'un dossier
select doit_echouer($$update clients set compte_suivi_id = '00000000-0000-0000-0000-0000000000f1' where id = '11111111-0000-0000-0000-000000000001'$$, 'Seul un administrateur');
select doit_echouer($$insert into clients (nom, prenom, compte_id) values ('X', 'Y', '00000000-0000-0000-0000-0000000000f1')$$, 'Seul un administrateur');
select doit_echouer($$update dossiers set client_id = '11111111-0000-0000-0000-000000000002' where id = '22222222-0000-0000-0000-000000000001'$$, 'ne peut pas changer');
update clients set email = 'nouveau@x', telephone = '213999' where id = '11111111-0000-0000-0000-000000000001';
select verifier(exists (select 1 from journal where dossier_id = '22222222-0000-0000-0000-000000000001' and interne and texte like 'Fiche client modifiée : e-mail, téléphone%'), 'E-1 : changement de coordonnées journalisé en interne');
-- F-8 : dates et auteur imposés
insert into clients (id, nom, prenom, cree_le, cree_par) values ('11111111-0000-0000-0000-000000000003', 'Trois', 'T', '2000-01-01', '00000000-0000-0000-0000-00000000000a');
select verifier((select cree_le > now() - interval '1 minute' and cree_par = auth.uid() from clients where id = '11111111-0000-0000-0000-000000000003'), 'F-8 : cree_le / cree_par imposés');
insert into dossiers (id, client_id, modele_id, intitule, agent_id, ouvert_le) values
 ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'm-campus', 'Antidaté', '00000000-0000-0000-0000-0000000000e1', '2000-01-01');
select verifier((select ouvert_le > now() - interval '1 minute' from dossiers where id = '22222222-0000-0000-0000-000000000003'), 'F-8 : ouvert_le imposé');
-- E-2 : montants à la création conformes au modèle, puis figés
select doit_echouer($$insert into echeances (dossier_id, libelle, moment, montant, devise) values ('22222222-0000-0000-0000-000000000003', 'Honoraires', 'depot', 1, 'DZD')$$, 'non conforme');
select doit_echouer($$insert into frais (dossier_id, nom, montant, devise) values ('22222222-0000-0000-0000-000000000003', 'Frais inventé', 1, 'DZD')$$, 'non conforme');
select doit_echouer($$insert into etapes (dossier_id, nom, frais_requis) values ('22222222-0000-0000-0000-000000000003', 'Étape inventée', '{}')$$, 'non conforme');
select doit_echouer($$update echeances set montant = 0 where id = '55555555-0000-0000-0000-000000000001'$$, 'réservée à un administrateur');
select doit_echouer($$update frais set montant = 1 where id = '44444444-0000-0000-0000-000000000001'$$, 'réservée à un administrateur');
select doit_echouer($$update etapes set frais_requis = '{}' where id = '66666666-0000-0000-0000-000000000001'$$, 'réservée à un administrateur');
update frais set verse = true where id = '44444444-0000-0000-0000-000000000001';
select verifier((select verse from frais where id = '44444444-0000-0000-0000-000000000001'), 'E-2 : l''agent peut toujours marquer un frais versé');
-- M-3 : pas de faux encaissement au journal
select doit_echouer($$insert into journal (dossier_id, type, texte) values ('22222222-0000-0000-0000-000000000001', 'paiement', 'Encaissement 120 000 DA')$$, 'row-level security');
-- E-3 : aucune suppression
select doit_echouer($$delete from dossiers where id = '22222222-0000-0000-0000-000000000003'$$, 'permission denied');
select doit_echouer($$delete from documents$$, 'permission denied');
select doit_echouer($$select purger_dossier('22222222-0000-0000-0000-000000000001')$$, 'Seul un administrateur');
-- F-1 : pas de TRUNCATE
select doit_echouer($$truncate journal$$, 'permission denied');
-- F-2 : chemins de fichier stricts
select doit_echouer($$update documents set chemin_fichier = '22222222-0000-0000-0000-000000000001/../22222222-0000-0000-0000-000000000002/x.pdf', statut = 'valide' where id = '33333333-0000-0000-0000-000000000001'$$, 'Fichier invalide');
-- M-4 : pas de remplacement de fichier dans Storage
reset role;
insert into storage.objects (bucket_id, name) values ('documents', '22222222-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000001.pdf');
set role authenticated;
update storage.objects set owner = auth.uid() where bucket_id = 'documents';
select verifier((select count(*) from storage.objects where owner is not null) = 0, 'M-4 : un fichier ne peut pas être remplacé (pas de règle update)');
-- M-4 : consultation tracée
select verifier(tracer_acces('22222222-0000-0000-0000-000000000001/aaaaaaaa-0000-0000-0000-000000000001.pdf') is not null, 'M-4 agent : consultation tracée');

-- Agent 2 : M-1, il n'a pas la charge du dossier 1 et n'y a rien encaissé
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select verifier((select count(*) from paiements) = 0, 'M-1 : agent 2 ne lit pas les paiements des autres dossiers');
select verifier((select total from paiements_resumes() where cible_id = '44444444-0000-0000-0000-000000000001') = :tmt2, 'M-1 : agent 2 reçoit le total (sans détail) pour calculer le reste');
select verifier((select count(*) from dossiers) = 3, 'M-1 : agent 2 voit toujours les dossiers');
select verifier((select count(*) from journal where type = 'paiement' and dossier_id = '22222222-0000-0000-0000-000000000001') = 0, 'M-1 : agent 2 ne lit pas les montants via le journal');
select verifier((select count(*) from journal where dossier_id = '22222222-0000-0000-0000-000000000001') > 0, 'M-1 : agent 2 lit le reste du journal');
-- E-4 / M-7 : consentement du parent
select enregistrer_consentement_suivi('11111111-0000-0000-0000-000000000001', true);
select verifier((select consentement_suivi_le is not null from clients where id = '11111111-0000-0000-0000-000000000001'), 'M-7 : consentement enregistré');

-- Admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select verifier((select count(*) from acces_documents) = 2, 'M-4 : l''admin lit le registre des consultations');
update echeances set montant = 59000 where id = '55555555-0000-0000-0000-000000000001';
select verifier(exists (select 1 from journal where interne and texte like 'Modifié par un administrateur (echeances : montant)%'), 'E-2 : modification admin journalisée');
update clients set compte_suivi_id = '00000000-0000-0000-0000-0000000000f1' where id = '11111111-0000-0000-0000-000000000001';
select verifier((select compte_suivi_id is not null from clients where id = '11111111-0000-0000-0000-000000000001'), 'E-1 : l''admin peut relier un compte');
-- Retrait du consentement par un agent : coupe l'accès du parent
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select enregistrer_consentement_suivi('11111111-0000-0000-0000-000000000001', false);
select verifier((select compte_suivi_id is null and consentement_suivi_le is null from clients where id = '11111111-0000-0000-0000-000000000001'), 'M-7 : retrait du consentement coupe l''accès');
-- F-9 : pas d'encaissement sur un dossier annulé
update dossiers set statut = 'annule' where id = '22222222-0000-0000-0000-000000000001';
select doit_echouer($$insert into paiements (dossier_id, cible_type, cible_id, montant, devise, mode, par) values
 ('22222222-0000-0000-0000-000000000001', 'echeance', '55555555-0000-0000-0000-000000000001', 1, 'DZD', 'especes', auth.uid())$$, 'Dossier annulé');
-- E-5 : MFA obligatoire pour les admins
reset role;
update securite set mfa_admin_obligatoire = true;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claim.aal = 'aal1';
select verifier(not est_admin(), 'E-5 : admin sans code MFA (aal1) = pas de droits admin');
select doit_echouer($$select purger_dossier('22222222-0000-0000-0000-000000000001')$$, 'Seul un administrateur');
set request.jwt.claim.aal = 'aal2';
select verifier(est_admin(), 'E-5 : admin avec code MFA (aal2)');
-- E-3 : purge par l'admin
select verifier(purger_dossier('22222222-0000-0000-0000-000000000001', true) = 1, 'E-3 : purge (1 fichier référencé)');
select verifier((select count(*) from documents where dossier_id = '22222222-0000-0000-0000-000000000001' and chemin_fichier is not null) = 0, 'E-3 : plus aucune référence de fichier');
select verifier((select nom = 'Anonymisé' and email = '' and compte_id is null from clients where id = '11111111-0000-0000-0000-000000000001'), 'E-3 : fiche anonymisée');
select verifier((select count(*) from paiements where dossier_id = '22222222-0000-0000-0000-000000000001') = 2, 'E-3 : paiements conservés');
select verifier(exists (select 1 from journal where texte like 'Purge : 1 fichier%'), 'E-3 : purge journalisée');
reset request.jwt.claim.aal;
reset role;
select doit_echouer($$delete from dossiers where id = '22222222-0000-0000-0000-000000000002'$$, 'violates foreign key');
update securite set mfa_admin_obligatoire = false;

-- ============ Anonyme ============
reset request.jwt.claim.sub;
set role anon;
select doit_echouer($$select * from dossiers$$, 'permission denied');
reset role;
select verifier((select count(*) from journal where dossier_id = '22222222-0000-0000-0000-000000000001' and type = 'paiement') = 4, 'journal : 2 encaissements + 1 annulation + 1 versement');
select date, type, texte, interne from journal order by date, id;
