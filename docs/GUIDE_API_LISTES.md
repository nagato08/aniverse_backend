# Guide d'utilisation des endpoints de listes (Watchlist, Historique, Favoris)

## 📋 Endpoints disponibles

Tous les endpoints sont protégés par JWT (nécessitent un token d'authentification).

---

## ⭐ FAVORIS

### GET /list/favorites
Récupère la liste des favoris de l'utilisateur connecté.

**Réponse :**
```json
[
  {
    "id": "clxyz123",
    "animeId": 15125,
    "createdAt": "2026-01-20T10:00:00.000Z"
  }
]
```

**Utilisation dans ApiService :**
```dart
Future<List<Map<String, dynamic>>> getFavorites() async {
  final response = await dio.get('/list/favorites');
  return (response.data as List).cast<Map<String, dynamic>>();
}
```

**Exemple d'utilisation :**
```dart
final api = Provider.of<ApiService>(context, listen: false);
final favorites = await api.getFavorites();
for (final fav in favorites) {
  print('Anime favori ID: ${fav['animeId']}');
}
```

---

### POST /list/favorites
Ajoute un anime aux favoris.

**Body :**
```json
{
  "animeId": 15125
}
```

**Utilisation dans ApiService :**
```dart
Future<Response> addFavorite(int animeId) async {
  return await dio.post('/list/favorites', data: {'animeId': animeId});
}
```

**Exemple d'utilisation :**
```dart
try {
  await api.addFavorite(15125);
  print('Anime ajouté aux favoris !');
} catch (e) {
  if (e is DioException && e.response?.statusCode == 409) {
    print('Cet anime est déjà dans vos favoris');
  }
}
```

---

### DELETE /list/favorites/:animeId
Retire un anime des favoris.

**Utilisation dans ApiService :**
```dart
Future<Response> removeFavorite(int animeId) async {
  return await dio.delete('/list/favorites/$animeId');
}
```

**Exemple d'utilisation :**
```dart
await api.removeFavorite(15125);
print('Anime retiré des favoris');
```

---

## 📺 WATCHLIST

### GET /list/watchlist
Récupère la watchlist de l'utilisateur connecté.

**Query params optionnels :**
- `status` : Filtrer par statut (`PLANNING`, `WATCHING`, `COMPLETED`, `DROPPED`)

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

**Utilisation dans ApiService :**
```dart
Future<List<Map<String, dynamic>>> getWatchlist({String? status}) async {
  final queryParams = status != null ? {'status': status} : null;
  final response = await dio.get('/list/watchlist', queryParameters: queryParams);
  return (response.data as List).cast<Map<String, dynamic>>();
}
```

**Exemples d'utilisation :**
```dart
// Récupérer toute la watchlist
final allWatchlist = await api.getWatchlist();

// Filtrer uniquement les animes en cours de visionnage
final watching = await api.getWatchlist(status: 'WATCHING');

// Filtrer les animes terminés
final completed = await api.getWatchlist(status: 'COMPLETED');
```

---

### POST /list/watchlist
Ajoute ou met à jour un anime dans la watchlist (upsert).

**Body :**
```json
{
  "animeId": 15125,
  "status": "WATCHING",  // Optionnel (défaut: "PLANNING")
  "progress": 5           // Optionnel (défaut: 0)
}
```

**Utilisation dans ApiService :**
```dart
Future<Response> upsertWatchlist({
  required int animeId,
  String? status,
  int? progress,
}) async {
  final data = <String, dynamic>{'animeId': animeId};
  if (status != null) data['status'] = status;
  if (progress != null) data['progress'] = progress;
  return await dio.post('/list/watchlist', data: data);
}
```

**Exemples d'utilisation :**
```dart
// Ajouter un anime à la watchlist (statut par défaut: PLANNING)
await api.upsertWatchlist(animeId: 15125);

// Ajouter avec statut et progression
await api.upsertWatchlist(
  animeId: 15125,
  status: 'WATCHING',
  progress: 3,
);
```

---

### PATCH /list/watchlist/:animeId
Met à jour une entrée existante de la watchlist.

**Body (partiel) :**
```json
{
  "status": "COMPLETED",  // Optionnel
  "progress": 13          // Optionnel
}
```

**Utilisation dans ApiService :**
```dart
Future<Response> updateWatchlist({
  required int animeId,
  String? status,
  int? progress,
}) async {
  final data = <String, dynamic>{};
  if (status != null) data['status'] = status;
  if (progress != null) data['progress'] = progress;
  return await dio.patch('/list/watchlist/$animeId', data: data);
}
```

**Exemples d'utilisation :**
```dart
// Mettre à jour uniquement le statut
await api.updateWatchlist(
  animeId: 15125,
  status: 'COMPLETED',
);

// Mettre à jour uniquement la progression
await api.updateWatchlist(
  animeId: 15125,
  progress: 10,
);

// Mettre à jour les deux
await api.updateWatchlist(
  animeId: 15125,
  status: 'WATCHING',
  progress: 12,
);
```

---

### DELETE /list/watchlist/:animeId
Retire un anime de la watchlist.

**Utilisation dans ApiService :**
```dart
Future<Response> removeWatchlist(int animeId) async {
  return await dio.delete('/list/watchlist/$animeId');
}
```

**Exemple d'utilisation :**
```dart
await api.removeWatchlist(15125);
print('Anime retiré de la watchlist');
```

---

## 📚 HISTORIQUE

### GET /list/history
Récupère l'historique de visionnage de l'utilisateur connecté.

**Réponse :**
```json
[
  {
    "id": "clxyz999",
    "animeId": 15125,
    "episode": 12,
    "updatedAt": "2026-01-28T20:30:00.000Z"
  }
]
```

**Utilisation dans ApiService :**
```dart
Future<List<Map<String, dynamic>>> getHistory() async {
  final response = await dio.get('/list/history');
  return (response.data as List).cast<Map<String, dynamic>>();
}
```

**Exemple d'utilisation :**
```dart
final history = await api.getHistory();
for (final item in history) {
  print('Anime ${item['animeId']} - Épisode ${item['episode']}');
}
```

---

### POST /list/history
Enregistre ou met à jour l'historique pour un anime (upsert).

**Body :**
```json
{
  "animeId": 15125,
  "episode": 12
}
```

**Utilisation dans ApiService :**
```dart
Future<Response> upsertHistory({
  required int animeId,
  required int episode,
}) async {
  return await dio.post('/list/history', data: {
    'animeId': animeId,
    'episode': episode,
  });
}
```

**Exemple d'utilisation :**
```dart
// Enregistrer qu'on a regardé l'épisode 5 de l'anime 15125
await api.upsertHistory(animeId: 15125, episode: 5);
```

---

### DELETE /list/history/:animeId
Supprime l'historique d'un anime spécifique.

**Utilisation dans ApiService :**
```dart
Future<Response> removeHistory(int animeId) async {
  return await dio.delete('/list/history/$animeId');
}
```

**Exemple d'utilisation :**
```dart
await api.removeHistory(15125);
print('Historique de l\'anime supprimé');
```

---

### DELETE /list/history
Vide tout l'historique de l'utilisateur connecté.

**Utilisation dans ApiService :**
```dart
Future<Response> clearHistory() async {
  return await dio.delete('/list/history');
}
```

**Exemple d'utilisation :**
```dart
// Demander confirmation avant de vider
showDialog(
  context: context,
  builder: (context) => AlertDialog(
    title: Text('Vider l\'historique'),
    content: Text('Êtes-vous sûr de vouloir supprimer tout votre historique ?'),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('Annuler'),
      ),
      TextButton(
        onPressed: () async {
          await api.clearHistory();
          Navigator.pop(context);
          // Rafraîchir l'affichage
        },
        child: Text('Supprimer'),
      ),
    ],
  ),
);
```

---

## 🔄 Statuts de watchlist

Les statuts possibles sont :
- `PLANNING` : À regarder
- `WATCHING` : En cours de visionnage
- `COMPLETED` : Terminé
- `DROPPED` : Abandonné

---

## 📝 Notes importantes

1. **Tous les endpoints nécessitent une authentification JWT** (votre intercepteur Dio gère cela automatiquement).

2. **Les endpoints POST sont idempotents** : si vous ajoutez un anime déjà présent, il sera mis à jour plutôt que de créer un doublon.

3. **Les endpoints DELETE sont idempotents** : supprimer un élément déjà supprimé ne génère pas d'erreur.

4. **Les IDs d'anime sont les IDs AniList** (nombres entiers).

5. **Gestion des erreurs** : N'oubliez pas de gérer les erreurs (DioException) dans vos appels API.

---

## 🎯 Exemple complet d'intégration dans ListScreen

Voir le fichier `test.dart` pour un exemple complet d'utilisation de ces méthodes dans un écran Flutter avec onglets.
