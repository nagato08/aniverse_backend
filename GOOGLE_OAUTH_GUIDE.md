# Guide d'implémentation Google OAuth

Ce guide explique comment utiliser l'authentification Google dans ton app mobile avec ce backend NestJS.

## 📋 Prérequis

1. ✅ Compte Google Cloud créé
2. ✅ `GOOGLE_CLIENT_ID` récupéré et ajouté dans `.env`
3. ✅ Backend NestJS configuré (déjà fait ✅)

## 🔑 Configuration Google Cloud

### 1. Créer les OAuth 2.0 Client IDs

Dans Google Cloud Console → **APIs & Services** → **Credentials** :

- **Pour Android** : Crée un "OAuth 2.0 Client ID" de type "Android"
  - Package name : `com.tonapp.aniverse` (exemple)
  - SHA-1 certificate fingerprint : récupère-le avec `keytool` ou depuis Android Studio

- **Pour iOS** : Crée un "OAuth 2.0 Client ID" de type "iOS"
  - Bundle ID : `com.tonapp.aniverse` (exemple)

**Important** : Le `GOOGLE_CLIENT_ID` dans ton `.env` doit être le même pour Android et iOS (ou tu peux avoir deux IDs différents si besoin).

### 2. Activer Google Sign-In API

Dans Google Cloud Console → **APIs & Services** → **Library** :
- Recherche "Google Sign-In API"
- Active-la

## 📱 Implémentation côté Mobile

### Android (Kotlin/Java)

```kotlin
// 1. Ajoute la dépendance dans build.gradle
implementation 'com.google.android.gms:play-services-auth:20.7.0'

// 2. Configure GoogleSignIn dans ton Activity/Fragment
val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestIdToken("490310154267-2cgl72dpg3prv6ksmq74vhj24dquvklf.apps.googleusercontent.com")
    .requestEmail()
    .build()

val googleSignInClient = GoogleSignIn.getClient(this, gso)

// 3. Lance la connexion Google
val signInIntent = googleSignInClient.signInIntent
startActivityForResult(signInIntent, RC_SIGN_IN)

// 4. Récupère l'idToken dans onActivityResult
override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    
    if (requestCode == RC_SIGN_IN) {
        val task = GoogleSignIn.getSignedInAccountFromIntent(data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken // 👈 C'est ce token qu'on envoie au backend
            
            // Envoie idToken à ton backend
            loginWithGoogle(idToken)
        } catch (e: ApiException) {
            // Gère l'erreur
        }
    }
}

// 5. Appelle ton API backend
fun loginWithGoogle(idToken: String) {
    val request = LoginWithGoogleDto(idToken = idToken)
    
    apiService.post("/auth/google/login", request)
        .enqueue(object : Callback<AuthResponse> {
            override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                if (response.isSuccessful) {
                    val authResponse = response.body()
                    // Sauvegarde accessToken et refreshToken
                    saveTokens(authResponse.accessToken, authResponse.refreshToken)
                }
            }
            override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                // Gère l'erreur
            }
        })
}
```

### iOS (Swift)

```swift
// 1. Installe GoogleSignIn via CocoaPods ou SPM
// Podfile: pod 'GoogleSignIn'

// 2. Configure dans AppDelegate ou SceneDelegate
import GoogleSignIn

let clientID = "490310154267-2cgl72dpg3prv6ksmq74vhj24dquvklf.apps.googleusercontent.com"
GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

// 3. Lance la connexion Google
GIDSignIn.sharedInstance.signIn(withPresenting: self) { result, error in
    guard error == nil else {
        // Gère l'erreur
        return
    }
    
    guard let user = result?.user,
          let idToken = user.idToken?.tokenString else {
        return
    }
    
    // Envoie idToken à ton backend
    loginWithGoogle(idToken: idToken)
}

// 4. Appelle ton API backend
func loginWithGoogle(idToken: String) {
    let url = URL(string: "https://ton-api.com/auth/google/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = ["idToken": idToken]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        // Parse la réponse et sauvegarde les tokens
        if let data = data,
           let authResponse = try? JSONDecoder().decode(AuthResponse.self, from: data) {
            // Sauvegarde accessToken et refreshToken
            saveTokens(authResponse.accessToken, authResponse.refreshToken)
        }
    }.resume()
}
```

### React Native (Expo)

```typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Configure Google OAuth
const [request, response, promptAsync] = Google.useAuthRequest({
  iosClientId: '490310154267-2cgl72dpg3prv6ksmq74vhj24dquvklf.apps.googleusercontent.com',
  androidClientId: '490310154267-2cgl72dpg3prv6ksmq74vhj24dquvklf.apps.googleusercontent.com',
  webClientId: '490310154267-2cgl72dpg3prv6ksmq74vhj24dquvklf.apps.googleusercontent.com',
});

// Lance la connexion
const handleGoogleLogin = async () => {
  const result = await promptAsync();
  
  if (result.type === 'success') {
    const { idToken } = result.params;
    
    // Envoie idToken à ton backend
    const response = await fetch('https://ton-api.com/auth/google/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    
    const authResponse = await response.json();
    // Sauvegarde accessToken et refreshToken
    await saveTokens(authResponse.accessToken, authResponse.refreshToken);
  }
};
```

## 🔄 Flux d'authentification

### 1. Inscription avec Google (`POST /auth/google/register`)

```json
POST /auth/google/register
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",
  "username": "Nagato",
  "favoriteGenres": ["ACTION", "FANTASY"],
  "preferredMood": "HYPE",
  "favoriteAnimeIds": [15125, 20583]
}
```

**Réponse** :
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx...",
    "email": "user@gmail.com",
    "username": "Nagato",
    "firstName": "Jean",
    "lastName": "Dupont",
    "avatarUrl": "https://..."
  }
}
```

### 2. Connexion avec Google (`POST /auth/google/login`)

```json
POST /auth/google/login
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
}
```

**Réponse** : Même format que l'inscription

## ⚠️ Gestion des erreurs

### Erreurs possibles

- **401 Unauthorized** : `Token Google invalide ou expiré`
  - Vérifie que le token provient bien de Google Sign-In
  - Vérifie que le token n'est pas expiré (durée de vie ~1h)

- **401 Unauthorized** : `Aucun compte trouvé avec ce compte Google`
  - L'utilisateur doit s'inscrire d'abord avec `/auth/google/register`

- **400 Bad Request** : `Le compte Google doit avoir un email associé`
  - Le compte Google utilisé n'a pas d'email (rare)

- **400 Bad Request** : `Compte Google déjà utilisé`
  - Tentative d'inscription avec un compte déjà enregistré

## 🔒 Sécurité

1. **Vérification côté backend** : Le backend vérifie toujours l'`idToken` avec Google avant de créer/connecter un utilisateur
2. **Pas de mot de passe** : Les comptes Google n'ont pas de `passwordHash` en DB
3. **Tokens JWT** : Après authentification Google, le backend émet ses propres tokens (accessToken + refreshToken)

## 📝 Notes importantes

- L'`idToken` Google expire après ~1h. Il doit être utilisé immédiatement après l'obtention.
- Le `GOOGLE_CLIENT_ID` dans `.env` doit correspondre au Client ID configuré dans Google Cloud Console.
- Pour la production, configure les **Authorized redirect URIs** dans Google Cloud Console.

## 🧪 Test

Pour tester rapidement :

1. Utilise Postman ou curl pour simuler l'appel :
```bash
curl -X POST http://localhost:3000/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{"idToken": "TON_ID_TOKEN_GOOGLE"}'
```

2. Pour obtenir un `idToken` de test, utilise [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
