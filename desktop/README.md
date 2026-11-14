# MedConnecte Caisse (desktop)

Application Electron qui affiche le site web de MedConnecte. Aucune compilation native n'est nécessaire (`better-sqlite3` fournit son binaire).

Installation à froid, depuis ce dossier :

```
npm ci
npm run preparer
```

`npm ci` n'exécute aucun script d'installation (`.npmrc`, `ignore-scripts=true`) : `npm run preparer` télécharge le binaire d'Electron.

## Développement

`NEXT_PUBLIC_API_URL=<adresse de l'API> npm run construire:front`, puis `NEXT_PUBLIC_API_URL=<adresse de l'API> npm run demarrer`. La même variable est figée dans le processus principal par `npm run construire` (synchronisation), jamais lue d'un fichier. `npm run demarrer` construit un fichier lisible (pas de bytecode).

La base du poste est `caisse.sqlite` dans le dossier de données de l'application (`%APPDATA%/MedConnecte Caisse`), à côté de `appareil.json` (identifiant du poste). Une base illisible n'est jamais supprimée : elle est renommée en `caisse-illisible-<date>.sqlite` si le vendeur choisit de repartir d'une base vide.

## Produire l'installateur (`.exe`)

```
NEXT_PUBLIC_API_URL=<adresse de l'API> npm run dist
```

Le fichier sort dans `desktop/sortie/MedConnecte Caisse Setup <version>.exe` (assistant d'installation en français : accueil, conditions d'utilisation `build/conditions-utilisation.txt`, installation pour moi seulement ou pour tous les utilisateurs avec élévation, choix du dossier, raccourcis, case « Lancer MedConnecte Caisse » ; non signé). Les données du poste sont conservées à la désinstallation (`deleteAppDataOnUninstall: false`). `npm run dist` enchaîne : construction du front, du processus principal (bytecode), empaquetage, puis `scripts/controler-sortie.mjs` (code 1 au moindre problème).

- **`NEXT_PUBLIC_API_URL`** : adresse de l'API que la caisse appellera, figée à la construction (`https://` en production, `http://127.0.0.1:<port>` ou `http://localhost:<port>` seulement pour le développement). Elle est affichée, adresse seule, dans la page « Ce poste » du programme installé. Pour l'API locale de développement : `http://127.0.0.1:3101`. Elle doit être autorisée côté API par `DESKTOP_ORIGINS`.
- **`MC_MAJ_URL`** (facultative) : dossier de mises à jour (`https://`, ou `http://127.0.0.1` pour une preuve sur ce poste). Absente : aucune vérification, aucune erreur à l'écran, la page « Ce poste » annonce des mises à jour manuelles. Présente : l'empaquetage produit aussi `latest.yml`, à déposer avec le nouvel installateur.
- **`MC_VERSION_PAQUET`** (facultative, `1.2.3`) : remplace la version du paquet sans toucher à `package.json` (preuve de mise à jour).
- Options de `npm run empaqueter -- <options>` transmises à electron-builder (`--dir` : dossier seul, `-c.directories.output=<dossier>`).

Une mise à jour ne s'installe qu'à la fermeture du programme ou sur demande, jamais avec une caisse ouverte ni des ventes pas encore envoyées.

La notice pour l'officine est `NOTICE-INSTALLATION.md`.

## Support : fichiers du poste

- **Ne jamais copier `caisse.sqlite` seul.** La base est en mode WAL : ses ventes récentes peuvent être dans `caisse.sqlite-wal`, et un `-wal` d'une autre base rejoué sur ce fichier le corrompt. Déplacer les trois fichiers ensemble (`caisse.sqlite`, `-wal`, `-shm`, programme fermé), ou faire une copie cohérente avec `db.backup()` de better-sqlite3.
- Si `appareil.json` et la base ne donnent pas le même identifiant, la caisse refuse de démarrer (« Les données de ce poste ne correspondent pas à son identifiant ») et ne modifie rien. Cause probable : base remplacée à la main.
- `journal.log` (dossier de données) garde les événements de démarrage, sans jeton ni vente.
- **Mises à jour non signées** : seule l'empreinte `sha512` lue dans `latest.yml` protège le téléchargement. L'hébergement des mises à jour doit donc être sûr (`https`, accès en écriture réservé).

## Protection du code (D759) : ce qui est fait, ce qui reste lisible

Aucune protection n'est totale pour un programme installé chez l'utilisateur.

- Aucun secret, aucun fichier `.env*`, aucune carte de source (`.map`), aucun chemin du poste de build : contrôlé par `scripts/controler-sortie.mjs`. Les fichiers `.env*` ne sont jamais une entrée de la construction du front (leurs variables sont neutralisées).
- Processus principal et cœur compilés en bytecode V8 (`bytenode`, compilé avec Electron lui-même) : le code n'est plus un texte JavaScript, mais les chaînes de caractères (messages, requêtes SQL, adresses) et les noms de fonctions restent visibles dans le fichier.
- Fusibles d'Electron : `RunAsNode`, `NODE_OPTIONS` et `--inspect` coupés, intégrité de l'asar, chargement depuis l'asar seulement, cookies chiffrés.
- **Reste lisible** : le serveur Next (`resources/dist-front/serveur`, JavaScript minifié du site) et le préchargement. Le placer dans une archive est refusé par Electron tant que l'intégrité de l'asar est activée. Le dossier est modifiable par l'utilisateur Windows (limite connue, D747).
