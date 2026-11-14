#!/usr/bin/env bash
# Rejoue schema.sql + seed.sql + les vérifications de sécurité sur un PostgreSQL local VIDE.
# Usage : PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/lancer.sh   (crée/écrase la base « wd_test »)
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd)
P="psql -v ON_ERROR_STOP=1 -q -t"
$P -d postgres -c "drop database if exists wd_test" -c "create database wd_test"
$P -d wd_test -f "$D/stub-supabase.sql"
$P -d wd_test -f "$D/../schema.sql" 2>/dev/null
$P -d wd_test -f "$D/../seed.sql"
$P -d wd_test -f "$D/verifications.sql" 2>&1 | grep -E "OK|ÉCHEC|ERROR"
