# Sécurisation du Backend (NestJS)

## Ce qui a été mis en place

### 1. Helmet
- **Rôle** : Configure des en-têtes HTTP de sécurité (XSS, clickjacking, MIME sniffing, etc.).
- **Où** : `src/main.ts` → `app.use(helmet())`.
- **Effet** : Toutes les réponses partent avec des headers sécurisés.

> Si Swagger ne s’affiche plus correctement (CSP), tu peux assouplir Helmet :
> `app.use(helmet({ contentSecurityPolicy: false }));` ou configurer CSP pour autoriser Swagger.

### 2. Rate limiting (Throttler)
- **Rôle** : Limite le nombre de requêtes par IP pour limiter le brute force et les abus.
- **Où** : `src/app.module.ts` (ThrottlerModule + ThrottlerGuard global).
- **Config actuelle** : 100 requêtes par minute par IP (ttl: 60_000 ms, limit: 100).
- **Personnalisation** :
  - Routes à exclure : `@SkipThrottle()` sur un controller ou une route.
  - Limites plus strictes sur l’auth : `@Throttle({ default: { limit: 5, ttl: 60000 } })` sur `AuthController`.

### 3. Validation des entrées (ValidationPipe + class-validator)
- **Rôle** : Ne jamais faire confiance au client ; valider et filtrer toutes les entrées.
- **Où** : `src/main.ts` → `app.useGlobalPipes(new ValidationPipe({ ... }))`.
- **Options** :
  - `transform: true` : conversion des types (query/body en number, etc.).
  - `whitelist: true` : suppression des propriétés non décorées dans les DTOs.
  - `forbidNonWhitelisted: true` : erreur 400 si le client envoie des champs non prévus.

> Si le front envoie des champs en plus (ex. `createdAt`), tu auras 400. Soit tu les ajoutes au DTO, soit tu passes `forbidNonWhitelisted: false` (moins strict).

---

## Résumé

| Mesure           | Fichier(s)        | Statut |
|------------------|-------------------|--------|
| Helmet           | `main.ts`         | OK     |
| Rate limiting    | `app.module.ts`   | OK     |
| ValidationPipe   | `main.ts`         | OK     |
| class-validator  | DTOs (auth, list, user, anime) | OK |

---

## Commandes

Après ajout de `helmet` et `@nestjs/throttler` dans `package.json` :

```bash
npm install
```

Puis redémarrer le backend.
