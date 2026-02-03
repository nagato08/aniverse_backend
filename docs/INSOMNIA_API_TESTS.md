# Guide complet pour tester l'API Aniverse avec Insomnia

Ce guide te permet de tester **toutes** les routes de l'API Aniverse :

- **Auth** : inscription, connexion, Google OAuth, reset password
- **User** : profil utilisateur
- **Anime** : home personnalisée, moods, recherche, détails, simulcast
- **List** : favoris, watchlist, historique

---

## 1. Prérequis

### Démarrer le backend

```bash
cd aniverse
npm run start:dev
```

Le serveur tourne sur **http://localhost:3000** (ou le port défini dans ton `.env`).

### Vérifier que tout fonctionne

Ouvre **http://localhost:3000/api** dans ton navigateur pour voir la documentation Swagger.

---

## 2. Importer la collection Insomnia

1. Ouvre **Insomnia**
2. **Import** : menu **Application** → **Import/Export** → **Import Data** → **From File**
3. Choisis le fichier **`insomnia-aniverse-collection.json`** à la racine du projet
4. Une collection **"Aniverse – API complète"** apparaît avec tous les dossiers (Auth, User, Anime, List)

---

## 3. Configurer l'environnement

Dans Insomnia :

1. Clique sur **"No Environment"** (en haut à gauche) → **Manage Environments**
2. Crée ou édite un environnement **"Local"** avec ces variables :

```json
{
  "base_url": "http://localhost:3000",
  "access_token": "",
  "refresh_token": ""
}
```

3. Sélectionne cet environnement

**Astuce** : Après un **Login** ou **Register** réussi, copie `accessToken` et `refreshToken` de la réponse dans les variables d'environnement. Toutes les requêtes protégées utiliseront automatiquement ces tokens.

---

## 4. Routes Auth (`/auth`)

### Flux de test recommandé

| #   | Méthode | Route                   | Auth      | Description                         |
| --- | ------- | ----------------------- | --------- | ----------------------------------- |
| 1   | POST    | `/auth/register`        | ❌        | Créer un compte                     |
| 2   | POST    | `/auth/login`           | ❌        | Se connecter → récupérer les tokens |
| 3   | GET     | `/auth/me`              | ✅ Bearer | Voir son profil                     |
| 4   | POST    | `/auth/refresh`         | ❌        | Renouveler l'access token           |
| 5   | POST    | `/auth/logout`          | ✅ Bearer | Se déconnecter                      |
| 6   | POST    | `/auth/forgot-password` | ❌        | Demander un reset                   |
| 7   | POST    | `/auth/reset-password`  | ❌        | Réinitialiser le mot de passe       |

### Exemples de body JSON

#### POST /auth/register

```json
{
  "email": "test@example.com",
  "password": "MotDePasse123!",
  "username": "TestUser",
  "firstName": "Jean",
  "lastName": "Dupont",
  "favoriteGenres": ["ACTION", "FANTASY"],
  "preferredMood": "HYPE",
  "favoriteAnimeIds": [15125, 20583]
}
```

> Seuls `email` et `password` sont obligatoires.

#### POST /auth/login

```json
{
  "email": "test@example.com",
  "password": "MotDePasse123!"
}
```

#### POST /auth/refresh

```json
{
  "refreshToken": "COLLE_LE_REFRESH_TOKEN_ICI"
}
```

#### POST /auth/forgot-password

```json
{
  "email": "test@example.com"
}
```

#### POST /auth/reset-password

```json
{
  "token": "LE_TOKEN_RECU_PAR_EMAIL",
  "newPassword": "NouveauMotDePasse123!"
}
```

### Routes Google OAuth

| Méthode | Route                   | Description                           |
| ------- | ----------------------- | ------------------------------------- |
| POST    | `/auth/google/login`    | Connexion avec compte Google existant |
| POST    | `/auth/google/register` | Inscription avec compte Google        |

#### POST /auth/google/login

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

#### POST /auth/google/register

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "username": "Nagato",
  "favoriteGenres": ["ACTION", "COMEDY"],
  "preferredMood": "CHILL",
  "favoriteAnimeIds": [15125]
}
```

---

## 5. Routes User (`/user`)

Toutes les routes User nécessitent un **Bearer token**.

| Méthode | Route           | Description                  |
| ------- | --------------- | ---------------------------- |
| GET     | `/user/profile` | Récupérer son profil complet |
| PATCH   | `/user/profile` | Mettre à jour son profil     |

### PATCH /user/profile

```json
{
  "username": "NouveauPseudo",
  "firstName": "Jean",
  "lastName": "Dupont",
  "bio": "Fan d'anime depuis 2010",
  "avatarUrl": "https://example.com/avatar.jpg",
  "favoriteGenres": ["ACTION", "ROMANCE"],
  "preferredMood": "CHILL"
}
```

> Tous les champs sont optionnels. Envoie uniquement ceux que tu veux modifier.

---

## 6. Routes Anime (`/anime`)

| Méthode | Route              | Auth      | Description                     |
| ------- | ------------------ | --------- | ------------------------------- |
| GET     | `/anime/home`      | ✅ Bearer | Page d'accueil personnalisée    |
| GET     | `/anime/moods`     | ❌        | Catégories de "mood" avec anime |
| GET     | `/anime/search`    | ❌        | Recherche avec filtres          |
| GET     | `/anime/simulcast` | ❌        | Calendrier des sorties          |
| GET     | `/anime/:id`       | ❌        | Détails d'un anime              |

### GET /anime/home (protégé)

Retourne la page d'accueil personnalisée :

```json
{
  "forYou": [...],        // Basé sur tes genres favoris
  "trending": [...],      // Anime populaires
  "continueWatching": [...], // Ta watchlist/historique
  "dailySimulcast": [...]  // Sorties du jour
}
```

### GET /anime/moods

Query params optionnels :

- `perMood` : nombre d'anime par mood (défaut: 10)

```
GET /anime/moods?perMood=5
```

### GET /anime/search

Query params :

- `title` : recherche par titre
- `genre` : filtrer par genre (ACTION, COMEDY, etc.)
- `year` : filtrer par année
- `page` : page (défaut: 1)
- `perPage` : résultats par page (défaut: 20)

```
GET /anime/search?title=Naruto&genre=ACTION&page=1
```

### GET /anime/simulcast

Query params :

- `page` : page (défaut: 1)
- `perPage` : résultats par page (défaut: 50)

### GET /anime/:id

Remplace `:id` par l'ID AniList de l'anime.

```
GET /anime/15125
```

---

## 7. Routes List (`/list`)

Toutes les routes List nécessitent un **Bearer token**.

### Favoris

| Méthode | Route                      | Description                  |
| ------- | -------------------------- | ---------------------------- |
| GET     | `/list/favorites`          | Lister mes favoris           |
| POST    | `/list/favorites`          | Ajouter un anime aux favoris |
| DELETE  | `/list/favorites/:animeId` | Retirer un anime des favoris |

#### POST /list/favorites

```json
{
  "animeId": 15125
}
```

### Watchlist

| Méthode | Route                             | Description                 |
| ------- | --------------------------------- | --------------------------- |
| GET     | `/list/watchlist`                 | Lister ma watchlist         |
| GET     | `/list/watchlist?status=WATCHING` | Filtrer par statut          |
| POST    | `/list/watchlist`                 | Ajouter/mettre à jour       |
| PATCH   | `/list/watchlist/:animeId`        | Modifier statut/progression |
| DELETE  | `/list/watchlist/:animeId`        | Retirer de la watchlist     |

**Statuts possibles** : `PLANNING`, `WATCHING`, `COMPLETED`, `DROPPED`

#### POST /list/watchlist

```json
{
  "animeId": 15125,
  "status": "WATCHING",
  "progress": 5
}
```

> `status` et `progress` sont optionnels. Par défaut : `PLANNING`, `0`.

#### PATCH /list/watchlist/:animeId

```json
{
  "status": "COMPLETED",
  "progress": 24
}
```

### Historique

| Méthode | Route                    | Description                     |
| ------- | ------------------------ | ------------------------------- |
| GET     | `/list/history`          | Lister mon historique           |
| POST    | `/list/history`          | Enregistrer un épisode vu       |
| DELETE  | `/list/history/:animeId` | Effacer l'historique d'un anime |
| DELETE  | `/list/history`          | Vider tout l'historique         |

#### POST /list/history

```json
{
  "animeId": 15125,
  "episode": 12
}
```

---

## 8. Codes de réponse

| Code | Signification                             |
| ---- | ----------------------------------------- |
| 200  | Succès                                    |
| 201  | Créé avec succès                          |
| 400  | Données invalides (validation DTO)        |
| 401  | Non authentifié (token manquant/invalide) |
| 404  | Ressource non trouvée                     |
| 409  | Conflit (ex: anime déjà en favoris)       |

---

## 9. Workflow complet de test

### Étape 1 : Créer un compte

1. `POST /auth/register` avec email + password + préférences
2. Copie `accessToken` et `refreshToken` dans l'environnement Insomnia

### Étape 2 : Tester le profil

1. `GET /auth/me` → vérifie que tu es connecté
2. `GET /user/profile` → récupère ton profil complet
3. `PATCH /user/profile` → modifie quelques champs

### Étape 3 : Explorer le catalogue

1. `GET /anime/home` → page d'accueil personnalisée
2. `GET /anime/moods` → catégories par mood
3. `GET /anime/search?title=One%20Piece` → recherche
4. `GET /anime/15125` → détails d'un anime

### Étape 4 : Gérer ses listes

1. `POST /list/favorites` avec `{ "animeId": 15125 }` → ajouter aux favoris
2. `POST /list/watchlist` avec `{ "animeId": 15125, "status": "WATCHING" }` → ajouter à la watchlist
3. `POST /list/history` avec `{ "animeId": 15125, "episode": 3 }` → marquer épisode vu
4. `GET /list/favorites` → vérifier les favoris
5. `GET /list/watchlist?status=WATCHING` → voir ce qu'on regarde
6. `GET /list/history` → voir l'historique

### Étape 5 : Tester le refresh token

1. `POST /auth/refresh` avec le `refreshToken`
2. Récupère les nouveaux tokens
3. Met à jour `access_token` dans l'environnement

### Étape 6 : Se déconnecter

1. `POST /auth/logout` → invalide le refresh token

---

## 10. IDs AniList utiles pour les tests

| Anime                            | ID AniList |
| -------------------------------- | ---------- |
| Naruto                           | 20         |
| Naruto Shippuden                 | 1735       |
| One Piece                        | 21         |
| Attack on Titan                  | 16498      |
| Death Note                       | 1535       |
| Fullmetal Alchemist: Brotherhood | 5114       |
| Demon Slayer                     | 101922     |
| My Hero Academia                 | 21459      |
| Jujutsu Kaisen                   | 113415     |
| Spy x Family                     | 140960     |

---

## 11. Genres et Moods disponibles

### Genres (pour `favoriteGenres`)

```
ACTION, ADVENTURE, COMEDY, DRAMA, FANTASY,
HORROR, MYSTERY, ROMANCE, SCI_FI, SLICE_OF_LIFE
```

### Moods (pour `preferredMood`)

```
CHILL, DARK, HYPE, EMOTIONAL
```

---

## 12. Swagger UI

Pour une documentation interactive, ouvre :

```
http://localhost:3000/api
```

Tu peux tester les routes directement depuis le navigateur avec Swagger.
