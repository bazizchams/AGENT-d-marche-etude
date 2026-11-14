-- Schéma de la version en ligne (Supabase / PostgreSQL).
-- PRÉPARÉ, PAS ENCORE BRANCHÉ : l'application fonctionne aujourd'hui en mode démonstration (navigateur).
-- Principe : chaque client ne voit que ses dossiers ; un agent ne peut ni supprimer ni annuler un paiement.

create type role_utilisateur as enum ('admin', 'agent', 'client');

create table profils (
  id uuid primary key references auth.users on delete cascade,
  nom text not null,
  role role_utilisateur not null default 'client',
  actif boolean not null default true
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references auth.users,           -- compte de l'espace client (lien magique)
  compte_suivi_id uuid references auth.users,     -- parent qui suit le dossier
  nom text not null, prenom text not null, telephone text not null, email text,
  date_naissance date, adresse text, langue text not null default 'fr' check (langue in ('fr','ar')),
  cree_le timestamptz not null default now(), cree_par uuid references profils
);

create table modeles (
  id uuid primary key default gen_random_uuid(),
  nom text not null, couleur text, honoraires numeric not null, devise_honoraires text not null,
  documents jsonb not null, etapes jsonb not null, frais jsonb not null, actif boolean not null default true
);

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,
  client_id uuid not null references clients on delete restrict,
  modele_id uuid references modeles,
  intitule text not null,
  agent_id uuid references profils,
  statut text not null default 'en_cours' check (statut in ('en_cours','termine','annule')),
  ouvert_le timestamptz not null default now(),
  rdv_date timestamptz, rdv_lieu text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  nom text not null,
  statut text not null default 'manquant' check (statut in ('manquant','envoye','valide','refuse')),
  avec_expiration boolean not null default false, expiration date,
  chemin_fichier text, nom_fichier text, motif_refus text,
  maj_le timestamptz, maj_par uuid references auth.users
);

create table etapes (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  ordre int not null, nom text not null, frais_requis uuid[] not null default '{}',
  faite boolean not null default false, faite_le timestamptz, faite_par uuid references profils
);

create table echeances (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  libelle text not null, moment text not null check (moment in ('depot','fin')),
  montant numeric not null, devise text not null
);

create table frais (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  nom text not null, organisme text, montant numeric not null, devise text not null,
  verse boolean not null default false, verse_le timestamptz, verse_par uuid references profils
);

create table paiements (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete restrict,
  numero_recu text unique not null,
  cible_type text not null check (cible_type in ('echeance','frais')), cible_id uuid not null,
  montant numeric not null check (montant > 0), devise text not null, mode text not null,
  date timestamptz not null default now(), par uuid not null references profils,
  annule_le timestamptz, annule_par uuid references profils, motif_annulation text
);

create table journal (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers on delete cascade,
  date timestamptz not null default now(), par uuid references auth.users,
  type text not null, texte text not null, interne boolean not null default false
);

-- ---------- Sécurité (Row Level Security) ----------
create function mon_role() returns role_utilisateur language sql stable security definer as
  $$ select role from profils where id = auth.uid() and actif $$;
create function est_personnel() returns boolean language sql stable as
  $$ select coalesce(mon_role() in ('admin','agent'), false) $$;
create function mes_dossiers() returns setof uuid language sql stable security definer as
  $$ select d.id from dossiers d join clients c on c.id = d.client_id
     where c.compte_id = auth.uid() or c.compte_suivi_id = auth.uid() $$;

alter table profils enable row level security;
alter table clients enable row level security;
alter table modeles enable row level security;
alter table dossiers enable row level security;
alter table documents enable row level security;
alter table etapes enable row level security;
alter table echeances enable row level security;
alter table frais enable row level security;
alter table paiements enable row level security;
alter table journal enable row level security;

create policy personnel_profils on profils for select using (est_personnel() or id = auth.uid());
create policy admin_profils on profils for all using (mon_role() = 'admin');
create policy personnel_modeles on modeles for select using (est_personnel());
create policy admin_modeles on modeles for all using (mon_role() = 'admin');

create policy personnel_clients on clients for all using (est_personnel());
create policy client_soi on clients for select using (compte_id = auth.uid() or compte_suivi_id = auth.uid());

-- Personnel : accès complet aux dossiers ; client : lecture de ses dossiers.
create policy personnel_dossiers on dossiers for all using (est_personnel());
create policy client_dossiers on dossiers for select using (id in (select mes_dossiers()));
create policy personnel_documents on documents for all using (est_personnel());
create policy client_documents_lire on documents for select using (dossier_id in (select mes_dossiers()));
-- Le client ne peut que passer un document manquant/refusé à « envoyé » (contrôlé par un trigger côté serveur).
create policy client_documents_envoyer on documents for update
  using (dossier_id in (select mes_dossiers()) and statut in ('manquant','refuse'))
  with check (statut = 'envoye');
create policy personnel_etapes on etapes for all using (est_personnel());
create policy client_etapes on etapes for select using (dossier_id in (select mes_dossiers()));
create policy personnel_echeances on echeances for all using (est_personnel());
create policy client_echeances on echeances for select using (dossier_id in (select mes_dossiers()));
create policy personnel_frais on frais for all using (est_personnel());
create policy client_frais on frais for select using (dossier_id in (select mes_dossiers()));

-- Paiements : jamais de suppression ; insertion par le personnel ; annulation par un admin seulement.
create policy paiements_lire on paiements for select using (est_personnel() or dossier_id in (select mes_dossiers()));
create policy paiements_creer on paiements for insert with check (est_personnel() and par = auth.uid());
create policy paiements_annuler on paiements for update using (mon_role() = 'admin');

create policy journal_personnel on journal for all using (est_personnel());
create policy journal_client on journal for select using (not interne and dossier_id in (select mes_dossiers()));

-- Fichiers : bucket privé « documents », chemin = <dossier_id>/<fichier>.
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
