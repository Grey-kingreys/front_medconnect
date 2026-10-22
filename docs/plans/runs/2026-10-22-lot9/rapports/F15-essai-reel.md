# F15 - Essai réel contre le back local (lecture seule)

Date : 2026-10-22. Back : http://localhost:3101, démo active. Jeton masqué en `<jeton>`.

## Commandes (équivalent des `curl`, lancées par un script Node avec `fetch`)

1. `GET /auth/demo/comptes` : HTTP 200, 7 comptes.
2. Pour chaque compte : `POST /auth/demo/connexion` `{ "userId": "<id>" }` : HTTP 200, `data.access_token` = `<jeton>`.
3. Avec `Authorization: Bearer <jeton>`, uniquement des GET :
   - `GET /auth/me` : HTTP 200 pour les deux comptes
   - `GET /pharmacie/<structureId>/ventes` : HTTP 200 pour les deux comptes
   - `GET /structures/my` : HTTP 200 pour les deux comptes

## Administrateur (admin.kaloum@demo.medconnecte.gn)

1. `/auth/me` : `structureType: "PHARMACIE"`, `structureId` 4adb3b70-eed7-49f2-b483-4efa942bad78, permissions : structure:read, structure:write, membre:read, membre:manage, role:manage, vente:read, vente:write, vente:annuler, stock:read, stock:write. Vue attendue (D16) : **pilotage** (structure:write et vente:annuler présents).
2. `/pharmacie/<structureId>/ventes` : `totalJour` 12000, `nombre` 10, `totalPages` 1, 10 ventes lues dont 6 `ANNULEE`.
3. `/structures/my` : 1 membre, 1 actif.
4. Chiffres que la vue doit afficher :
   - Encaissé aujourd'hui : 12 000 GNF (« Ventes validées, sans les annulations »)
   - Ventes enregistrées : 10 (« Aujourd'hui, annulations comprises »)
   - Ventes annulées : 6 (« Aujourd'hui »)
   - Membres actifs : 1 (« sur 1 membre de l'équipe »)
   - Le stock s'affiche sous le titre « Votre stock ».

## Pharmacien (ousmane.keita@demo.medconnecte.gn)

1. `/auth/me` : `structureType: "PHARMACIE"`, même `structureId`, permissions : stock:read, stock:write, catalogue:write, chat:structure, structure:read, membre:read, vente:read, vente:write. Vue attendue (D16) : **comptoir** (ni structure:write ni vente:annuler).
2. `/pharmacie/<structureId>/ventes` : même réponse que l'administrateur (`totalJour` 12000, `nombre` 10, `totalPages` 1, 6 `ANNULEE`). Résultat D18 pour ce vendeur : 4 ventes `VALIDEE` pour 12000 GNF, 4 `ANNULEE`.
3. `/structures/my` : 1 membre, 1 actif.
4. Chiffres que la vue doit afficher :
   - Montant de mes ventes : 12 000 GNF
   - Mes ventes : 4, sous-texte « 4 ventes annulées, non comptées »
   - Pas de mention « Calculé sur les N dernières ventes » (`totalPages` 1)
   - Carte « Membres de l'équipe » du stock : 1

## Couverture par les tests

- `PilotagePharmacie.test.tsx` reprend la forme de la réponse (`totalJour` 12000, `nombre` 10, `totalPages` 1, ventes `VALIDEE` et `ANNULEE`, membres actifs et inactifs).
- `ComptoirPharmacie.test.tsx` couvre des ventes de deux vendeurs, les validées et les annulées d'un vendeur, et vérifie que le montant de l'autre vendeur n'apparaît pas.
- `ventes_tableau_de_bord.test.ts` couvre `resumerVentesDuJour` et `resumerMesVentes`.

aucune écriture : oui
