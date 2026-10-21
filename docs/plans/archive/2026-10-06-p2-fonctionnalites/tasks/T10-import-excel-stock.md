# T10 - Import Excel du stock dans l'écran Stock (F1, côté front)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (pharmacien, administrateur de pharmacie)
Visuel: préventif
Background-safe: oui

## Spec

Contrat serveur (fait en parallèle, figé), mêmes droits que la gestion du stock, `structureId` = celui déjà utilisé par `src/app/dashboard/stock/page.tsx` :
- `GET /pharmacie/stock/:structureId/import/modele` : fichier `.xlsx` (« modele-import-stock.xlsx »).
- `POST /pharmacie/stock/:structureId/import/apercu` (multipart, champ `fichier`) : analyse sans rien enregistrer.
- `POST /pharmacie/stock/:structureId/import` (multipart, champ `fichier`) : refait l'analyse et enregistre les lignes acceptées.
- Réponse des deux POST : `{ success, message, data: { totalLignes, acceptees, rejetees, importees? , lignes: [{ ligne, nom, statut: 'acceptee' | 'rejetee', raison?, medicamentId?, medicamentNom?, quantite?, prixUnitaire?, dateExpiration?, notes? }] } }` ; erreurs de fichier (absent, trop lourd > 2 Mo, pas un .xlsx, colonnes manquantes, plus de 1000 lignes) renvoyées en 400 avec `message` humain.
- La quantité importée remplace la quantité en stock (D07). Décisions D07, D08 (back) dans `docs/plans/runs/2026-10-06-p2-fonctionnalites/decisions.md`.
Prérequis déjà livrés dans cette branche par la tâche T09 : `authFetch` accepte un corps `FormData` sans forcer le JSON ; `authDownload(endpoint)` renvoie `{ blob, filename }` ; notifications `useToast().notifier(message, type)`.

1. `src/lib/api_pharmacie.ts` : `telechargerModeleImportStock(structureId)`, `apercuImportStock(structureId, fichier: File)`, `importerStock(structureId, fichier: File)` + types du rapport (seul endroit de vérité côté front).
2. `src/app/dashboard/stock/page.tsx` : bouton « Importer depuis Excel » à côté de l'action d'ajout existante, qui ouvre une modale (réutiliser la structure et le style des modales existantes de `src/components/modals/`, par exemple `StockModal.tsx` ; nouveau fichier `src/components/modals/ImportStockModal.tsx`). Parcours en 3 étapes, divulgation progressive :
   - Étape 1 « Préparer le fichier » : lien « Télécharger le modèle Excel » (téléchargement via `authDownload` puis lien objet temporaire révoqué après usage), 3 consignes courtes (une ligne par médicament, le nom tel qu'il apparaît dans le catalogue, la quantité remplace celle en stock), zone de choix du fichier (`accept=".xlsx"`), contrôle côté écran de l'extension et de la taille (2 Mo) avec message humain avant tout envoi.
   - Étape 2 « Vérifier » : après `apercuImportStock`, résumé « 12 médicaments prêts à être importés, 2 lignes à corriger » puis tableau des lignes (numéro de ligne Excel, nom saisi, médicament reconnu, quantité, prix, date d'expiration) avec les lignes rejetées mises en évidence et leur raison ; filtre « Afficher seulement les lignes à corriger ». Si aucune ligne acceptée : message qui guide (« Aucune ligne ne peut être importée. Corrigez le fichier puis choisissez-le à nouveau. ») et bouton pour revenir à l'étape 1. Bouton « Importer N médicaments » (confirmation explicite, rappel que les quantités seront remplacées) et « Choisir un autre fichier ».
   - Étape 3 « Terminé » : « N médicaments mis à jour dans votre stock » ; fermer recharge la liste du stock (réutiliser la fonction de rechargement existante de la page).
   - Erreurs : chaque appel a un message humain (utiliser `err.message` des `ApiError`, déjà humain) et une action (réessayer, choisir un autre fichier). Bouton désactivé et indicateur de chargement pendant les envois.
3. Accessibilité : modale avec `role="dialog"`, `aria-modal`, titre relié, focus placé dans la modale à l'ouverture et rendu au bouton à la fermeture, Échap ferme.
4. Visuel : tokens et classes existants des modales et tableaux de la page ; une seule délimitation par surface ; lignes rejetées signalées par une couleur de texte ou une bordure gauche `emergency-*` au contraste AA, pas un fond pâle + bordure + icône cumulés ; clair et sombre.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne pas modifier `src/lib/api_auth.ts`. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14 ; vocabulaire : « stock de médicaments », « fichier Excel », pas « upload »). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des fichiers touchés : aucune erreur nouvelle (lister à part les préexistantes).
- Termes interdits : 0 occurrence dans les chaînes visibles ajoutées (grep montré).
- Les 3 appels du contrat sont utilisés avec les bons chemins et le champ `fichier` (lignes citées) ; état « aucune ligne acceptée » et erreurs présents (lignes citées).

## Return

Fichiers modifiés et créés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

- 2026-10-07 : exécutée directement par l'orchestrateur de reprise (D16), contre le contrat back mergé (eb53eb9). Confirmation explicite en ligne dans la modale (pas de seconde modale). Le nom du modèle retombe sur « modele-import-stock.xlsx » car le serveur n'expose pas `Content-Disposition` en CORS.

## Validation

- `npx --no-install tsc --noEmit` : 0 erreur ; eslint des 3 fichiers : 0 erreur, 4 avertissements préexistants.
- Appels : `authDownload(\`/pharmacie/stock/${structureId}/import/modele\`)`, `.../import/apercu` et `.../import` en POST avec `formulaire.append("fichier", fichier)`.
- Aucune ligne acceptée : « Aucune ligne ne peut être importée. Corrigez le fichier puis choisissez-le à nouveau. » + « Choisir un autre fichier » ; erreurs : `role="alert"` avec `messageErreurPour(err, ...)` sur les 3 appels, boutons désactivés et indicateur pendant les envois.
- Contrôles avant envoi : extension `.xlsx` et 2 Mo, messages humains.
- Accessibilité : `role="dialog"`, `aria-modal`, `aria-labelledby`, focus à l'ouverture et rendu à la fermeture, Échap ferme (sauf envoi en cours).
- Termes interdits et tirets : 0 occurrence dans les chaînes visibles ajoutées.
