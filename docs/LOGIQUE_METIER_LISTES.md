# 📚 Logique Métier - Les 3 Listes (Favoris, Watchlist, Historique)

## 🎯 Vue d'ensemble

Votre application utilise **3 listes distinctes** pour gérer les animes de l'utilisateur. Chaque liste a un rôle spécifique et des conditions d'ajout différentes.

---

## ⭐ FAVORIS (`Favorite`)

### 🎯 Rôle
**Liste simple de "j'aime"** - Les animes que l'utilisateur aime particulièrement.

### 📋 Caractéristiques
- **Pas de statut** : Un anime est soit dans les favoris, soit il ne l'est pas
- **Pas de progression** : Pas de suivi d'épisodes
- **Simple bookmark** : Comme un "like" ou "favori" sur les réseaux sociaux

### ➕ Conditions d'ajout
Un anime se retrouve dans les favoris **uniquement** si :
- L'utilisateur clique explicitement sur le bouton "Ajouter aux favoris" (❤️)
- L'appel API `POST /list/favorites` est effectué avec l'`animeId`

**Exemple** :
```dart
// L'utilisateur clique sur le bouton ❤️ dans l'écran de détails
await api.addFavorite(15125);
```

### 🔄 Comportement
- **Ajout manuel uniquement** : Pas d'ajout automatique
- **Unicité** : Un anime ne peut être ajouté qu'une seule fois (erreur 409 si déjà présent)
- **Pas de mise à jour** : Soit présent, soit absent (pas de statut à modifier)

### 📊 Données stockées
```typescript
{
  animeId: 15125,
  createdAt: "2026-01-28T10:00:00.000Z"
}
```

### 💡 Cas d'usage
- Marquer ses animes préférés
- Créer une liste de recommandations personnelles
- Afficher une section "Mes favoris" sur le profil

---

## 📺 WATCHLIST (`WatchlistItem`)

### 🎯 Rôle
**Liste de suivi avec statut et progression** - Les animes que l'utilisateur suit activement.

### 📋 Caractéristiques
- **Statut de visionnage** : `PLANNING`, `WATCHING`, `COMPLETED`, `DROPPED`
- **Progression** : Numéro de l'épisode actuel (ou dernier épisode vu)
- **Suivi actif** : Permet de suivre l'avancement dans un anime

### ➕ Conditions d'ajout
Un anime se retrouve dans la watchlist si :
1. **Ajout manuel** : L'utilisateur clique sur "Ajouter à ma watchlist"
   ```dart
   await api.upsertWatchlist(
     animeId: 15125,
     status: 'PLANNING',  // Optionnel (défaut: PLANNING)
     progress: 0           // Optionnel (défaut: 0)
   );
   ```

2. **Mise à jour automatique** : Quand l'utilisateur met à jour le statut/progression
   ```dart
   // L'utilisateur change le statut de PLANNING à WATCHING
   await api.updateWatchlist(
     animeId: 15125,
     status: 'WATCHING',
     progress: 5
   );
   ```

### 🔄 Comportement
- **Upsert** : Si l'anime existe déjà, il est mis à jour (pas d'erreur)
- **Statuts possibles** :
  - `PLANNING` : "À regarder" (par défaut)
  - `WATCHING` : "En cours de visionnage"
  - `COMPLETED` : "Terminé"
  - `DROPPED` : "Abandonné"
- **Progression** : Numéro d'épisode (0 par défaut)

### 📊 Données stockées
```typescript
{
  animeId: 15125,
  status: "WATCHING",
  progress: 5,
  createdAt: "2026-01-20T10:00:00.000Z",
  updatedAt: "2026-01-28T14:00:00.000Z"
}
```

### 💡 Cas d'usage
- Gérer sa liste d'animes à regarder
- Suivre sa progression dans les animes en cours
- Filtrer par statut (ex: voir uniquement les animes "WATCHING")
- Utilisé dans la section "Continue Watching" de la page d'accueil

### 🔗 Relation avec l'historique
- **Indépendant** : La watchlist et l'historique sont séparés
- **Peut être synchronisé** : Vous pouvez mettre à jour la watchlist quand l'historique change (à implémenter côté frontend)

---

## 📚 HISTORIQUE (`HistoryItem`)

### 🎯 Rôle
**Enregistrement automatique du dernier épisode vu** - Traçabilité de ce que l'utilisateur a regardé.

### 📋 Caractéristiques
- **1 ligne par anime** : Un seul enregistrement par anime (le dernier épisode vu)
- **Mise à jour automatique** : Se met à jour à chaque fois qu'un épisode est regardé
- **Pas de statut** : Juste le numéro d'épisode

### ➕ Conditions d'ajout
Un anime se retrouve dans l'historique si :
1. **Enregistrement manuel** : L'utilisateur marque un épisode comme "vu"
   ```dart
   // L'utilisateur regarde l'épisode 12 de l'anime 15125
   await api.upsertHistory(
     animeId: 15125,
     episode: 12
   );
   ```

2. **Mise à jour automatique** : Si l'anime existe déjà dans l'historique, seul l'épisode est mis à jour
   ```dart
   // L'utilisateur regarde maintenant l'épisode 13
   await api.upsertHistory(
     animeId: 15125,
     episode: 13  // Remplace l'épisode 12
   );
   ```

### 🔄 Comportement
- **Upsert** : Si l'anime existe déjà, seul l'épisode est mis à jour (pas de doublon)
- **Unicité** : Un seul enregistrement par anime (le dernier épisode vu)
- **Mise à jour automatique** : `updatedAt` se met à jour à chaque modification

### 📊 Données stockées
```typescript
{
  animeId: 15125,
  episode: 12,
  updatedAt: "2026-01-28T20:30:00.000Z"
}
```

### 💡 Cas d'usage
- Retrouver rapidement où on s'est arrêté dans un anime
- Afficher "Dernier épisode regardé : Épisode 12"
- Utilisé dans la section "Continue Watching" de la page d'accueil
- Permet de reprendre la lecture là où on s'est arrêté

### 🔗 Relation avec la watchlist
- **Indépendant** : L'historique et la watchlist sont séparés
- **Peut être synchronisé** : Vous pouvez mettre à jour la watchlist (`progress`) quand l'historique change (à implémenter côté frontend)

---

## 🔄 Comparaison des 3 listes

| Critère | Favoris | Watchlist | Historique |
|--------|---------|-----------|------------|
| **Rôle** | "J'aime" | Suivi avec statut | Dernier épisode vu |
| **Statut** | ❌ Non | ✅ Oui (4 statuts) | ❌ Non |
| **Progression** | ❌ Non | ✅ Oui (épisode actuel) | ✅ Oui (dernier épisode) |
| **Ajout automatique** | ❌ Non | ⚠️ Possible (à implémenter) | ⚠️ Possible (à implémenter) |
| **Mise à jour** | ❌ Non | ✅ Oui (statut + progression) | ✅ Oui (épisode uniquement) |
| **Unicité** | ✅ 1 par anime | ✅ 1 par anime | ✅ 1 par anime |
| **Cas d'usage principal** | Liste de favoris | Gestion de suivi | Reprendre la lecture |

---

## 🎬 Scénarios d'utilisation typiques

### Scénario 1 : Découverte d'un anime
1. L'utilisateur découvre "Attack on Titan" sur la page d'accueil
2. Il clique sur l'anime pour voir les détails
3. Il clique sur "Ajouter à ma watchlist" → **Watchlist** : `PLANNING`, `progress: 0`
4. Il clique sur ❤️ → **Favoris** : Ajouté

### Scénario 2 : Commencer à regarder
1. L'utilisateur commence à regarder "Attack on Titan"
2. Il met à jour sa watchlist : `status: WATCHING`, `progress: 1`
3. Il regarde l'épisode 1 → **Historique** : `episode: 1`
4. Il regarde l'épisode 2 → **Historique** : `episode: 2` (mise à jour)

### Scénario 3 : Continuer la lecture
1. L'utilisateur revient sur l'app quelques jours plus tard
2. Il consulte son **Historique** → "Dernier épisode regardé : Épisode 5"
3. Il reprend la lecture à l'épisode 6
4. **Historique** : `episode: 6` (mise à jour)
5. **Watchlist** : `progress: 6` (peut être mis à jour automatiquement)

### Scénario 4 : Terminer un anime
1. L'utilisateur termine "Attack on Titan" (24 épisodes)
2. Il met à jour sa watchlist : `status: COMPLETED`, `progress: 24`
3. **Historique** : `episode: 24` (dernier épisode vu)
4. L'anime reste dans les **Favoris** s'il l'aime toujours

---

## ⚠️ Points importants

### 1. Indépendance des listes
- **Un anime peut être dans les 3 listes en même temps** :
  - Dans les **Favoris** (il l'aime)
  - Dans la **Watchlist** avec statut `WATCHING` (il le regarde)
  - Dans l'**Historique** avec `episode: 12` (il a regardé jusqu'à l'épisode 12)

### 2. Synchronisation (optionnelle)
Actuellement, les listes sont **indépendantes**. Vous pouvez implémenter une synchronisation côté frontend :
- Quand l'historique change → Mettre à jour la watchlist (`progress`)
- Quand la watchlist passe à `WATCHING` → Créer une entrée dans l'historique si elle n'existe pas

### 3. Suppression
- **Favoris** : Suppression manuelle uniquement
- **Watchlist** : Suppression manuelle ou automatique (ex: si statut `DROPPED` depuis longtemps)
- **Historique** : Peut être vidé automatiquement (ex: après X jours) ou manuellement

---

## 📝 Résumé en une phrase

- **Favoris** : "J'aime cet anime" (simple bookmark)
- **Watchlist** : "Je suis cet anime" (avec statut et progression)
- **Historique** : "J'ai regardé jusqu'à l'épisode X" (traçabilité)

---

## 🎯 Recommandations d'implémentation frontend

### Workflow recommandé

1. **Quand l'utilisateur regarde un épisode** :
   ```dart
   // 1. Mettre à jour l'historique
   await api.upsertHistory(animeId: 15125, episode: 12);
   
   // 2. Optionnel : Synchroniser la watchlist
   await api.updateWatchlist(
     animeId: 15125,
     progress: 12,
     status: 'WATCHING'  // Si pas déjà WATCHING
   );
   ```

2. **Quand l'utilisateur termine un anime** :
   ```dart
   // 1. Mettre à jour la watchlist
   await api.updateWatchlist(
     animeId: 15125,
     status: 'COMPLETED',
     progress: 24
   );
   
   // 2. Historique déjà à jour (dernier épisode)
   ```

3. **Quand l'utilisateur abandonne un anime** :
   ```dart
   await api.updateWatchlist(
     animeId: 15125,
     status: 'DROPPED',
     progress: 5  // Dernier épisode regardé
   );
   ```

---

## ✅ Conclusion

Vos 3 listes sont **complémentaires** et permettent une gestion complète de l'expérience utilisateur :
- **Favoris** : Pour les préférences
- **Watchlist** : Pour le suivi actif
- **Historique** : Pour la traçabilité

Elles peuvent fonctionner indépendamment ou être synchronisées selon vos besoins UX ! 🎉
