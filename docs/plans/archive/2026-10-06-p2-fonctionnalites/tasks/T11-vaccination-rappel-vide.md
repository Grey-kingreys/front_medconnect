# T11 - Vaccination : ne pas envoyer un rappel vide

Tier: spécifié (exécutée par l'orchestrateur, D16)
Audience: non-dev (médecin)
Visuel: n/a
Background-safe: oui

## Spec

Bug signalé par le run P3 (D17). Les deux formulaires de vaccination (`src/components/DoctorAddRecordModal.tsx`, `src/app/dashboard/carnet/[patientId]/components/AddRecordForms.tsx`) envoient `prochainRappel: ""` quand le rappel est laissé vide ; le DTO back attend une date et refuse l'envoi. Correctif : ne pas envoyer le champ quand il est vide. Les schémas Zod de P3 (branche `orch/p3-fond`) ne sont pas une dépendance.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des deux fichiers sans erreur.
- Les deux appels `createVaccination` passent `prochainRappel: form.prochainRappel || undefined` (supprimé par la sérialisation JSON).

## Historique

- 2026-10-07 : exécutée directement par l'orchestrateur de reprise.

## Validation

- `npx --no-install tsc --noEmit` : 0 erreur.
- `npx --no-install eslint` (2 fichiers) : 0 erreur, 2 avertissements préexistants.
- `grep -n "prochainRappel: form.prochainRappel || undefined"` : 1 occurrence dans chacun des deux formulaires.
