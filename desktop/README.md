# MedConnecte Caisse (desktop)

Application Electron qui affiche le site web de MedConnecte. Aucune compilation native n'est nécessaire (`better-sqlite3` fournit son binaire).

Installation à froid, depuis ce dossier :

```
npm ci
npm run preparer
```

`npm ci` n'exécute aucun script d'installation (`.npmrc`, `ignore-scripts=true`) : `npm run preparer` télécharge le binaire d'Electron.

Ensuite : `NEXT_PUBLIC_API_URL=<adresse de l'API> npm run construire:front`, puis `NEXT_PUBLIC_API_URL=<adresse de l'API> npm run demarrer`. La même variable est figée dans le processus principal par `npm run construire` (synchronisation), jamais lue d'un fichier.

La base du poste est `caisse.sqlite` dans le dossier de données de l'application (`%APPDATA%/MedConnecte Caisse`), à côté de `appareil.json` (identifiant du poste). Une base illisible n'est jamais supprimée : elle est renommée en `caisse-illisible-<date>.sqlite` si le vendeur choisit de repartir d'une base vide.
