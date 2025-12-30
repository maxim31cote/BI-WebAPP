# 📁 Structure du Projet - Blue Iris Mobile PWA

```
mobile-app/
│
├── 📄 Configuration & Build
│   ├── package.json                 # Dépendances NPM (Vue 3, Vite, etc.)
│   ├── vite.config.js              # Configuration Vite + PWA plugin
│   ├── .gitignore                  # Exclusions Git
│   └── index.html                  # Template HTML avec loading screen
│
├── 📚 Documentation
│   ├── README.md                   # Documentation utilisateur
│   ├── INSTALLATION.md            # Guide installation complet
│   ├── PROJECT_SUMMARY.md         # Récapitulatif du projet
│   ├── PROJET_TERMINE.md          # Status final du projet
│   └── demo.html                  # Page de démonstration
│
├── 🎨 public/ - Assets statiques
│   ├── icon.svg                   # Icône source vectorielle
│   ├── manifest.json              # Manifest PWA
│   ├── ICONS_README.md           # Guide création icônes
│   ├── icon-192.png              # [À générer] Icône 192x192
│   └── icon-512.png              # [À générer] Icône 512x512
│
└── 🔧 src/ - Code source
    │
    ├── main.js                    # 🚀 Point d'entrée
    │   └── Initialise: Vue, Router, Pinia, i18n
    │
    ├── App.vue                    # 🏠 Composant racine
    │   └── Navigation bottom bar + transitions
    │
    ├── style.css                  # 🎨 Styles globaux
    │   └── Variables CSS, animations, utilities
    │
    ├── 🌐 i18n/ - Internationalisation
    │   ├── index.js              # Config i18n + détection auto
    │   ├── fr.js                 # Traductions françaises
    │   └── en.js                 # Traductions anglaises
    │
    ├── 🗺️ router/ - Navigation
    │   └── index.js              # Routes + guards auth
    │       ├── /login
    │       ├── /live
    │       ├── /clips
    │       ├── /timeline
    │       └── /settings
    │
    ├── 🗃️ stores/ - State Management (Pinia)
    │   ├── auth.js               # 🔐 Authentification
    │   │   ├── login()
    │   │   ├── logout()
    │   │   └── session management
    │   │
    │   ├── cameras.js            # 📹 Caméras
    │   │   ├── fetchCameras()
    │   │   ├── fetchStatus()
    │   │   ├── ptzCommand()
    │   │   ├── getStreamURL()
    │   │   └── auto-update
    │   │
    │   └── settings.js           # ⚙️ Paramètres
    │       ├── language
    │       ├── theme (dark/light/auto)
    │       └── videoQuality
    │
    ├── 🔌 api/ - Client HTTP
    │   └── client.js             # BlueIrisAPI class
    │       ├── login()           # Authentification MD5
    │       ├── getCameras()      # Liste caméras
    │       ├── getStatus()       # Status serveur
    │       ├── getClips()        # Enregistrements
    │       ├── ptzCommand()      # Contrôles PTZ
    │       ├── triggerCamera()   # Déclencher alerte
    │       ├── getStreamURL()    # URL streaming HLS
    │       └── getSnapshotURL()  # URL snapshot JPEG
    │
    ├── 📱 views/ - Pages principales
    │   │
    │   ├── LoginView.vue         # 🔐 Connexion
    │   │   ├── Formulaire server/port/username/password
    │   │   ├── "Se souvenir de moi"
    │   │   └── Gestion erreurs
    │   │
    │   ├── LiveView.vue          # 📹 Vue Live
    │   │   ├── Header avec info serveur (CPU/MEM/FPS)
    │   │   ├── Grille caméras responsive
    │   │   ├── Vue unique avec streaming HLS
    │   │   ├── Contrôles PTZ (floating button + overlay)
    │   │   └── Auto-refresh status
    │   │
    │   ├── ClipsView.vue         # 📦 Enregistrements
    │   │   ├── Filtres (Tous/Alertes/Mouvement)
    │   │   ├── Liste avec thumbnails
    │   │   ├── Modal lecteur vidéo
    │   │   ├── Téléchargement
    │   │   └── Suppression
    │   │
    │   ├── TimelineView.vue      # ⏰ Timeline
    │   │   ├── Sélecteur de date
    │   │   ├── Navigation jour précédent/suivant
    │   │   ├── Liste événements
    │   │   └── Graphique canvas 24h
    │   │
    │   └── SettingsView.vue      # ⚙️ Paramètres
    │       ├── Sélection langue (FR/EN)
    │       ├── Thème (Dark/Light/Auto)
    │       ├── Qualité vidéo
    │       ├── Info serveur et compte
    │       └── Déconnexion
    │
    ├── 🧩 components/ - Composants réutilisables
    │   └── [Vide - Prêt pour futurs composants]
    │
    └── 🛠️ utils/ - Utilitaires
        └── [Vide - Prêt pour futurs helpers]
```

---

## 📊 Statistiques

### Fichiers
- **27 fichiers** créés
- **5 vues** Vue.js
- **3 stores** Pinia
- **1 API client**
- **2 langues** complètes
- **5 docs** markdown

### Lignes de code
- **~3500 lignes** au total
- **~800 lignes** Vue components
- **~600 lignes** Stores
- **~300 lignes** API client
- **~400 lignes** CSS
- **~1400 lignes** Documentation

### Dependencies
- **7 runtime** dependencies
- **3 dev** dependencies
- **0 vulnerabilities**

---

## 🎯 Flux de Données

```
┌─────────────────────────────────────────────────┐
│                   User Action                    │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Vue Component (View)                │
│  LoginView / LiveView / ClipsView / etc.        │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│               Pinia Store (State)                │
│  authStore / camerasStore / settingsStore       │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│            API Client (HTTP Calls)               │
│              BlueIrisAPI class                   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│           Blue Iris Server (JSON API)            │
│          /json endpoint + streaming              │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Flux Navigation

```
Login
  │
  ├─ Success ─────────────────┐
  │                           │
  ▼                           ▼
Live (default)              Clips
  │                           │
  ├─ Click camera ──> Single Camera View
  │                    │
  │                    └─ PTZ Controls (if available)
  │
  ├─ Timeline ──────────────> Timeline View
  │                           │
  │                           └─ Select date/event
  │
  └─ Settings ──────────────> Settings View
                              │
                              └─ Logout ──> Login
```

---

## 🎨 Composition des Vues

### LiveView.vue
```
┌──────────────────────────────────────┐
│ Header                                │
│  └─ Server Info (CPU/MEM/FPS)        │
├──────────────────────────────────────┤
│ Camera Grid (2x2 / 3x3)             │
│  ├─ Camera 1 (click → single view)  │
│  ├─ Camera 2                         │
│  ├─ Camera 3                         │
│  └─ Camera 4                         │
│                                       │
│ OR                                    │
│                                       │
│ Single Camera View                   │
│  ├─ [← Back button]                  │
│  ├─ Video Player (HLS)               │
│  └─ PTZ Controls (floating)          │
│      └─ D-Pad + Zoom                 │
└──────────────────────────────────────┘
```

### ClipsView.vue
```
┌──────────────────────────────────────┐
│ Header + Refresh button              │
├──────────────────────────────────────┤
│ Filters: [All] [Alerts] [Motion]    │
├──────────────────────────────────────┤
│ Clip 1                               │
│  ├─ Thumbnail + duration             │
│  ├─ Camera name + date               │
│  └─ [Download] [Delete]              │
├──────────────────────────────────────┤
│ Clip 2                               │
├──────────────────────────────────────┤
│ ...                                  │
└──────────────────────────────────────┘
```

### TimelineView.vue
```
┌──────────────────────────────────────┐
│ Date Picker: [<] 2024-01-15 [>]     │
├──────────────────────────────────────┤
│ Events List                          │
│  ├─ 14:30:45 - Camera 1 - Motion    │
│  ├─ 12:15:20 - Camera 2 - Alert     │
│  └─ ...                              │
├──────────────────────────────────────┤
│ Timeline Graph (Canvas)              │
│  [0h───6h───12h───18h───24h]        │
│   •    ••     •••   •                │
└──────────────────────────────────────┘
```

---

## 🚀 Ordre de Chargement

1. **index.html**
   - Loading screen animé
   - Liens manifest/icons
   
2. **main.js**
   - Création instance Vue
   - Installation plugins (Router, Pinia, i18n)
   - Mount sur #app
   
3. **App.vue**
   - Composant racine
   - Router-view pour pages
   - Bottom navigation
   
4. **Router Guard**
   - Vérifier authentification
   - Rediriger vers Login si nécessaire
   
5. **View Component**
   - Charger selon route
   - Initialiser stores
   - Fetch données API

---

## 🔐 Sécurité

### Authentification
```
1. User entre credentials
2. Store auth appelle login()
3. API client fait POST /json {cmd: "login"}
4. Serveur renvoie session + response
5. Client calcule MD5(username:session:MD5(password))
6. POST /json avec response hash
7. Serveur valide et retourne success
8. Session stockée dans store
9. Toutes requêtes futures incluent session
```

### Protection
- Session tokens
- Pas de stockage password
- HTTPS recommandé
- Guards navigation
- Timeout session

---

## 📦 Build Process

### Development
```bash
npm run dev
→ Vite dev server
→ Hot Module Replacement (HMR)
→ http://localhost:3000
```

### Production
```bash
npm run build
→ Vite build
→ Minification JS/CSS
→ Code splitting
→ Tree shaking
→ Output: dist/
```

### PWA
```bash
Service Worker généré automatiquement
→ Cache assets statiques
→ Offline fallback
→ Auto-update on refresh
```

---

## 🎓 Points d'Extension

### Ajouter une langue
1. Créer `src/i18n/[lang].js`
2. Importer dans `src/i18n/index.js`
3. Done!

### Ajouter une vue
1. Créer `src/views/NewView.vue`
2. Ajouter route dans `src/router/index.js`
3. Ajouter navigation dans `App.vue`

### Ajouter un store
1. Créer `src/stores/newStore.js`
2. Définir state/getters/actions
3. Utiliser avec `useNewStore()`

### Ajouter une fonctionnalité API
1. Ajouter méthode dans `src/api/client.js`
2. Appeler depuis store ou composant
3. Gérer loading/error states

---

Cette structure garantit:
✅ **Maintenabilité** - Code organisé et clair  
✅ **Scalabilité** - Facile à étendre  
✅ **Performance** - Lazy loading et optimisations  
✅ **Testabilité** - Séparation des responsabilités  
