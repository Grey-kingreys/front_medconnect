# Installer MedConnecte Caisse

MedConnecte Caisse est le programme de caisse de votre pharmacie. Il continue de vendre même si internet s'arrête.

## Avant de commencer

Il vous faut un ordinateur avec :

- Windows 10 ou Windows 11, en 64 bits ;
- 4 Go de mémoire (RAM) et 1 Go de place libre sur le disque ;
- internet pour la première connexion.

Pour le vérifier : ouvrez **Paramètres**, puis **Système**, puis **Informations**. Lisez « Mémoire RAM installée » et « Type du système » (il doit indiquer 64 bits). Windows 7, Windows 8 et les ordinateurs 32 bits ne sont pas pris en charge.

## Installer

1. Téléchargez le fichier « MedConnecte Caisse Setup » **uniquement depuis le lien donné par MedConnecte**.
2. Double-cliquez dessus. Un assistant en français s'ouvre : suivez les écrans.
3. Lisez les **conditions d'utilisation** et cliquez sur **J'accepte**.
4. Choisissez **Installer pour moi seulement** (aucun mot de passe d'administrateur) ou **Installer pour tous les utilisateurs** de l'ordinateur (Windows demande alors l'accord d'un administrateur).
5. Choisissez le dossier d'installation, ou gardez celui proposé.
6. Les raccourcis « MedConnecte Caisse » sont créés sur le bureau et dans le menu Démarrer.
7. À la fin, laissez cochée la case **Lancer MedConnecte Caisse** pour ouvrir le programme.

Pour désinstaller : **Paramètres**, **Applications**, **Applications installées**, puis « MedConnecte Caisse ».

### Si Windows affiche « Windows a protégé votre ordinateur »

C'est normal pour le moment : le programme n'a pas encore de signature officielle, et Windows se méfie de tout programme qu'il ne connaît pas. Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**. N'utilisez ce bouton que pour un fichier reçu par le lien de MedConnecte.

## Première connexion

Connectez-vous avec votre compte MedConnecte, **avec internet**. Le poste prépare alors votre catalogue. Ensuite, vous pouvez vendre même sans internet.

## Quand internet s'arrête

- **Ça marche** : ouvrir et fermer la caisse, vendre, imprimer le ticket. Les ventes sont gardées sur l'ordinateur et envoyées dès le retour d'internet.
- **Ça ne marche pas** : se connecter pour la première fois, annuler une vente déjà envoyée, voir les ventes des autres postes, la clôture de la journée.

## Choisir l'imprimante

Dans le menu, ouvrez **Ce poste**. Choisissez votre imprimante et la taille du ticket (58 mm, 80 mm ou A4). Un bouton permet d'imprimer un ticket d'essai.

## Très important

**Ne désinstallez pas le programme, et ne formatez pas l'ordinateur, s'il reste des ventes à envoyer.** Le bandeau en haut de l'écran indique combien de ventes attendent. Attendez qu'il n'y en ait plus.

Si vous désinstallez le programme, les ventes et les réglages de ce poste **restent sur l'ordinateur**, dans le **dossier des données** : `%APPDATA%\MedConnecte Caisse` (par exemple `C:\Users\VotreNom\AppData\Roaming\MedConnecte Caisse`). Il contient la base des ventes et du stock, le fichier `appareil.json` (identité du poste), le journal `journal.log` et le fichier `cle-base.bin` (clé qui protège la base). Pour l'ouvrir : dans le programme, page **Ce poste**, ligne « Dossier des données », bouton **Ouvrir le dossier** ; ou touche Windows + R, tapez `%APPDATA%\MedConnecte Caisse`, puis Entrée. Ne le supprimez pas à la main, et pensez à le sauvegarder.

Les mises à jour peuvent demander de fermer la caisse : fermez-la, laissez partir les ventes, puis quittez le programme.

## Besoin d'aide

Appelez MedConnecte : [À COMPLÉTER : numéro de téléphone et horaires du support].

## Protection des données du poste

La base des ventes et des clients de ce poste est **chiffrée** : en cas de vol de l'ordinateur, elle ne peut pas être lue. La clé est liée à votre **compte Windows** : ne changez pas de compte pour utiliser la caisse, et ne réinstallez pas Windows sans prévenir le support. Si vous le faites, la base de ce poste devient illisible. Les ventes déjà envoyées au serveur ne sont pas perdues, mais **celles qui n'étaient pas encore envoyées le seraient** : avant tout changement de compte ou réinstallation, vérifiez que la caisse indique que tout est synchronisé.

**Procédure de reprise** : si la caisse annonce que la clé de la base est introuvable ou illisible, ne supprimez rien et appelez le support. La base est conservée telle quelle. Si le support confirme que la perte est acceptable (tout est synchronisé), il déplace `caisse.sqlite*` et `cle-base.bin` hors du dossier des données : la caisse repart alors avec une base vide et une nouvelle clé, puis récupère les données du serveur.
