# Agent Ausbildung (placement de candidats étrangers en Allemagne)

Agent Claude Code qui analyse le dossier d'un client (CV, diplômes, certificats de langue, passeport), cherche des offres d'Ausbildung, prépare lettres et CV en allemand, crée des brouillons e-mail et suit les candidatures.

## Installation (ordinateur local, sans filtre réseau)
1. Installer Claude Code: https://code.claude.com/docs/en/quickstart
2. `git clone https://github.com/bazizchams/AGENT-d-marche-etude.git`
3. `cd AGENT-d-marche-etude && git checkout claude/ausbildung-companies-germany-tya8x2`
4. Créer le dossier du client: `mkdir -p clients/prenom-nom` et y mettre ses documents (PDF/photos). Le dossier `clients/` n'est jamais envoyé sur GitHub (données personnelles).
5. Lancer `claude`, puis taper: `/nouveau-dossier prenom-nom`

## Contenu
- `.claude/agents/ausbildung-recruiter.md`: l'agent
- `.claude/commands/nouveau-dossier.md`: la commande `/nouveau-dossier`
- `knowledge/ausbildung-playbook.md`: règles de langue, pièces, CV/lettre, sources d'offres, leçons

## Règles
- Aucun envoi sans validation de l'utilisateur. Les candidatures restent en brouillon.
- Une offre n'est « vérifiée » qu'après lecture de la page de l'employeur ou de la Bundesagentur.
- Aucune promesse de contrat: le résultat dépend des employeurs et du visa.
