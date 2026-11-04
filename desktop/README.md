# MedConnecte Caisse (desktop)

Application Electron qui affiche le site web de MedConnecte. Aucune compilation native n'est nécessaire (`better-sqlite3` fournit son binaire).

Installation à froid, depuis ce dossier :

```
npm ci
npm run preparer
```

`npm ci` n'exécute aucun script d'installation (`.npmrc`, `ignore-scripts=true`) : `npm run preparer` télécharge le binaire d'Electron.

Ensuite : `NEXT_PUBLIC_API_URL=<adresse de l'API> npm run construire:front`, puis `npm run demarrer`.
