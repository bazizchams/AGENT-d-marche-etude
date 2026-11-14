-- =====================================================================================
-- World Destination : schéma de la version en ligne (Supabase / PostgreSQL 15+).
--
-- Mode d'emploi : Supabase › SQL Editor › New query › coller TOUT ce fichier › Run.
-- Puis faire de même avec seed.sql (les 5 types de dossiers et les paramètres).
-- Le script peut être relancé sans danger : il ne supprime aucune donnée.
--
-- Principes de sécurité (appliqués par la base elle-même, pas seulement par l'écran) :
--   * un client ne voit que ses propres dossiers, et seulement les notes non internes ;
--   * un client peut uniquement envoyer un document manquant ou refusé (statut « envoye ») ;
--   * un paiement ne se supprime JAMAIS ; seul un administrateur l'annule, avec un motif ;
--   * le montant encaissé ne peut pas dépasser le reste à payer ;
--   * une étape ne peut être validée que si ses frais requis sont payés à 100 % ;
--   * les numéros WD-AAAA-NNNN et R-AAAA-NNNNN sont attribués par le serveur, sans doublon ;
--   * le journal est écrit automatiquement par le serveur et ne peut être ni modifié ni effacé ;
--   * seuls un administrateur ou l'invitation officielle relient un compte à une fiche client ;
--   * montants, devises et frais requis d'un dossier : modifiables par un administrateur seulement ;
--   * aucun dossier ne se supprime : un administrateur le « purge » (fichiers effacés, trace conservée) ;
--   * chaque consultation de fichier est enregistrée (table acces_documents) ;
--   * option : double authentification (MFA) obligatoire pour les administrateurs (table securite).
-- =====================================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type role_utilisateur as enum ('admin', 'agent', 'client');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ Tables

-- Profil de chaque compte (personnel ou client). Créé automatiquement à la création du compte.
create table if not exists profils (
  id uuid primary key references auth.users on delete cascade,
  nom text not null default '',
  email text not null default '',
  role role_utilisateur not null default 'client',
  actif boolean not null default true
);

create table if not exists parametres (
  id int primary key default 1 check (id = 1),           -- une seule ligne
  nom text not null default 'World Destination',
  telephone text not null default '',
  whatsapp text not null default '',
  adresse text not null default '',
  email text not null default '',
  jours_alerte_expiration int not null default 60
);

-- Compteurs annuels des numéros de dossier et de reçu (écrits uniquement par les triggers).
create table if not exists compteurs (
  nom text not null check (nom in ('dossier', 'recu')),
  annee int not null,
  valeur int not null default 0,
  primary key (nom, annee)
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references auth.users on delete set null,        -- espace client (lien magique)
  compte_suivi_id uuid references auth.users on delete set null,  -- parent qui suit le dossier
  nom text not null,
  prenom text not null,
  telephone text not null default '',
  email text not null default '',
  date_naissance date,
  adresse text,
  langue text not null default 'fr' check (langue in ('fr', 'ar')),
  contact_suivi jsonb,                                           -- { nom, telephone, email }
  consentement_suivi_le timestamptz,  -- accord écrit du titulaire pour l'accès du parent (loi 18-07)
  cree_le timestamptz not null default now(),
  cree_par uuid references profils on delete set null
);

-- Modèles de dossier : identifiant texte (ex. « m-campus »), listes en JSON
-- (documents, étapes, frais, avec les libellés arabes « nomAr » éventuels).
create table if not exists modeles (
  id text primary key default gen_random_uuid()::text,
  nom text not null,
  nom_ar text,
  couleur text not null default '#0e7c86',
  honoraires numeric(14,2) not null default 0 check (honoraires >= 0),
  devise_honoraires text not null default 'DZD' check (devise_honoraires in ('DZD', 'EUR', 'CAD')),
  documents jsonb not null default '[]',
  etapes jsonb not null default '[]',
  frais jsonb not null default '[]',
  actif boolean not null default true
);

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null default '',                         -- remplacé par le trigger
  client_id uuid not null references clients on delete restrict,
  modele_id text references modeles on delete set null,
  intitule text not null,
  agent_id uuid references profils on delete set null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'termine', 'annule')),
  ouvert_le timestamptz not null default now(),
  rdv_date timestamptz,
  rdv_lieu text
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  ordre int not null default 0,
  nom text not null,
  nom_ar text,
  statut text not null default 'manquant' check (statut in ('manquant', 'envoye', 'valide', 'refuse')),
  avec_expiration boolean not null default false,
  expiration date,
  chemin_fichier text,              -- chemin dans le bucket « documents » : <dossier_id>/<fichier>
  nom_fichier text,
  type_fichier text,
  motif_refus text,
  maj_le timestamptz,
  maj_par uuid references auth.users on delete set null,
  cree_le timestamptz not null default now()
);

create table if not exists frais (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  ordre int not null default 0,
  nom text not null,
  nom_ar text,
  organisme text not null default '',
  montant numeric(14,2) not null check (montant >= 0),
  devise text not null check (devise in ('DZD', 'EUR', 'CAD')),
  verse boolean not null default false,
  verse_le timestamptz,
  verse_par uuid references profils on delete set null
);

create table if not exists etapes (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  ordre int not null default 0,
  nom text not null,
  nom_ar text,
  frais_requis uuid[] not null default '{}',
  faite boolean not null default false,
  faite_le timestamptz,
  faite_par uuid references profils on delete set null
);

create table if not exists echeances (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  ordre int not null default 0,
  libelle text not null,
  moment text not null check (moment in ('depot', 'fin')),
  montant numeric(14,2) not null check (montant >= 0),
  devise text not null check (devise in ('DZD', 'EUR', 'CAD'))
);

create table if not exists paiements (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete restrict,
  numero_recu text unique not null default '',                    -- remplacé par le trigger
  cible_type text not null check (cible_type in ('echeance', 'frais')),
  cible_id uuid not null,
  montant numeric(14,2) not null check (montant > 0),
  devise text not null check (devise in ('DZD', 'EUR', 'CAD')),
  mode text not null check (mode in ('especes', 'ccp', 'virement', 'baridimob')),
  date timestamptz not null default now(),
  par uuid not null references profils on delete restrict,
  annule_le timestamptz,
  annule_par uuid references profils on delete restrict,
  motif_annulation text
);

create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete restrict,  -- le journal ne s'efface jamais
  date timestamptz not null default now(),
  par uuid references auth.users on delete set null,
  type text not null check (type in ('creation', 'document', 'paiement', 'etape', 'note', 'rdv', 'statut', 'message')),
  texte text not null,
  interne boolean not null default false
);

-- Consultations de fichiers (qui a ouvert quel document, quand) : lisible par un administrateur.
create table if not exists acces_documents (
  id bigserial primary key,
  le timestamptz not null default now(),
  par uuid references auth.users on delete set null,
  document_id uuid references documents on delete set null,
  chemin text not null
);

-- Réglages de sécurité, modifiables uniquement dans l'éditeur SQL de Supabase (aucune règle d'écriture).
create table if not exists securite (
  id int primary key default 1 check (id = 1),
  -- Interrupteur : à passer à true APRÈS que chaque administrateur a activé sa double authentification
  -- (voir docs/MISE-EN-LIGNE.md). Ensuite, un administrateur sans code à 6 chiffres n'a que les droits d'un agent.
  mfa_admin_obligatoire boolean not null default false
);
insert into securite (id) values (1) on conflict (id) do nothing;

-- Mises à niveau d'une base créée avec une version précédente de ce script.
alter table clients add column if not exists consentement_suivi_le timestamptz;
do $$ begin
  if exists (select 1 from pg_constraint c where c.conname = 'journal_dossier_id_fkey' and c.confdeltype = 'c') then
    alter table journal drop constraint journal_dossier_id_fkey;
    alter table journal add constraint journal_dossier_id_fkey foreign key (dossier_id) references dossiers on delete restrict;
  end if;
end $$;

-- ------------------------------------------------------------------ Index
create index if not exists clients_compte_idx on clients (compte_id);
create index if not exists clients_compte_suivi_idx on clients (compte_suivi_id);
create index if not exists clients_nom_idx on clients (lower(nom), lower(prenom));
create index if not exists clients_telephone_idx on clients (telephone);
create index if not exists dossiers_client_idx on dossiers (client_id);
create index if not exists dossiers_agent_idx on dossiers (agent_id);
create index if not exists dossiers_statut_idx on dossiers (statut);
create index if not exists documents_dossier_idx on documents (dossier_id, ordre);
create index if not exists documents_statut_idx on documents (statut);
create index if not exists frais_dossier_idx on frais (dossier_id, ordre);
create index if not exists etapes_dossier_idx on etapes (dossier_id, ordre);
create index if not exists echeances_dossier_idx on echeances (dossier_id, ordre);
create index if not exists paiements_dossier_idx on paiements (dossier_id);
create index if not exists paiements_cible_idx on paiements (cible_type, cible_id);
create index if not exists paiements_date_idx on paiements (date);
create index if not exists journal_dossier_idx on journal (dossier_id, date);
create index if not exists acces_documents_le_idx on acces_documents (le);

-- ------------------------------------------------------------------ Fonctions d'accès

create or replace function mon_role() returns role_utilisateur
language sql stable security definer set search_path = public as
$$ select role from profils where id = auth.uid() and actif $$;

create or replace function est_personnel() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin', 'agent') from profils where id = auth.uid() and actif), false) $$;

-- Administrateur : rôle « admin » actif ET, si l'interrupteur securite.mfa_admin_obligatoire est activé,
-- connexion confirmée par le code à 6 chiffres (niveau « aal2 » du jeton Supabase).
create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from profils where id = auth.uid() and actif), false)
      and (not coalesce((select mfa_admin_obligatoire from securite where id = 1), false)
           or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2') $$;

-- Dossiers accessibles au compte client connecté (titulaire ou personne qui suit le dossier).
create or replace function mes_dossiers() returns setof uuid
language sql stable security definer set search_path = public as
$$ select d.id from dossiers d join clients c on c.id = d.client_id
   where auth.uid() is not null and (c.compte_id = auth.uid() or c.compte_suivi_id = auth.uid()) $$;

-- Le serveur n'accepte pas les appels de ces fonctions par les visiteurs non connectés.
revoke execute on function mon_role(), est_personnel(), est_admin(), mes_dossiers() from public, anon;
grant execute on function mon_role(), est_personnel(), est_admin(), mes_dossiers() to authenticated, service_role;

-- Prochain numéro annuel (atomique : le verrou de ligne de l'UPSERT évite tout doublon).
create or replace function prochain_numero(p_nom text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_annee int := extract(year from (now() at time zone 'Africa/Algiers'))::int;
  v_n int;
begin
  insert into compteurs as c (nom, annee, valeur) values (p_nom, v_annee, 1)
  on conflict (nom, annee) do update set valeur = c.valeur + 1
  returning valeur into v_n;
  if p_nom = 'dossier' then
    return 'WD-' || v_annee || '-' || lpad(v_n::text, 4, '0');
  end if;
  return 'R-' || v_annee || '-' || lpad(v_n::text, 5, '0');
end $$;
revoke execute on function prochain_numero(text) from public, anon, authenticated;

-- Écrit une ligne de journal au nom de l'utilisateur connecté.
create or replace function journaliser(p_dossier uuid, p_type text, p_texte text, p_interne boolean default false)
returns void language sql volatile security definer set search_path = public as
$$ insert into journal (dossier_id, par, type, texte, interne) values (p_dossier, auth.uid(), p_type, p_texte, p_interne) $$;
revoke execute on function journaliser(uuid, text, text, boolean) from public, anon, authenticated;

-- Montant d'un frais ou d'une échéance déjà encaissé (paiements non annulés).
create or replace function total_paye(p_type text, p_cible uuid) returns numeric
language sql stable security definer set search_path = public as
$$ select coalesce(sum(montant), 0) from paiements
   where cible_type = p_type and cible_id = p_cible and annule_le is null $$;
revoke execute on function total_paye(text, uuid) from public, anon, authenticated;

create or replace function format_montant(p numeric, p_devise text) returns text
language sql immutable as
-- Format français (37 000 DA, 12,50 €), indépendant des réglages régionaux du serveur.
$$ select translate(to_char(p, case when p = trunc(p) then 'FM999,999,999,990' else 'FM999,999,999,990.00' end), ',.', ' ,')
     || ' ' || case p_devise when 'DZD' then 'DA' when 'EUR' then '€' else '$ CA' end $$;

-- ------------------------------------------------------------------ Triggers : comptes

-- Chaque nouveau compte (invitation, création dans le tableau de bord) reçoit un profil « client ».
-- Les comptes du personnel sont ensuite promus « admin » ou « agent » (voir docs/MISE-EN-LIGNE.md).
create or replace function tg_nouveau_compte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, nom, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nom', split_part(coalesce(new.email, ''), '@', 1)),
          coalesce(new.email, ''), 'client')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists nouveau_compte on auth.users;
create trigger nouveau_compte after insert on auth.users for each row execute function tg_nouveau_compte();

-- Un compte ne peut pas changer son propre rôle ni se désactiver (évite de perdre le dernier admin).
create or replace function tg_profils_garde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and (new.role <> old.role or new.actif <> old.actif) then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre propre compte.';
  end if;
  new.email := old.email;  -- l'e-mail vient du compte de connexion
  return new;
end $$;
drop trigger if exists profils_garde on profils;
create trigger profils_garde before update on profils for each row execute function tg_profils_garde();

-- ------------------------------------------------------------------ Triggers : clients

-- Le lien entre un compte de connexion et une fiche client donne accès aux passeports :
-- seuls un administrateur ou l'Edge Function « inviter-client » (clé service, auth.uid() nul) le modifient.
create or replace function tg_clients_garde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- clé service (invitation officielle) ou éditeur SQL
  if tg_op = 'INSERT' then
    new.cree_le := now();
    new.cree_par := auth.uid();
    if (new.compte_id is not null or new.compte_suivi_id is not null) and not est_admin() then
      raise exception 'Seul un administrateur (ou l''invitation officielle) peut relier un compte à un client.';
    end if;
    return new;
  end if;
  if (new.compte_id is distinct from old.compte_id or new.compte_suivi_id is distinct from old.compte_suivi_id)
     and not est_admin()
     -- exception : retrait du consentement (enregistrer_consentement_suivi), qui ne peut que COUPER l'accès du parent
     and not (current_setting('wd.retrait_consentement', true) = 'oui' and new.compte_suivi_id is null
              and new.compte_id is not distinct from old.compte_id) then
    raise exception 'Seul un administrateur (ou l''invitation officielle) peut relier un compte à un client.';
  end if;
  new.cree_le := old.cree_le;
  new.cree_par := old.cree_par;
  return new;
end $$;
drop trigger if exists clients_garde on clients;
create trigger clients_garde before insert or update on clients for each row execute function tg_clients_garde();

-- Toute modification des coordonnées ou des accès est tracée (en interne) dans chaque dossier du client.
create or replace function tg_clients_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_quoi text[] := '{}';
begin
  if new.email is distinct from old.email then v_quoi := v_quoi || 'e-mail'::text; end if;
  if new.telephone is distinct from old.telephone then v_quoi := v_quoi || 'téléphone'::text; end if;
  if new.contact_suivi is distinct from old.contact_suivi then v_quoi := v_quoi || 'personne qui suit le dossier'::text; end if;
  if new.compte_id is distinct from old.compte_id then v_quoi := v_quoi || 'compte de l''espace client'::text; end if;
  if new.compte_suivi_id is distinct from old.compte_suivi_id then v_quoi := v_quoi || 'compte de la personne qui suit'::text; end if;
  if new.consentement_suivi_le is distinct from old.consentement_suivi_le then v_quoi := v_quoi || 'consentement pour l''accès du parent'::text; end if;
  if cardinality(v_quoi) > 0 then
    insert into journal (dossier_id, par, type, texte, interne)
    select d.id, auth.uid(), 'statut', 'Fiche client modifiée : ' || array_to_string(v_quoi, ', '), true
    from dossiers d where d.client_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists clients_journal on clients;
create trigger clients_journal after update on clients for each row execute function tg_clients_journal();

-- ------------------------------------------------------------------ Triggers : dossiers

create or replace function tg_dossiers_avant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.numero := prochain_numero('dossier');
    if auth.uid() is not null then new.ouvert_le := now(); end if;
  elsif new.numero <> old.numero then
    raise exception 'Le numéro de dossier ne peut pas être modifié.';
  elsif new.client_id <> old.client_id then
    raise exception 'Le client d''un dossier ne peut pas changer : ouvrez un nouveau dossier.';
  elsif new.ouvert_le <> old.ouvert_le then
    new.ouvert_le := old.ouvert_le;
  end if;
  return new;
end $$;
drop trigger if exists dossiers_avant on dossiers;
create trigger dossiers_avant before insert or update on dossiers for each row execute function tg_dossiers_avant();

create or replace function tg_dossiers_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if tg_op = 'INSERT' then
    select nom into v_nom from modeles where id = new.modele_id;
    perform journaliser(new.id, 'creation', 'Dossier ouvert (' || coalesce(v_nom, new.intitule) || ')');
    return null;
  end if;
  if new.statut is distinct from old.statut then
    perform journaliser(new.id, 'statut', 'Dossier ' || case new.statut
      when 'en_cours' then 'rouvert' when 'termine' then 'clôturé (procédure terminée)' else 'annulé' end);
  end if;
  if new.agent_id is distinct from old.agent_id then
    select nom into v_nom from profils where id = new.agent_id;
    perform journaliser(new.id, 'statut', 'Dossier confié à ' || coalesce(v_nom, '—'), true);
  end if;
  if new.rdv_date is distinct from old.rdv_date or new.rdv_lieu is distinct from old.rdv_lieu then
    perform journaliser(new.id, 'rdv', case when new.rdv_date is null then 'Rendez-vous supprimé'
      else 'Rendez-vous fixé le ' || to_char(new.rdv_date at time zone 'Africa/Algiers', 'DD/MM/YYYY HH24:MI')
           || coalesce(' – ' || nullif(new.rdv_lieu, ''), '') end);
  end if;
  return null;
end $$;
drop trigger if exists dossiers_journal on dossiers;
create trigger dossiers_journal after insert or update on dossiers for each row execute function tg_dossiers_journal();

-- ------------------------------------------------------------------ Triggers : documents

-- Chemin d'un fichier : exactement <dossier_id>/<uuid>.<extension> (pas de « .. », pas de sous-dossier).
create or replace function chemin_valide(p_chemin text, p_dossier uuid) returns boolean
language sql immutable as
$$ select p_chemin is not null
      and p_chemin ~ ('^' || p_dossier::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$') $$;

create or replace function tg_documents_avant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Champs qu'un client a le droit de changer en envoyant un fichier.
  v_libres text[] := array['statut', 'chemin_fichier', 'nom_fichier', 'type_fichier', 'motif_refus', 'maj_le', 'maj_par'];
begin
  if tg_op = 'UPDATE' and not est_personnel() and auth.uid() is not null then
    -- Contrôle serveur de l'envoi par le client.
    if old.statut not in ('manquant', 'refuse') or new.statut <> 'envoye' then
      raise exception 'Vous pouvez seulement envoyer un document manquant ou refusé.';
    end if;
    if (to_jsonb(new) - v_libres) <> (to_jsonb(old) - v_libres) then
      raise exception 'Seul le fichier du document peut être envoyé.';
    end if;
    if not chemin_valide(new.chemin_fichier, old.dossier_id) then
      raise exception 'Fichier invalide.';
    end if;
    new.motif_refus := null;
    new.maj_le := now();
    new.maj_par := auth.uid();
    return new;
  end if;

  -- Personnel
  if new.statut = 'refuse' and coalesce(trim(new.motif_refus), '') = '' then
    raise exception 'Le motif du refus est obligatoire.';
  end if;
  if new.chemin_fichier is not null and (tg_op = 'INSERT' or new.chemin_fichier is distinct from old.chemin_fichier)
     and not chemin_valide(new.chemin_fichier, new.dossier_id) then
    raise exception 'Fichier invalide.';
  end if;
  if tg_op = 'UPDATE' and (new.statut is distinct from old.statut or new.chemin_fichier is distinct from old.chemin_fichier) then
    new.maj_le := now();
    new.maj_par := coalesce(auth.uid(), new.maj_par);
  end if;
  return new;
end $$;
drop trigger if exists documents_avant on documents;
create trigger documents_avant before insert or update on documents for each row execute function tg_documents_avant();

create or replace function tg_documents_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Les documents de la check-list initiale sont insérés ensemble ; un document ajouté plus tard est journalisé.
    if exists (select 1 from documents where dossier_id = new.dossier_id and id <> new.id and cree_le < new.cree_le) then
      perform journaliser(new.dossier_id, 'document', 'Document demandé en plus : ' || new.nom);
    end if;
    return null;
  end if;
  if current_setting('wd.purge', true) = 'oui' then return null; end if;  -- purge : une seule ligne de journal
  if new.statut is distinct from old.statut or new.chemin_fichier is distinct from old.chemin_fichier then
    perform journaliser(new.dossier_id, 'document', new.nom || ' : ' || case
      when new.statut = 'envoye' then 'envoyé par le client depuis son espace (à vérifier)'
      when new.statut = 'valide' and new.chemin_fichier is distinct from old.chemin_fichier then 'reçu à l''agence et téléversé ✔'
      when new.statut = 'valide' then 'validé ✔'
      when new.statut = 'refuse' then 'refusé – ' || coalesce(new.motif_refus, '')
      else 'remis à fournir' end);
  end if;
  return null;
end $$;
drop trigger if exists documents_journal on documents;
create trigger documents_journal after insert or update on documents for each row execute function tg_documents_journal();

-- ------------------------------------------------------------------ Triggers : frais

create or replace function tg_frais_avant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.verse is distinct from old.verse then
    new.verse_le := case when new.verse then now() end;
    new.verse_par := case when new.verse then auth.uid() end;
  end if;
  return new;
end $$;
drop trigger if exists frais_avant on frais;
create trigger frais_avant before update on frais for each row execute function tg_frais_avant();

create or replace function tg_frais_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verse is distinct from old.verse then
    perform journaliser(new.dossier_id, 'paiement',
      case when new.verse then new.nom || ' versé à ' || new.organisme else new.nom || ' : versement annulé' end, true);
  end if;
  return null;
end $$;
drop trigger if exists frais_journal on frais;
create trigger frais_journal after update on frais for each row execute function tg_frais_journal();

-- ------------------------------------------------------------------ Triggers : étapes

create or replace function tg_etapes_avant() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bloquants text;
begin
  if new.faite and (tg_op = 'INSERT' or not old.faite) then
    -- Une étape ne se valide que si ses frais requis sont encaissés à 100 %.
    select string_agg(f.nom, ', ' order by f.ordre) into v_bloquants
    from frais f
    where f.id = any (new.frais_requis) and f.montant > total_paye('frais', f.id);
    if v_bloquants is not null then
      raise exception 'Étape bloquée : frais non encaissés (%). Les frais de procédure se paient à 100 %% d''avance.', v_bloquants;
    end if;
    new.faite_le := now();
    new.faite_par := auth.uid();
  elsif not new.faite then
    new.faite_le := null;
    new.faite_par := null;
  elsif tg_op = 'UPDATE' then
    new.faite_le := old.faite_le;
    new.faite_par := old.faite_par;
  end if;
  return new;
end $$;
drop trigger if exists etapes_avant on etapes;
create trigger etapes_avant before insert or update on etapes for each row execute function tg_etapes_avant();

create or replace function tg_etapes_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.faite is distinct from old.faite then
    if new.faite then
      perform journaliser(new.dossier_id, 'etape', 'Étape terminée : ' || new.nom);
    else
      perform journaliser(new.dossier_id, 'etape', 'Étape rouverte : ' || new.nom, true);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists etapes_journal on etapes;
create trigger etapes_journal after update on etapes for each row execute function tg_etapes_journal();

-- ------------------------------------------------------------------ Triggers : montants (frais, échéances, étapes)

-- Hors administrateur : une fois créés, seuls « versé » (frais) et « faite » (étapes) changent.
-- À la création, les montants doivent être ceux du type de dossier (pas d'honoraires réduits en douce).
create or replace function tg_montants_garde() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_libres text[] := array['verse', 'verse_le', 'verse_par', 'faite', 'faite_le', 'faite_par'];
  v_modele modeles;
  v_moitie numeric;
  v_diff text[];
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if est_admin() then
      -- Changements de l'administrateur : tracés en interne.
      select array_agg(k) into v_diff from jsonb_each(to_jsonb(new) - v_libres) e(k, v)
      where k in ('montant', 'devise', 'frais_requis', 'libelle', 'moment') and v is distinct from to_jsonb(old) -> k;
      if v_diff is not null then
        perform journaliser(new.dossier_id, 'statut', 'Modifié par un administrateur (' || tg_table_name || ' : '
          || array_to_string(v_diff, ', ') || ') : ' || coalesce(to_jsonb(old) ->> 'nom', to_jsonb(old) ->> 'libelle', ''), true);
      end if;
      return new;
    end if;
    if (to_jsonb(new) - v_libres) <> (to_jsonb(old) - v_libres) then
      raise exception 'Montants, devises, libellés et frais requis : modification réservée à un administrateur.';
    end if;
    return new;
  end if;

  -- INSERT par un agent : conforme au type de dossier.
  if est_admin() then return new; end if;
  select m.* into v_modele from modeles m join dossiers d on d.modele_id = m.id where d.id = new.dossier_id;
  if v_modele.id is null then
    raise exception 'Dossier sans type : seul un administrateur peut ajouter des montants.';
  end if;
  if tg_table_name = 'echeances' then
    v_moitie := round(v_modele.honoraires / 2);
    if new.devise <> v_modele.devise_honoraires
       or new.montant <> (case when new.moment = 'depot' then v_moitie else v_modele.honoraires - v_moitie end) then
      raise exception 'Échéance non conforme aux honoraires du type de dossier.';
    end if;
  elsif tg_table_name = 'frais' then
    if not exists (select 1 from jsonb_array_elements(v_modele.frais) f
                   where (f ->> 'montant')::numeric = new.montant and f ->> 'devise' = new.devise and f ->> 'nom' = new.nom) then
      raise exception 'Frais non conforme au type de dossier.';
    end if;
  elsif tg_table_name = 'etapes' then
    if not exists (select 1 from jsonb_array_elements(v_modele.etapes) e
                   where e ->> 'nom' = new.nom
                     and jsonb_array_length(coalesce(e -> 'fraisRequis', '[]')) = cardinality(new.frais_requis)) then
      raise exception 'Étape non conforme au type de dossier.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists frais_garde on frais;
create trigger frais_garde before insert or update on frais for each row execute function tg_montants_garde();
drop trigger if exists echeances_garde on echeances;
create trigger echeances_garde before insert or update on echeances for each row execute function tg_montants_garde();
drop trigger if exists etapes_garde on etapes;
create trigger etapes_garde before insert or update on etapes for each row execute function tg_montants_garde();

-- ------------------------------------------------------------------ Triggers : paiements

create or replace function tg_paiements_avant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_montant numeric; v_devise text; v_dossier uuid; v_reste numeric;
  v_figes text[] := array['annule_le', 'annule_par', 'motif_annulation'];
begin
  if tg_op = 'DELETE' then
    raise exception 'Un paiement ne se supprime jamais : il s''annule, avec un motif.';
  end if;

  if tg_op = 'INSERT' then
    -- Verrou sur la cible : deux encaissements simultanés ne peuvent pas dépasser le reste.
    if new.cible_type = 'echeance' then
      select montant, devise, dossier_id into v_montant, v_devise, v_dossier from echeances where id = new.cible_id for update;
    else
      select montant, devise, dossier_id into v_montant, v_devise, v_dossier from frais where id = new.cible_id for update;
    end if;
    if v_dossier is null or v_dossier <> new.dossier_id then
      raise exception 'Échéance ou frais introuvable dans ce dossier.';
    end if;
    if new.devise <> v_devise then
      raise exception 'La devise ne correspond pas (attendu : %).', v_devise;
    end if;
    if (select statut from dossiers where id = new.dossier_id) = 'annule' then
      raise exception 'Dossier annulé : aucun encaissement possible. Rouvrez-le d''abord.';
    end if;
    v_reste := greatest(0, v_montant - total_paye(new.cible_type, new.cible_id));
    if new.montant > v_reste then
      raise exception 'Le montant dépasse le reste à payer (%).', format_montant(v_reste, v_devise);
    end if;
    new.numero_recu := prochain_numero('recu');
    new.date := now();
    new.par := coalesce(auth.uid(), new.par);
    new.annule_le := null; new.annule_par := null; new.motif_annulation := null;
    return new;
  end if;

  -- UPDATE : uniquement l'annulation, une seule fois, par un administrateur, avec motif.
  if (to_jsonb(new) - v_figes) <> (to_jsonb(old) - v_figes) then
    raise exception 'Un paiement enregistré ne peut pas être modifié ; annulez-le et encaissez à nouveau.';
  end if;
  if old.annule_le is not null then
    raise exception 'Ce paiement est déjà annulé.';
  end if;
  if new.annule_le is null then
    return new;  -- rien ne change
  end if;
  if not est_admin() then
    raise exception 'Seul un administrateur peut annuler un paiement.';
  end if;
  if coalesce(trim(new.motif_annulation), '') = '' then
    raise exception 'Le motif d''annulation est obligatoire.';
  end if;
  new.annule_le := now();
  new.annule_par := auth.uid();
  return new;
end $$;
drop trigger if exists paiements_avant on paiements;
create trigger paiements_avant before insert or update or delete on paiements for each row execute function tg_paiements_avant();

create or replace function tg_paiements_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_libelle text;
begin
  if tg_op = 'INSERT' then
    if new.cible_type = 'echeance' then select libelle into v_libelle from echeances where id = new.cible_id;
    else select nom into v_libelle from frais where id = new.cible_id; end if;
    perform journaliser(new.dossier_id, 'paiement', 'Encaissement ' || format_montant(new.montant, new.devise)
      || ' – ' || coalesce(v_libelle, '') || ' (reçu ' || new.numero_recu || ')');
  elsif new.annule_le is not null and old.annule_le is null then
    perform journaliser(new.dossier_id, 'paiement', 'Paiement ' || new.numero_recu || ' annulé – ' || new.motif_annulation);
  end if;
  return null;
end $$;
drop trigger if exists paiements_journal on paiements;
create trigger paiements_journal after insert or update on paiements for each row execute function tg_paiements_journal();

-- Le journal est en ajout seul : date et auteur imposés par le serveur.
create or replace function tg_journal_avant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.par := auth.uid();
    new.date := now();
  end if;
  return new;
end $$;
drop trigger if exists journal_avant on journal;
create trigger journal_avant before insert on journal for each row execute function tg_journal_avant();

-- ------------------------------------------------------------------ Sécurité (RLS)

alter table profils enable row level security;
alter table parametres enable row level security;
alter table compteurs enable row level security;
alter table clients enable row level security;
alter table modeles enable row level security;
alter table dossiers enable row level security;
alter table documents enable row level security;
alter table frais enable row level security;
alter table etapes enable row level security;
alter table echeances enable row level security;
alter table paiements enable row level security;
alter table journal enable row level security;
alter table acces_documents enable row level security;
alter table securite enable row level security;

-- Les visiteurs non connectés n'ont accès à rien.
revoke all on profils, parametres, compteurs, clients, modeles, dossiers, documents, frais, etapes, echeances, paiements, journal,
  acces_documents, securite from anon;
-- TRUNCATE ignore les règles RLS : retiré à tous les comptes de l'application (comme REFERENCES et TRIGGER).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Les consultations et les réglages de sécurité s'écrivent uniquement par le serveur.
revoke insert, update, delete on acces_documents, securite from authenticated;
-- Aucune suppression de dossier ni de document (voir purger_dossier).
revoke delete on dossiers, documents from authenticated;
-- Personne (hors administrateur de la base) ne supprime un paiement ni une ligne du journal, ni ne touche aux compteurs.
revoke delete on paiements, journal from authenticated;
revoke update on journal from authenticated;
revoke insert, update, delete on compteurs from authenticated;

do $$
declare p record;
begin
  -- Repartir de zéro pour les règles d'accès (permet de relancer le script).
  for p in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('profils','parametres','compteurs','clients','modeles','dossiers','documents','frais','etapes','echeances','paiements','journal','acces_documents','securite')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Profils : le personnel voit l'équipe ; chacun voit son profil ; l'administrateur gère.
create policy profils_lire on profils for select to authenticated using (est_personnel() or id = auth.uid());
create policy profils_admin_maj on profils for update to authenticated using (est_admin()) with check (est_admin());

-- Paramètres et modèles : lisibles par tout compte connecté, modifiables par un administrateur.
create policy parametres_lire on parametres for select to authenticated using (true);
create policy parametres_admin on parametres for update to authenticated using (est_admin()) with check (est_admin());
create policy parametres_admin_creer on parametres for insert to authenticated with check (est_admin());
create policy modeles_lire on modeles for select to authenticated using (true);
create policy modeles_admin_creer on modeles for insert to authenticated with check (est_admin());
create policy modeles_admin_maj on modeles for update to authenticated using (est_admin()) with check (est_admin());

create policy compteurs_lire on compteurs for select to authenticated using (est_personnel());
create policy securite_lire on securite for select to authenticated using (true);
create policy acces_documents_admin on acces_documents for select to authenticated using (est_admin());

-- Clients
create policy clients_personnel_lire on clients for select to authenticated using (est_personnel());
create policy clients_personnel_creer on clients for insert to authenticated with check (est_personnel());
create policy clients_personnel_maj on clients for update to authenticated using (est_personnel()) with check (est_personnel());
create policy clients_admin_suppr on clients for delete to authenticated using (est_admin());
create policy clients_soi on clients for select to authenticated using (compte_id = auth.uid() or compte_suivi_id = auth.uid());

-- Dossiers
create policy dossiers_personnel_lire on dossiers for select to authenticated using (est_personnel());
create policy dossiers_personnel_creer on dossiers for insert to authenticated with check (est_personnel());
create policy dossiers_personnel_maj on dossiers for update to authenticated using (est_personnel()) with check (est_personnel());
create policy dossiers_client on dossiers for select to authenticated using (id in (select mes_dossiers()));

-- Documents : le client lit les siens et ne peut qu'« envoyer » (contrôle fin dans tg_documents_avant).
create policy documents_personnel_lire on documents for select to authenticated using (est_personnel());
create policy documents_personnel_creer on documents for insert to authenticated with check (est_personnel());
create policy documents_personnel_maj on documents for update to authenticated using (est_personnel()) with check (est_personnel());
create policy documents_client_lire on documents for select to authenticated using (dossier_id in (select mes_dossiers()));
create policy documents_client_envoyer on documents for update to authenticated
  using (dossier_id in (select mes_dossiers()) and statut in ('manquant', 'refuse'))
  with check (dossier_id in (select mes_dossiers()) and statut = 'envoye');

-- Frais, étapes, échéances : personnel (lecture/écriture), client (lecture de ses dossiers).
create policy frais_personnel_lire on frais for select to authenticated using (est_personnel());
create policy frais_personnel_creer on frais for insert to authenticated with check (est_personnel());
create policy frais_personnel_maj on frais for update to authenticated using (est_personnel()) with check (est_personnel());
create policy frais_client on frais for select to authenticated using (dossier_id in (select mes_dossiers()));
create policy etapes_personnel_lire on etapes for select to authenticated using (est_personnel());
create policy etapes_personnel_creer on etapes for insert to authenticated with check (est_personnel());
create policy etapes_personnel_maj on etapes for update to authenticated using (est_personnel()) with check (est_personnel());
create policy etapes_client on etapes for select to authenticated using (dossier_id in (select mes_dossiers()));
create policy echeances_personnel_lire on echeances for select to authenticated using (est_personnel());
create policy echeances_personnel_creer on echeances for insert to authenticated with check (est_personnel());
create policy echeances_personnel_maj on echeances for update to authenticated using (est_personnel()) with check (est_personnel());
create policy echeances_client on echeances for select to authenticated using (dossier_id in (select mes_dossiers()));

-- Paiements : lecture (personnel, client concerné) ; encaissement par le personnel ;
-- modification = annulation par un administrateur seulement ; AUCUNE règle de suppression.
-- Un agent ne lit que les paiements des dossiers dont il a la charge ou qu'il a encaissés (pas de caisse globale) ;
-- pour les autres dossiers, il ne reçoit que les totaux par échéance/frais (fonction paiements_resumes).
create policy paiements_lire on paiements for select to authenticated using (
  est_admin()
  or (est_personnel() and (par = auth.uid() or dossier_id in (select id from dossiers where agent_id = auth.uid())))
  or dossier_id in (select mes_dossiers()));
create policy paiements_creer on paiements for insert to authenticated with check (est_personnel() and par = auth.uid());
create policy paiements_annuler on paiements for update to authenticated using (est_admin()) with check (est_admin());

-- Journal : ajout seul par le personnel (notes, messages) ; le client lit ce qui n'est pas interne.
-- Les lignes « paiement » (montants) suivent la même règle que les paiements (M-1).
create policy journal_personnel_lire on journal for select to authenticated using (
  est_admin()
  or (est_personnel() and (type <> 'paiement' or par = auth.uid()
                           or dossier_id in (select id from dossiers where agent_id = auth.uid()))));
-- Le personnel n'ajoute que des notes et des messages : les autres lignes viennent des triggers (pas de faux encaissement).
create policy journal_personnel_ajout on journal for insert to authenticated with check (est_personnel() and type in ('note', 'message'));
create policy journal_client on journal for select to authenticated using (not interne and dossier_id in (select mes_dossiers()));

-- ------------------------------------------------------------------ Fonctions appelées par l'application

-- Totaux encaissés par échéance / frais, pour les dossiers dont l'agent n'a pas la charge :
-- il peut ainsi calculer le reste à payer et débloquer les étapes, sans voir dates, modes ni reçus.
create or replace function paiements_resumes()
returns table (dossier_id uuid, cible_type text, cible_id uuid, devise text, total numeric)
language sql stable security definer set search_path = public as
$$ select p.dossier_id, p.cible_type, p.cible_id, p.devise, sum(p.montant)
   from paiements p
   where est_personnel() and p.annule_le is null
   group by p.dossier_id, p.cible_type, p.cible_id, p.devise $$;
revoke execute on function paiements_resumes() from public, anon;
grant execute on function paiements_resumes() to authenticated;

-- Avant chaque ouverture de fichier : vérifie le droit d'accès et enregistre la consultation.
-- Renvoie le chemin à signer. Le navigateur ne crée une URL signée qu'après cet appel.
create or replace function tracer_acces(p_chemin text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_doc uuid;
begin
  select id into v_doc from documents
  where chemin_fichier = p_chemin and (est_personnel() or dossier_id in (select mes_dossiers()));
  if v_doc is null then raise exception 'Accès refusé à ce fichier.'; end if;
  insert into acces_documents (par, document_id, chemin) values (auth.uid(), v_doc, p_chemin);
  return p_chemin;
end $$;
revoke execute on function tracer_acces(text) from public, anon;
grant execute on function tracer_acces(text) to authenticated;

-- Enregistre (ou retire) le consentement écrit du titulaire pour l'accès du parent (personnel uniquement).
create or replace function enregistrer_consentement_suivi(p_client uuid, p_accorde boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not est_personnel() then raise exception 'Réservé au personnel de l''agence.'; end if;
  if not exists (select 1 from clients where id = p_client) then raise exception 'Client introuvable.'; end if;
  update clients set consentement_suivi_le = case when p_accorde then now() end where id = p_client;
  -- Retrait du consentement : l'accès du parent est coupé immédiatement.
  if not p_accorde then
    perform set_config('wd.retrait_consentement', 'oui', true);
    update clients set compte_suivi_id = null where id = p_client;
  end if;
end $$;
revoke execute on function enregistrer_consentement_suivi(uuid, boolean) from public, anon;
grant execute on function enregistrer_consentement_suivi(uuid, boolean) to authenticated;

-- Purge d'un dossier (fin de la durée de conservation, demande du client) : administrateur uniquement.
-- Les fichiers sont d'abord effacés par l'application via l'API Storage (store.ts › purgerDossier) ;
-- cette fonction efface les références restantes, anonymise la fiche si demandé et laisse une trace.
-- Paiements, reçus et journal sont CONSERVÉS (obligations comptables).
create or replace function purger_dossier(p_dossier uuid, p_anonymiser boolean default false) returns int
language plpgsql volatile security definer set search_path = public as $$
declare v_n int; v_client uuid;
begin
  -- auth.uid() nul = éditeur SQL de Supabase (propriétaire du projet) : autorisé.
  if auth.uid() is not null and not est_admin() then raise exception 'Seul un administrateur peut purger un dossier.'; end if;
  select client_id into v_client from dossiers where id = p_dossier;
  if v_client is null then raise exception 'Dossier introuvable.'; end if;
  -- Effacement direct des objets si l'instance l'autorise (sinon déjà fait par l'API Storage).
  begin
    delete from storage.objects where bucket_id = 'documents' and name like p_dossier::text || '/%';
  exception when others then null;
  end;
  perform set_config('wd.purge', 'oui', true);
  update documents set chemin_fichier = null, nom_fichier = null, type_fichier = null
  where dossier_id = p_dossier and (chemin_fichier is not null or nom_fichier is not null);
  get diagnostics v_n = row_count;
  perform set_config('wd.purge', 'non', true);
  perform journaliser(p_dossier, 'statut', 'Purge : ' || v_n || ' fichier(s) effacé(s) (statuts conservés)', true);
  if p_anonymiser then
    update clients set nom = 'Anonymisé', prenom = '—', telephone = '', email = '', date_naissance = null,
      adresse = null, contact_suivi = null, compte_id = null, compte_suivi_id = null, consentement_suivi_le = null
    where id = v_client;
    perform journaliser(p_dossier, 'statut', 'Purge : fiche client anonymisée', true);
  end if;
  return v_n;
end $$;
revoke execute on function purger_dossier(uuid, boolean) from public, anon;
grant execute on function purger_dossier(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------ Fichiers (Storage)
-- Bucket privé « documents » ; chemin = <dossier_id>/<fichier>. 10 Mo maximum, PDF et images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wd_documents_lire on storage.objects;
drop policy if exists wd_documents_envoyer on storage.objects;
drop policy if exists wd_documents_personnel_maj on storage.objects;
drop policy if exists wd_documents_admin_suppr on storage.objects;

create policy wd_documents_lire on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (
    est_personnel()
    or (storage.foldername(name))[1] in (select d::text from mes_dossiers() d)
  ));
create policy wd_documents_envoyer on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and (
    est_personnel()
    or (storage.foldername(name))[1] in (select d::text from mes_dossiers() d)
  ));
-- Pas de règle de modification : un fichier envoyé ne peut pas être remplacé (chaque envoi a un nom neuf).
create policy wd_documents_admin_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and est_admin());

-- ------------------------------------------------------------------ Temps réel
-- Les écrans se mettent à jour quand un collègue (ou un client) modifie un dossier.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  -- « compteurs » n'est pas publié (inutile aux écrans) ; retiré s'il l'était par une version précédente.
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'compteurs') then
    alter publication supabase_realtime drop table public.compteurs;
  end if;
  foreach t in array array['profils','parametres','clients','modeles','dossiers','documents','frais','etapes','echeances','paiements','journal']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Ligne unique des paramètres (les valeurs se règlent ensuite dans l'application).
insert into parametres (id) values (1) on conflict (id) do nothing;
