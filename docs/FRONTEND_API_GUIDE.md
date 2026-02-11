# Guide API pour le Développeur Frontend – Aniverse

Ce document décrit **tous les endpoints** de l'API Aniverse, leur rôle, et **à quel moment** les utiliser dans l'application mobile.

---

## Table des matières

1. [Configuration](#1-configuration)
2. [Authentification](#2-authentification)
3. [Inscription multi-étapes](#3-inscription-multi-étapes)
4. [Gestion du profil](#4-gestion-du-profil)
5. [Catalogue Anime (BFF)](#5-catalogue-anime-bff)
6. [Listes personnelles](#6-listes-personnelles)
7. [Gestion des tokens](#7-gestion-des-tokens)
8. [Codes d'erreur](#8-codes-derreur)
9. [Types et Enums](#9-types-et-enums)

---

## 1. Configuration

### Base URL

```
Production : https://api.aniverse.app (à définir)
Développement : http://localhost:3000
```

### Headers par défaut

```http
Content-Type: application/json
```

### Headers pour routes protégées

```http
Authorization: Bearer <accessToken>
```

---

## 2. Authentification

### Vue d'ensemble

| Écran/Action              | Endpoint                  | Méthode | Auth |
| ------------------------- | ------------------------- | ------- | ---- |
| Page de connexion (email) | `/auth/send-login-code`   | POST    | ❌   |
| Saisie du code reçu       | `/auth/verify-login-code` | POST    | ❌   |
| Se connecter avec Google  | `/auth/google/login`      | POST    | ❌   |
| Inscription : pré-remplir | `/auth/google/profile`    | POST    | ❌   |
| Fin inscription Google    | `/auth/google/register`   | POST    | ❌   |
| Fin inscription email     | `/auth/register`          | POST    | ❌   |
| Splash screen             | `/auth/me`                | GET     | ✅   |
| Mot de passe oublié       | `/auth/forgot-password`   | POST    | ❌   |
| Reset password            | `/auth/reset-password`    | POST    | ❌   |
| Déconnexion               | `/auth/logout`            | POST    | ✅   |
| Refresh token             | `/auth/refresh`           | POST    | ❌   |

**Connexion :** uniquement **Google** (`/auth/google/login`) ou **email sans mot de passe** (envoi d’un code par email → `/auth/send-login-code` puis `/auth/verify-login-code`). Pas de connexion par email + mot de passe.

---

### POST /auth/send-login-code

**Quand l'utiliser :** Page de connexion, quand l’utilisateur a saisi son **email** et appuie sur « Envoyer le code ». Un code à 6 chiffres est envoyé par email (valide 10 minutes).

**Body :**

```json
{
  "email": "user@example.com"
}
```

**Réponse (200) :** Toujours la même (ne pas révéler si le compte existe) :

```json
{
  "message": "Si un compte existe avec cet email, un code de connexion a été envoyé. Valide 10 minutes."
}
```

L’utilisateur consulte sa boîte mail, récupère le code, puis l’app entre dans l’écran « Saisir le code » et appelle `POST /auth/verify-login-code`.

---

### POST /auth/verify-login-code

**Quand l'utiliser :** Quand l’utilisateur a saisi le **code à 6 chiffres** reçu par email.

**Body :**

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Réponse (200) :** Même format que les autres connexions (tokens + user) :

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clxyz123",
    "email": "user@example.com",
    "username": "Nagato",
    "firstName": "Jean",
    "lastName": "Dupont",
    "avatarUrl": "https://...",
    "favoriteGenres": ["ACTION", "FANTASY"],
    "preferredMood": "HYPE"
  }
}
```

**Stockage recommandé :**

- `accessToken` → mémoire ou SecureStorage (expire en 15min)
- `refreshToken` → SecureStorage (expire en 90 jours)
- `user` → état global (Redux, Riverpod, etc.)

---

### POST /auth/google/login

**Quand l'utiliser :** Bouton **« Se connecter avec Google »** sur la page de **connexion**.

**Prérequis :** Obtenir un `idToken` via Google Sign-In SDK (Firebase Auth ou `google_sign_in`), avec `serverClientId` configuré (Client ID Web OAuth2).

**Body :**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Réponse (200) :** Même format que `/auth/login` (tokens + user).

**Erreur (401) :** Aucun compte associé à ce Google. Le body contient :

```json
{
  "statusCode": 401,
  "message": "Aucun compte trouvé avec ce compte Google. Inscrivez-vous d'abord.",
  "code": "GOOGLE_NO_ACCOUNT"
}
```

→ **Ne pas afficher une simple erreur** : rediriger vers le **parcours d'inscription** en gardant l’`idToken` en state, puis pré-remplir avec `POST /auth/google/profile` et enchaîner les étapes (username/phone/bio → genres/moods → avatar) avant d’appeler `POST /auth/google/register` à la fin.

---

### POST /auth/login (legacy)

Connexion **email + mot de passe**. Conservé pour compatibilité ; la connexion recommandée est **Google** ou **email sans mot de passe** (code). Body : `{ "email", "password" }`. Réponse : tokens + user.

---

### POST /auth/google/profile

**Quand l'utiliser :** À l’**étape 1 de l’inscription** quand l’utilisateur clique sur « Continuer avec Google ». Permet de pré-remplir **prénom, nom, email** (et optionnellement l’avatar Google) **sans créer de compte**. Tu gardes l’`idToken` pour l’appel final à `POST /auth/google/register`.

**Body :**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Réponse (200) :**

```json
{
  "email": "user@gmail.com",
  "firstName": "Jean",
  "lastName": "Dupont",
  "avatarUrl": "https://lh3.googleusercontent.com/..."
}
```

Aucun compte n’est créé. Utilise ces champs pour pré-remplir le formulaire, puis enchaîne avec les étapes 2 (username, phone, bio), 3 (genres, moods), 4 (choix avatar), et enfin `POST /auth/google/register`.

---

### POST /auth/google/register

**Quand l'utiliser :** **Fin du parcours d’inscription avec Google** : après les étapes pré-remplissage (email, prénom, nom), username/phone/bio, genres/moods, choix d’avatar. Un seul appel crée le compte et renvoie les tokens.

**Body :**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "username": "Nagato",
  "phone": "+33612345678",
  "bio": "Fan d'anime depuis 2010",
  "favoriteGenres": ["ACTION", "COMEDY"],
  "preferredMood": "CHILL",
  "avatarUrl": "https://res.cloudinary.com/.../avatar.jpg",
  "favoriteAnimeIds": [15125, 20583]
}
```

| Champ              | Requis | Description                                      |
| ------------------ | ------ | ------------------------------------------------ |
| `idToken`          | ✅     | Token Google (gardé depuis l’étape 1)            |
| `username`         | ❌     | Pseudo (étape 2)                                 |
| `phone`            | ❌     | Téléphone (étape 2)                              |
| `bio`              | ❌     | Bio (étape 2)                                    |
| `favoriteGenres`   | ❌     | Genres (étape 3)                                 |
| `preferredMood`    | ❌     | Mood (étape 3)                                   |
| `avatarUrl`        | ❌     | URL de l’avatar choisi (étape 4) ou photo Google |
| `favoriteAnimeIds` | ❌     | IDs AniList favoris                              |

**Réponse (200) :** Même format que `/auth/login` (tokens + user).

---

### POST /auth/register

**Quand l'utiliser :** Dernière étape de l'inscription classique (email/password).

**Body :**

```json
{
  "email": "user@example.com",
  "password": "MotDePasse123!",
  "username": "Nagato",
  "firstName": "Jean",
  "lastName": "Dupont",
  "avatarUrl": "https://res.cloudinary.com/.../avatar.jpg",
  "favoriteGenres": ["ACTION", "FANTASY"],
  "preferredMood": "HYPE",
  "favoriteAnimeIds": [15125, 20583]
}
```

| Champ              | Requis | Description                         |
| ------------------ | ------ | ----------------------------------- |
| `email`            | ✅     | Email unique                        |
| `password`         | ✅     | Min 8 caractères                    |
| `username`         | ❌     | Pseudo unique (vérifié à l'étape 2) |
| `firstName`        | ❌     | Prénom                              |
| `lastName`         | ❌     | Nom                                 |
| `avatarUrl`        | ❌     | URL de l'avatar choisi              |
| `favoriteGenres`   | ❌     | Tableau de genres (étape 3)         |
| `preferredMood`    | ❌     | Mood principal (étape 3)            |
| `favoriteAnimeIds` | ❌     | IDs AniList des animes favoris      |

**Réponse (201) :** Même format que `/auth/login`.

---

### GET /auth/me

**Quand l'utiliser :**

- Au lancement de l'app (splash screen) pour vérifier si l'utilisateur est connecté
- Pour récupérer les infos utilisateur après un refresh token

**Headers :** `Authorization: Bearer <accessToken>`

**Réponse (200) :**

```json
{
  "id": "clxyz123",
  "email": "user@example.com",
  "username": "Nagato",
  ...
}
```

**Erreur (401) :** Token invalide/expiré → tenter un refresh ou rediriger vers login.

---

### POST /auth/forgot-password

**Quand l'utiliser :** Écran "Mot de passe oublié".

**Body :**

```json
{
  "email": "user@example.com"
}
```

**Réponse (200) :**

```json
{
  "message": "Si cet email existe, un lien de réinitialisation a été envoyé."
}
```

> Note : Le message est volontairement vague pour des raisons de sécurité.

---

### POST /auth/reset-password

**Quand l'utiliser :** Quand l'utilisateur clique sur le lien reçu par email et arrive sur l'écran de nouveau mot de passe.

**Body :**

```json
{
  "token": "abc123def456...",
  "newPassword": "NouveauMotDePasse123!"
}
```

**Réponse (200) :**

```json
{
  "message": "Mot de passe mis à jour avec succès"
}
```

---

### POST /auth/logout

**Quand l'utiliser :** Bouton déconnexion dans les paramètres.

**Headers :** `Authorization: Bearer <accessToken>`

**Réponse (200) :**

```json
{
  "message": "Déconnexion réussie"
}
```

**Action frontend :** Supprimer les tokens stockés et rediriger vers login.

---

### POST /auth/refresh

**Quand l'utiliser :** Quand une requête retourne 401 (accessToken expiré).

**Body :**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Réponse (200) :**

```json
{
  "accessToken": "nouveauAccessToken...",
  "refreshToken": "nouveauRefreshToken..."
}
```

**Implémentation recommandée :** Utiliser un intercepteur HTTP qui :

1. Détecte les erreurs 401
2. Appelle `/auth/refresh` automatiquement
3. Rejoue la requête originale avec le nouveau token
4. Si refresh échoue → déconnexion

---

## 3. Inscription multi-étapes

L'inscription peut se faire de deux façons : **email + mot de passe** (4 étapes) ou **Google** (pré-remplissage puis mêmes étapes 2 à 4).

---

### Parcours A : Inscription avec email + mot de passe

#### Étape 1 : Email & Mot de passe

**Écran :** Formulaire email + mot de passe + "Continuer avec Google"

**Endpoints :** Aucun appel API (validation locale uniquement).

**Données collectées :**

```dart
String email;
String password;
```

---

#### Étape 2 : Profil (Username, Nom, Prénom)

**Écran :** Formulaire username + prénom + nom (ou username + phone + bio selon ton design)

**Endpoint à appeler :**

#### GET /user/check-username?username=...

**Quand :** À chaque modification du champ username (debounce 500ms recommandé).

```
GET /user/check-username?username=Nagato
```

**Réponse :**

```json
{ "available": true }   // ✅ Pseudo libre
{ "available": false }  // ❌ Pseudo déjà pris
```

**UX recommandée :**

- Afficher ✅ vert si disponible
- Afficher ❌ rouge + message si pris
- Désactiver le bouton "Suivant" si pseudo invalide

**Données collectées :**

```dart
String username;
String? firstName;
String? lastName;
String? phone;
String? bio;
```

---

#### Étape 3 : Préférences (Genres & Mood)

**Écran :** Sélection de genres (chips multi-select) + mood (cards single-select)

**Endpoints à appeler au chargement de l'écran :**

#### GET /user/genres

Récupère la liste des genres à afficher.

**Réponse :**

```json
[
  { "value": "ACTION", "label": "Action" },
  { "value": "ADVENTURE", "label": "Aventure" },
  { "value": "COMEDY", "label": "Comédie" },
  { "value": "DRAMA", "label": "Drame" },
  { "value": "FANTASY", "label": "Fantasy" },
  { "value": "HORROR", "label": "Horreur" },
  { "value": "MYSTERY", "label": "Mystère" },
  { "value": "ROMANCE", "label": "Romance" },
  { "value": "SCI_FI", "label": "Science-Fiction" },
  { "value": "SLICE_OF_LIFE", "label": "Tranche de vie" }
]
```

#### GET /user/moods

Récupère la liste des moods à afficher.

**Réponse :**

```json
[
  {
    "value": "CHILL",
    "label": "Chill",
    "description": "🌙 Détente et ambiance calme"
  },
  { "value": "DARK", "label": "Dark", "description": "🖤 Sombre et intense" },
  {
    "value": "HYPE",
    "label": "Hype",
    "description": "⚡ Action et adrénaline"
  },
  {
    "value": "EMOTIONAL",
    "label": "Emotional",
    "description": "💧 Émouvant et touchant"
  }
]
```

**UX recommandée :**

- Genres : chips sélectionnables (minimum 1, max illimité)
- Moods : cards avec description, un seul sélectionnable

**Données collectées :**

```dart
List<String> favoriteGenres;  // ["ACTION", "FANTASY"]
String preferredMood;         // "HYPE"
```

---

#### Étape 4 : Choix de l'avatar

**Écran :** Grille d'avatars à sélectionner

**Endpoints à appeler :**

##### GET /user/avatars

Récupère tous les avatars disponibles depuis Cloudinary.

**Réponse :**

```json
[
  {
    "id": "aniverse/avatars/levi_ackerman",
    "name": "Levi Ackerman",
    "url": "https://res.cloudinary.com/.../levi_ackerman.jpg",
    "folder": ""
  },
  {
    "id": "aniverse/avatars/action/goku",
    "name": "Goku",
    "url": "https://res.cloudinary.com/.../goku.jpg",
    "folder": "action"
  }
]
```

##### GET /user/avatars/folders (optionnel)

Si tu veux afficher des onglets par catégorie.

**Réponse :**

```json
["action", "horror", "romance", "comedy"]
```

##### GET /user/avatars?folder=action (optionnel)

Filtrer par catégorie.

**UX recommandée :**

- Afficher une grille d'avatars (utiliser `url` pour l'image)
- Highlight l'avatar sélectionné
- Stocker l'`url` complet pour l'envoyer au register

**Données collectées :**

```dart
String avatarUrl;  // L'URL complète de l'avatar sélectionné
```

---

#### Étape finale : Envoi de l'inscription

**Quand :** L'utilisateur appuie sur "Terminer" à l'étape 4.

**Endpoint :** `POST /auth/register` (voir section 2)

**Body complet :**

```json
{
  "email": "user@example.com",
  "password": "MotDePasse123!",
  "username": "Nagato",
  "firstName": "Jean",
  "lastName": "Dupont",
  "avatarUrl": "https://res.cloudinary.com/.../levi_ackerman.jpg",
  "favoriteGenres": ["ACTION", "FANTASY"],
  "preferredMood": "HYPE"
}
```

---

### Parcours B : Inscription avec Google

1. **Écran d’inscription, bouton « Continuer avec Google »**
   - Récupérer l’`idToken` (Google Sign-In).
   - Appeler **`POST /auth/google/profile`** avec `{ "idToken": "..." }`.
   - Pré-remplir **email, firstName, lastName** (et optionnellement afficher `avatarUrl`).
   - Garder l’`idToken` en state pour toute la suite.

2. **Étape 2 :** Formulaire **username, phone, bio** (mêmes endpoints que parcours A, ex. `GET /user/check-username`).

3. **Étape 3 :** **Genres & Mood** (`GET /user/genres`, `GET /user/moods`).

4. **Étape 4 :** **Choix de l’avatar** (`GET /user/avatars`). Stocker l’URL de l’avatar choisi (ou laisser la photo Google).

5. **Bouton « Terminer l’inscription »**
   - Appeler **`POST /auth/google/register`** avec :  
     `idToken` + `username`, `phone`, `bio`, `favoriteGenres`, `preferredMood`, `avatarUrl`.
   - Réponse = tokens + user → connecter l’utilisateur et rediriger vers l’accueil.

**Résumé :** Un seul appel au début (`/auth/google/profile`) pour pré-remplir, puis les mêmes étapes 2 à 4 que l’inscription email, et un seul appel à la fin (`/auth/google/register`) pour créer le compte.

---

### Connexion avec Google alors qu’il n’a pas de compte

Sur l’écran **connexion**, si l’utilisateur clique sur « Se connecter avec Google » et n’a pas encore de compte :

1. Appel **`POST /auth/google/login`** avec l’`idToken`.
2. Réponse **401** avec `code: "GOOGLE_NO_ACCOUNT"`.
3. Ne pas afficher une erreur générique : **rediriger vers l’écran d’inscription** en passant l’`idToken` (state / paramètre).
4. Sur l’inscription : appeler **`POST /auth/google/profile`** pour pré-remplir, puis enchaîner les étapes 2 → 3 → 4 et **`POST /auth/google/register`** à la fin.

---

## 4. Gestion du profil

### Vue d'ensemble

| Écran/Action    | Endpoint        | Méthode | Auth |
| --------------- | --------------- | ------- | ---- |
| Page profil     | `/user/profile` | GET     | ✅   |
| Modifier profil | `/user/profile` | PATCH   | ✅   |
| Liste des users | `/user/list`    | GET     | ✅   |

---

### GET /user/list

**Quand l'utiliser :** Liste de tous les utilisateurs (admin / debug). Protégé par JWT.

**Headers :** `Authorization: Bearer <accessToken>`

**Réponse (200) :** Tableau d’utilisateurs (profil public : id, email, username, firstName, lastName, phone, avatarUrl, bio, favoriteGenres, preferredMood, createdAt, updatedAt). Tri par date de création (plus récents en premier).

---

### GET /user/profile

**Quand l'utiliser :** Affichage de la page profil.

**Réponse :**

```json
{
  "id": "clxyz123",
  "email": "user@example.com",
  "username": "Nagato",
  "firstName": "Jean",
  "lastName": "Dupont",
  "phone": null,
  "avatarUrl": "https://...",
  "bio": "Fan d'anime depuis 2010",
  "favoriteGenres": ["ACTION", "FANTASY"],
  "preferredMood": "HYPE",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-28T14:00:00.000Z"
}
```

---

### PATCH /user/profile

**Quand l'utiliser :** Écran de modification du profil.

**Body (partiel, envoie uniquement les champs modifiés) :**

```json
{
  "username": "NouveauPseudo",
  "bio": "Ma nouvelle bio",
  "avatarUrl": "https://...",
  "favoriteGenres": ["COMEDY", "ROMANCE"],
  "preferredMood": "CHILL"
}
```

**Réponse :** Le profil mis à jour (même format que GET).

---

## 5. Catalogue Anime (BFF)

Ces endpoints constituent le **Backend For Frontend** — ils agrègent les données AniList avec les données utilisateur pour fournir une expérience personnalisée.

### Vue d'ensemble

| Écran/Action         | Endpoint           | Méthode | Auth | Cache |
| -------------------- | ------------------ | ------- | ---- | ----- |
| Page d'accueil       | `/anime/home`      | GET     | ✅   | 1h    |
| Section Moods        | `/anime/moods`     | GET     | ❌   | 6h    |
| Page Recherche       | `/anime/search`    | GET     | ❌   | 2h    |
| Calendrier Simulcast | `/anime/simulcast` | GET     | ❌   | 6h    |
| Détails anime        | `/anime/:id`       | GET     | ❌   | 24h   |

---

### GET /anime/home (protégé)

**Quand l'utiliser :** Page d'accueil de l'app, après connexion.

**Réponse :**

```json
{
  "forYou": [
    {
      "id": 15125,
      "title": { "romaji": "Tomo-chan wa Onnanoko!", "english": "Tomo-chan Is a Girl!" },
      "coverImage": { "large": "https://..." },
      "genres": ["COMEDY", "ROMANCE"],
      "averageScore": 75
    }
  ],
  "trending": [...],
  "continueWatching": [
    {
      "anime": { "id": 15125, "title": {...}, ... },
      "progress": 5,
      "status": "WATCHING"
    }
  ],
  "dailySimulcast": [...]
}
```

| Section            | Description                                  |
| ------------------ | -------------------------------------------- |
| `forYou`           | Recommandations basées sur `favoriteGenres`  |
| `trending`         | Anime populaires du moment                   |
| `continueWatching` | Anime dans la watchlist avec statut WATCHING |
| `dailySimulcast`   | Épisodes sortis aujourd'hui                  |

---

### GET /anime/moods

**Quand l'utiliser :** Section "Moods" de l'accueil ou page dédiée.

**Query params :**

- `perMood` (optionnel) : nombre d'anime par mood (défaut: 10)

```
GET /anime/moods?perMood=5
```

**Réponse :**

```json
{
  "CHILL": [
    { "id": 15125, "title": {...}, "coverImage": {...}, ... }
  ],
  "DARK": [...],
  "HYPE": [...],
  "EMOTIONAL": [...]
}
```

---

### GET /anime/search

**Quand l'utiliser :** Page de recherche/navigation.

**Query params :**

| Param     | Type   | Description                              |
| --------- | ------ | ---------------------------------------- |
| `title`   | string | Recherche par titre                      |
| `genre`   | string | Filtrer par genre (ACTION, COMEDY, etc.) |
| `year`    | number | Filtrer par année                        |
| `page`    | number | Page (défaut: 1)                         |
| `perPage` | number | Résultats par page (défaut: 20)          |

```
GET /anime/search?title=One%20Piece&genre=ACTION&page=1
```

**Réponse :**

```json
{
  "Page": {
    "pageInfo": {
      "currentPage": 1,
      "hasNextPage": true,
      "total": 150
    },
    "media": [
      {
        "id": 21,
        "title": { "romaji": "One Piece", "english": "One Piece" },
        "coverImage": { "large": "https://..." },
        "genres": ["ACTION", "ADVENTURE", "COMEDY"],
        "averageScore": 88,
        "episodes": null,
        "status": "RELEASING"
      }
    ]
  }
}
```

---

### GET /anime/simulcast

**Quand l'utiliser :** Calendrier des sorties de la semaine.

**Query params :**

- `page` (défaut: 1)
- `perPage` (défaut: 50)

**Réponse :**

```json
{
  "Page": {
    "media": [
      {
        "id": 15125,
        "title": {...},
        "nextAiringEpisode": {
          "episode": 12,
          "airingAt": 1706540400
        }
      }
    ]
  }
}
```

> `airingAt` est un timestamp UNIX. Convertir en date locale.

---

### GET /anime/:id

**Quand l'utiliser :** Page de détails d'un anime.

```
GET /anime/15125
```

**Réponse :**

```json
{
  "id": 15125,
  "title": {
    "romaji": "Tomo-chan wa Onnanoko!",
    "english": "Tomo-chan Is a Girl!",
    "native": "トモちゃんは女の子!"
  },
  "description": "<p>Synopsis de l'anime...</p>",
  "coverImage": { "large": "https://...", "extraLarge": "https://..." },
  "bannerImage": "https://...",
  "genres": ["COMEDY", "ROMANCE"],
  "averageScore": 75,
  "episodes": 13,
  "duration": 24,
  "status": "FINISHED",
  "season": "WINTER",
  "seasonYear": 2023,
  "studios": { "nodes": [{ "name": "Lay-duce" }] },
  "trailer": { "id": "abc123", "site": "youtube" },
  "characters": {
    "nodes": [
      { "name": { "full": "Tomo Aizawa" }, "image": { "medium": "https://..." } }
    ]
  },
  "recommendations": {
    "nodes": [
      { "mediaRecommendation": { "id": 20583, "title": {...}, "coverImage": {...} } }
    ]
  }
}
```

**Éléments à afficher :**

- Header : `bannerImage` + `coverImage`
- Infos : `title`, `genres`, `averageScore`, `episodes`, `duration`
- Synopsis : `description` (HTML, utiliser un parser)
- Trailer : lien YouTube avec `trailer.id`
- Personnages : carousel avec `characters`
- Recommandations : section "Tu pourrais aimer"

---

## 6. Listes personnelles

Toutes ces routes nécessitent un **Bearer token**.

### Vue d'ensemble

| Écran/Action            | Endpoint                   | Méthode | Description                      |
| ----------------------- | -------------------------- | ------- | -------------------------------- |
| Onglet Favoris          | `/list/favorites`          | GET     | Lister mes favoris               |
| Bouton ❤️ sur anime     | `/list/favorites`          | POST    | Ajouter aux favoris              |
| Bouton ❤️ (retirer)     | `/list/favorites/:animeId` | DELETE  | Retirer des favoris              |
| Onglet Watchlist        | `/list/watchlist`          | GET     | Lister ma watchlist              |
| Bouton "Ajouter"        | `/list/watchlist`          | POST    | Ajouter à la watchlist           |
| Changer statut/progress | `/list/watchlist/:animeId` | PATCH   | Modifier statut/progression      |
| Retirer de watchlist    | `/list/watchlist/:animeId` | DELETE  | Supprimer de la watchlist        |
| Onglet Historique       | `/list/history`            | GET     | Lister l'historique              |
| Marquer épisode vu      | `/list/history`            | POST    | Enregistrer épisode regardé      |
| Effacer historique      | `/list/history/:animeId`   | DELETE  | Effacer un anime de l'historique |
| Vider tout              | `/list/history`            | DELETE  | Vider tout l'historique          |

---

### Favoris

#### GET /list/favorites

**Réponse :**

```json
[
  {
    "id": "clxyz456",
    "animeId": 15125,
    "createdAt": "2026-01-28T10:00:00.000Z"
  }
]
```

> Tu obtiens les `animeId`. Pour afficher les infos, appeler `/anime/:id` ou stocker en cache.

#### POST /list/favorites

**Body :**

```json
{ "animeId": 15125 }
```

**Erreur (409) :** Anime déjà en favoris.

#### DELETE /list/favorites/:animeId

```
DELETE /list/favorites/15125
```

---

### Watchlist

#### GET /list/watchlist

**Query param optionnel :**

- `status` : filtrer par statut (`PLANNING`, `WATCHING`, `COMPLETED`, `DROPPED`)

```
GET /list/watchlist?status=WATCHING
```

**Réponse :**

```json
[
  {
    "id": "clxyz789",
    "animeId": 15125,
    "status": "WATCHING",
    "progress": 5,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-28T14:00:00.000Z"
  }
]
```

#### POST /list/watchlist

Ajoute ou met à jour un anime dans la watchlist.

**Body :**

```json
{
  "animeId": 15125,
  "status": "WATCHING",
  "progress": 1
}
```

| Champ      | Requis | Défaut     |
| ---------- | ------ | ---------- |
| `animeId`  | ✅     | -          |
| `status`   | ❌     | `PLANNING` |
| `progress` | ❌     | `0`        |

#### PATCH /list/watchlist/:animeId

**Body (partiel) :**

```json
{
  "status": "COMPLETED",
  "progress": 13
}
```

#### DELETE /list/watchlist/:animeId

```
DELETE /list/watchlist/15125
```

---

### Historique

#### GET /list/history

**Réponse :**

```json
[
  {
    "id": "clxyz999",
    "animeId": 15125,
    "episode": 12,
    "watchedAt": "2026-01-28T20:30:00.000Z"
  }
]
```

#### POST /list/history

Enregistre un épisode regardé (crée ou met à jour).

**Body :**

```json
{
  "animeId": 15125,
  "episode": 12
}
```

#### DELETE /list/history/:animeId

Supprime l'historique d'un anime spécifique.

#### DELETE /list/history

Vide tout l'historique (confirmation requise côté UI).

---

## 7. Gestion des tokens

### Durée de vie

| Token          | Durée    | Stockage recommandé |
| -------------- | -------- | ------------------- |
| `accessToken`  | 15 min   | Mémoire / RAM       |
| `refreshToken` | 90 jours | SecureStorage       |

### Flow de refresh automatique

```
1. Requête API → 401 Unauthorized
2. Vérifier si on a un refreshToken
3. Appeler POST /auth/refresh
4. Si succès → stocker nouveaux tokens → rejouer la requête
5. Si échec → déconnecter l'utilisateur → rediriger vers login
```

### Exemple d'intercepteur (pseudo-code)

```dart
class AuthInterceptor extends Interceptor {
  @override
  void onError(DioError err) async {
    if (err.response?.statusCode == 401) {
      final refreshToken = await secureStorage.read('refreshToken');
      if (refreshToken != null) {
        try {
          final response = await dio.post('/auth/refresh', data: {
            'refreshToken': refreshToken
          });
          // Stocker les nouveaux tokens
          await secureStorage.write('accessToken', response.data['accessToken']);
          await secureStorage.write('refreshToken', response.data['refreshToken']);
          // Rejouer la requête originale
          return handler.resolve(await dio.fetch(err.requestOptions));
        } catch (_) {
          // Refresh échoué → déconnexion
          await authService.logout();
        }
      }
    }
    return handler.next(err);
  }
}
```

---

## 8. Codes d'erreur

| Code | Signification         | Action frontend                    |
| ---- | --------------------- | ---------------------------------- |
| 200  | Succès                | Afficher les données               |
| 201  | Créé avec succès      | Afficher confirmation              |
| 400  | Données invalides     | Afficher les erreurs de validation |
| 401  | Non authentifié       | Refresh token ou rediriger login   |
| 403  | Accès interdit        | Afficher message d'erreur          |
| 404  | Ressource non trouvée | Afficher "Non trouvé"              |
| 409  | Conflit (doublon)     | Ex: "Déjà en favoris"              |
| 500  | Erreur serveur        | Afficher "Erreur, réessayer"       |

### Format des erreurs

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password is too short"],
  "error": "Bad Request"
}
```

---

## 9. Types et Enums

### Genres

```typescript
enum Genre {
  ACTION
  ADVENTURE
  COMEDY
  DRAMA
  FANTASY
  HORROR
  MYSTERY
  ROMANCE
  SCI_FI
  SLICE_OF_LIFE
}
```

### Moods

```typescript
enum Mood {
  CHILL      // 🌙 Détente et ambiance calme
  DARK       // 🖤 Sombre et intense
  HYPE       // ⚡ Action et adrénaline
  EMOTIONAL  // 💧 Émouvant et touchant
}
```

### WatchStatus

```typescript
enum WatchStatus {
  PLANNING   // À regarder
  WATCHING   // En cours
  COMPLETED  // Terminé
  DROPPED    // Abandonné
}
```

---

## Récapitulatif des écrans et endpoints

| Écran                      | Endpoints utilisés                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Splash screen              | `GET /auth/me`                                                                             |
| Login (email)              | `POST /auth/send-login-code` → utilisateur reçoit le code → `POST /auth/verify-login-code` |
| Login (Google)             | `POST /auth/google/login` (si 401 + GOOGLE_NO_ACCOUNT → inscription)                       |
| Inscription Google étape 1 | `POST /auth/google/profile` (pré-remplir email, prénom, nom)                               |
| Inscription étape 1        | (aucun pour email/password)                                                                |
| Inscription étape 2        | `GET /user/check-username`                                                                 |
| Inscription étape 3        | `GET /user/genres`, `GET /user/moods`                                                      |
| Inscription étape 4        | `GET /user/avatars`, `GET /user/avatars/folders`                                           |
| Fin inscription            | `POST /auth/register` ou `POST /auth/google/register`                                      |
| Accueil                    | `GET /anime/home`                                                                          |
| Recherche                  | `GET /anime/search`                                                                        |
| Détails anime              | `GET /anime/:id`                                                                           |
| Calendrier                 | `GET /anime/simulcast`                                                                     |
| Page profil                | `GET /user/profile`                                                                        |
| Modifier profil            | `PATCH /user/profile`                                                                      |
| Mes favoris                | `GET /list/favorites`                                                                      |
| Ma watchlist               | `GET /list/watchlist`                                                                      |
| Mon historique             | `GET /list/history`                                                                        |
| Mot de passe oublié        | `POST /auth/forgot-password`                                                               |
| Reset password             | `POST /auth/reset-password`                                                                |
| Déconnexion                | `POST /auth/logout`                                                                        |
