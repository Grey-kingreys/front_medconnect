# Décisions - run 2026-10-20-lot1

Append-only. Une ligne par décision. Consulter par grep avant toute question.

Format : `D<NN> | AAAA-MM-JJ | <décision> | <pourquoi> | tranché par : plan, convention, défaut (révisable) ou user | tâches : T..`

D01 | 2026-10-20 | L'écoute des alertes SOS (EmergencyListener) se base uniquement sur `profile?.permissions?.includes("sos:respond")` de useAuth, sans repli sur le rôle | même source que le serveur (diffusion SOS filtrée par sos:respond) et même motif que catalogue/page.tsx (`catalogue:write`) | plan | tâches : F1
D02 | 2026-10-20 | Tant que le profil (GET /auth/me) n'est pas chargé, aucune connexion en direct n'est ouverte ; elle s'ouvre dès que le profil arrive | pas de repli sur le rôle mis en cache (sinon un médecin privé de sos:respond recevrait l'alerte quelques instants) ; le serveur n'émet de toute façon qu'aux titulaires de la permission | défaut (révisable) | tâches : F1
D03 | 2026-10-20 | La connexion se refait seulement si l'utilisateur ou le droit change (dépendances de l'effet : `user?.id` et le booléen de permission), pas à chaque rafraîchissement du profil ; perte du droit = déconnexion | éviter les reconnexions inutiles sur réseau instable, et couper l'écoute si le droit est retiré | défaut (révisable) | tâches : F1
D04 | 2026-10-20 | Code de permission écrit en littéral `"sos:respond"` dans le composant, pas de fichier de constantes front | un seul usage côté front (règle de trois), même choix que `catalogue:write` | convention | tâches : F1
D05 | 2026-10-20 | EmergencyButton (côté patient, envoi du SOS) reste filtré par rôle PATIENT, hors périmètre de F1 | il ne filtre pas l'écoute des alertes ; seul EmergencyListener le fait (vérifié par grep) | plan | tâches : F1
D06 | 2026-10-20 | Pas de nettoyage de la dette lint d'EmergencyListener (en-tête eslint-disable dupliqué, imports inutilisés) dans F1 | refactor non demandé ; critère : 0 erreur eslint, les 3 avertissements préexistants tolérés | convention | tâches : F1
