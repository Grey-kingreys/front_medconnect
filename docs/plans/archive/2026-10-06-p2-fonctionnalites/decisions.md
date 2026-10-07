# Décisions - run 2026-10-06-p2-fonctionnalites

Append-only. Une ligne par décision. Consulter par grep avant toute question.

Format : `D<NN> | AAAA-MM-JJ | <décision> | <pourquoi> | tranché par : plan, convention, défaut (révisable) ou user | tâches : T..`

Les décisions D01 à D09 du run jumeau back (back_medconnect, même nom de run) s'appliquent aussi ici, en particulier D01, D02, D03 (SOS), D07 et D08 (import Excel).

D10 | 2026-10-06 | Un seul composant de saisie des médicaments d'ordonnance, partagé par les deux formulaires (`components/OrdonnanceMedicamentsInput.tsx`) | deux usages identiques, consigne de tête | plan | T05
D11 | 2026-10-06 | Notifications à l'écran : un composant et un hook partagés (`components/Toast.tsx`, `hooks/useToast.tsx`) remplacent les `alert()` natifs ; les toasts locaux déjà présents dans certaines pages ne sont pas migrés | règle de trois atteinte, mais migrer l'existant est hors tâche | défaut (révisable) | T09
D12 | 2026-10-06 | Réseau : délai d'attente 20 s, 2 nouvelles tentatives (1 s puis 3 s) sur les lectures (GET) seulement, jamais sur les écritures | éviter les doublons d'écriture (ordonnance, SOS) | défaut (révisable) | T09
D13 | 2026-10-06 | Liens de menu vers des pages inexistantes (`/dashboard/stats`, `/dashboard/config`, `/dashboard/securite`) masqués par une liste centrale, code conservé | consigne de tête : masquer plutôt que créer des pages vides | plan | T08
D14 | 2026-10-06 | Patient SOS : l'état « pris en charge » est lu par interrogation périodique de l'alerte en cours (sans ouvrir de nouvelle connexion en direct si aucune n'existe côté patient) | simplicité, robustesse sur réseau instable | défaut (révisable) | T06
D15 | 2026-10-07 | Lint des fichiers touchés : correction des erreurs sur les lignes de la tâche ; dette préexistante neutralisée par un seul `/* eslint-disable <règles exactes> */` en tête de fichier (après `"use client"`), précédé de « Dette préexistante, backlog points 21 et 22 » (reprise de D05 du run p1-beta et de D10 du run jumeau back) | le pre-commit lint tout fichier indexé, pas de refactor hors tâche | convention | toutes
D16 | 2026-10-07 | Run repris sans sous-agents (ils se figent) : l'orchestrateur exécute lui-même les tâches, un commit par tâche ; parcours navigateur et relecture « utilisateur novice » non joués (aucun serveur ni base) | consigne de l'orchestrateur de tête | user | toutes
D17 | 2026-10-07 | Tâche T11 ajoutée : formulaires de vaccination, `prochainRappel` vide non envoyé (le DTO back attend une date) | bug signalé par le run P3 | plan | T11
