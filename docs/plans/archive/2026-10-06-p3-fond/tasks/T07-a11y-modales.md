# T07 - Accessibilité des modales par un hook unique

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev
Visuel: préventif (aucun changement visuel attendu, sauf un anneau de focus visible s'il manque)
Background-safe: oui

Worktree de travail : `D:/souleymane/perso-archive-20260923/perso/medconnecte/.worktrees/front-p3-T07` (branche `task/T07-a11y-modales`, node_modules installés). Ne travaille que là. Ne commite pas : l'orchestrateur commite.

## Spec

Point 23 du backlog : les modales de `src/components/modals/` (10 fichiers) n'ont ni rôle, ni gestion du focus, ni fermeture au clavier. Décision D03 : un hook unique.

1. Chercher d'abord l'existant (grep `Escape`, `focus`, `role="dialog"`, notamment `src/components/InstallAppButton.tsx`) ; s'il existe déjà une logique réutilisable, l'extraire n'est pas demandé : écrire le hook et le signaler.
2. Créer `src/hooks/useDialogA11y.ts` (client) : `useDialogA11y({ isOpen, onClose, closeOnEscape = true })` retourne `{ dialogProps, titleId }` où `dialogProps` = `{ ref, role: "dialog", "aria-modal": true, "aria-labelledby": titleId, tabIndex: -1 }` (titleId via `useId`). Comportement : à l'ouverture, mémoriser l'élément actif puis placer le focus sur le premier élément focalisable du dialogue (sinon le dialogue lui-même) ; Tab et Maj+Tab restent piégés dans le dialogue ; Échap appelle `onClose` (désactivable quand une action est en cours, par exemple suppression en cours) ; à la fermeture ou au démontage, rendre le focus à l'élément mémorisé. Pas de dépendance ajoutée. Commentaires en français.
3. Appliquer le hook aux 10 modales de `src/components/modals/` avec un diff minimal : appel du hook **avant** tout `return null` conditionnel (règles des hooks), `{...dialogProps}` sur le panneau du dialogue (pas sur le fond), `id={titleId}` sur le titre visible ; si une modale n'a pas de titre visible, `aria-label` en français. Le fond cliquable reste tel quel ; lui ajouter `aria-hidden="true"`. Les boutons de fermeture faits d'une icône seule reçoivent `aria-label="Fermer"`. Ne rien changer d'autre (ni styles, ni textes, ni logique). Si une modale ne reçoit pas `isOpen` (rendue conditionnellement par le parent), passer `isOpen: true`.
4. **Ne pas toucher** `src/components/DoctorAddRecordModal.tsx` (niveau P2) ni aucun fichier hors `src/components/modals/` et `src/hooks/useDialogA11y.ts`.
5. Si Vitest n'est pas présent dans ce worktree (il est ajouté en parallèle par T05 sur une autre branche), ne pas l'installer : pas de test automatisé dans cette tâche.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Aucun tiret cadratin ni demi-cadratin. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Next.js 16 : lire `node_modules/next/dist/docs/` si une API Next est concernée (a priori aucune : React pur).

## Done when

Dans le worktree :
- `grep -L "useDialogA11y" src/components/modals/*.tsx` : vide (les 10 modales l'utilisent).
- `grep -c 'role="dialog"\|dialogProps' ...` cohérent : chaque modale étale `dialogProps` une fois par panneau.
- `npx --no-install tsc --noEmit` : aucune erreur.
- `npx --no-install eslint src/hooks/useDialogA11y.ts src/components/modals/*.tsx` : aucune erreur **nouvelle** (lister les erreurs préexistantes du fichier d'origine, mesurées par `git stash` ou sur `orch/p3-fond`, si elles subsistent ; le pre-commit lint les fichiers entiers, donc les corriger si ce sont des erreurs simples du fichier touché, sans changer le comportement, et le signaler).
- Aucun terme interdit ajouté dans les chaînes visibles (section 14 de docs/ORCHESTRATOR.md).
- `git status --porcelain` : seulement le hook et les modales.

## Return

Chemins + preuves (commande lancée, résultat en une ligne) + liste des erreurs lint préexistantes corrigées. Ou un bloc BLOCKED. Pas de prose.

## Historique

2026-10-06 | spécifié | partiel | 4 erreurs de lint préexistantes bloquaient le pre-commit (set-state-in-effect x2, immutability, no-explicit-any) : neutralisées par l'orchestrateur avec eslint-disable-next-line justifié (D06)

## Validation

eslint hook + 10 modales | 0 erreur, 17 avertissements préexistants | de4b337
tsc --noEmit | OK | de4b337
grep -L useDialogA11y modals/*.tsx | vide ; un {...dialogProps} par modale | de4b337
Parcours navigateur et captures : non faits (pas de serveur de dev lancé dans ce run), à faire à la recette
