# F14 - Essai réel contre le back local (2026-10-22)

Back : http://localhost:3101, démo active, compte `admin.kaloum@demo.medconnecte.gn` (Pharmacie de Kaloum).

## Connexion

- `curl -s http://localhost:3101/auth/demo/comptes` : HTTP 200, `id` de l'administrateur relevé.
- `curl -s -X POST http://localhost:3101/auth/demo/connexion -H 'Content-Type: application/json' -d '{"userId":"<id>"}'` : HTTP 200, jeton = `data.access_token` (masqué ci-dessous en `<jeton>`).

Chaque lecture : `curl -s http://localhost:3101/structures/my -H "Authorization: Bearer <jeton>"`.
Chaque écriture : `curl -s -X PATCH http://localhost:3101/structures/my -H "Authorization: Bearer <jeton>" -H 'Content-Type: application/json' -d '<corps>'`.

Horaires d'origine (constants à chaque lecture) :
`{"Lundi":"08:00-21:00","Mardi":"08:00-21:00","Mercredi":"08:00-21:00","Jeudi":"08:00-21:00","Vendredi":"08:00-21:00","Samedi":"08:00-21:00","Dimanche":"09:00-13:00"}`

## Étape 1 : état d'origine

- `GET /structures/my` : HTTP 200
- `telephone` = `+224 621 33 44 55`, `estDeGarde` = `true`, `estOuvertManuel` = `null`, `adresse` = `Avenue de la République, Kaloum`, horaires ci-dessus.

## Étape 2 : envoi partiel du téléphone (preuve de D02)

- `PATCH` `{"telephone":"+224 621 00 00 00"}` : HTTP 200
- `GET /structures/my` : HTTP 200
- `telephone` = `+224 621 00 00 00` ; `horaires`, `estDeGarde` (`true`) et `adresse` inchangés.

## Étape 3 : ouverture forcée puis retour à l'automatique (preuve de D03)

- `PATCH` `{"estOuvertManuel":false}` : HTTP 200 ; `GET` : HTTP 200, `estOuvertManuel` = `false`.
- `PATCH` `{"estOuvertManuel":null}` : HTTP 200 ; `GET` : HTTP 200, `estOuvertManuel` = `null`.

Le retour à `null` est accepté et écrit : l'option « Selon les horaires » est livrable.

## Étape 4 : restauration

- `PATCH` `{"telephone":"+224 621 33 44 55"}` : HTTP 200
- `PATCH` `{"estOuvertManuel":null}` : HTTP 200
- `GET /structures/my` : HTTP 200, `telephone` = `+224 621 33 44 55`, `estDeGarde` = `true`, `estOuvertManuel` = `null`, `adresse` et horaires identiques à l'étape 1.

valeurs d'origine restaurées : oui
