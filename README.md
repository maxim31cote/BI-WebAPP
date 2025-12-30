# Blue Iris Mobile PWA

Application web progressive (PWA) pour l'accès mobile à Blue Iris, conçue avec une interface moderne et intuitive.

## 🌟 Caractéristiques

### ✅ Implémenté
- 🔐 **Authentification sécurisée** avec MD5 challenge-response
- 📹 **Vue en direct** avec grille de caméras responsive
- 🎥 **Lecteur vidéo** HLS avec qualité ajustable
- 🕹️ **Contrôles PTZ** avec overlay transparent
- 📊 **Info serveur** en temps réel (CPU, Mémoire, FPS)
- 📦 **Enregistrements** avec lecture, téléchargement
- ⏰ **Timeline** graphique avec événements
- ⚙️ **Paramètres** personnalisables
- 🌐 **Multi-langue** (Français, English) avec détection automatique
- 🎨 **Thèmes** Dark/Light/Auto
- 📱 **PWA** installable sur iOS/Android
- 💾 **Mode hors ligne** avec service worker

### 📋 Technologies

- **Vue 3.4** - Framework réactif moderne
- **Vite 5.0** - Build tool ultra-rapide
- **Vue Router 4.2** - Navigation SPA
- **Pinia 2.1** - State management
- **Vue-i18n 9.8** - Internationalisation
- **Axios 1.6** - Client HTTP
- **HLS.js 1.5** - Streaming H.264
- **Vite-plugin-PWA** - Capacités PWA

## 🚀 Installation

```bash
cd mobile-app
npm install
```

## 📦 Développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 🏗️ Build Production

```bash
npm run build
npm run preview
```

## 📱 Installation PWA

### iOS (Safari)
1. Ouvrir l'app dans Safari
2. Appuyer sur le bouton "Partager"
3. Sélectionner "Sur l'écran d'accueil"
4. Confirmer

### Android (Chrome)
1. Ouvrir l'app dans Chrome
2. Appuyer sur le menu (⋮)
3. Sélectionner "Installer l'application"
4. Confirmer

## 🎨 Structure du Projet

```
mobile-app/
├── public/               # Fichiers statiques
├── src/
│   ├── api/             # Client API Blue Iris
│   │   └── client.js    # BlueIrisAPI class
│   ├── components/      # Composants réutilisables
│   ├── i18n/           # Traductions
│   │   ├── en.js       # English
│   │   ├── fr.js       # Français
│   │   └── index.js    # Configuration i18n
│   ├── router/         # Configuration routes
│   │   └── index.js
│   ├── stores/         # State management Pinia
│   │   ├── auth.js     # Authentification
│   │   ├── cameras.js  # Caméras et PTZ
│   │   └── settings.js # Paramètres utilisateur
│   ├── views/          # Pages principales
│   │   ├── LoginView.vue
│   │   ├── LiveView.vue
│   │   ├── ClipsView.vue
│   │   ├── TimelineView.vue
│   │   └── SettingsView.vue
│   ├── App.vue         # Composant racine
│   ├── main.js         # Point d'entrée
│   └── style.css       # Styles globaux
├── index.html          # Template HTML
├── package.json        # Dépendances
└── vite.config.js      # Configuration Vite
```

## 🔌 API Blue Iris

L'application utilise l'API JSON de Blue Iris (`/json`).

### Endpoints utilisés:
- `login` - Authentification
- `camlist` - Liste des caméras
- `status` - Statut du serveur
- `cliplist` - Liste des enregistrements
- `ptz` - Contrôles PTZ
- `trigger` - Déclencher une caméra

### Streaming:
- **HLS**: `/h264/[camera]/temp.m3u8`
- **JPEG**: `/image/[camera]`

Voir [BLUE_IRIS_API_DOCUMENTATION.md](../BLUE_IRIS_API_DOCUMENTATION.md) pour plus de détails.

## 🌐 Internationalisation

Ajouter une nouvelle langue:

1. Créer `src/i18n/[lang].js`:
```javascript
export default {
  nav: {
    live: 'Your translation',
    // ...
  }
};
```

2. Importer dans `src/i18n/index.js`:
```javascript
import newLang from './newLang';

const i18n = createI18n({
  messages: {
    en,
    fr,
    newLang  // Ajouter ici
  }
});
```

## 🎨 Personnalisation

### Thème
Modifier les variables CSS dans `src/style.css`:

```css
:root {
  --color-background: #1a1a2e;
  --color-accent: #16c79a;
  /* ... */
}
```

### Logo/Icônes
Remplacer les fichiers dans `public/`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

## 📝 Configuration

### Serveur Blue Iris
Par défaut, l'app se connecte sur le port 81.

Pour changer:
1. Ouvrir Blue Iris
2. Settings > Web server
3. Modifier le port
4. Activer "Authentication" et "HTTPS" (recommandé)

### Qualité vidéo
Trois niveaux disponibles:
- **Low** (1%) - Pour connexions lentes
- **Medium** (5%) - Équilibre qualité/bande passante
- **High** (100%) - Qualité maximale

## 🔒 Sécurité

- ✅ Authentification MD5 challenge-response
- ✅ Session tokens pour toutes les requêtes
- ⚠️ Utiliser HTTPS en production
- ⚠️ Ne jamais commiter les credentials

## 🐛 Dépannage

### Connexion refuse
- Vérifier que Blue Iris est démarré
- Vérifier l'adresse IP et le port
- Vérifier le firewall

### Vidéo ne charge pas
- Vérifier que H.264 est activé dans Blue Iris
- Vérifier la qualité sélectionnée
- Tester avec JPEG snapshot d'abord

### PWA ne s'installe pas
- Vérifier que HTTPS est actif
- Vérifier manifest.json
- Vider le cache du navigateur

## 📄 License

MIT License - Voir LICENSE

## 🤝 Contribution

Les contributions sont les bienvenues! 

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📧 Support

Pour toute question ou problème, ouvrir une issue sur GitHub.

## 🎯 Roadmap

- [ ] Notifications push pour alertes
- [ ] Mode Picture-in-Picture
- [ ] Enregistrement vidéo manuel
- [ ] Snapshots avec partage
- [ ] Gestion des profils Blue Iris
- [ ] Support Bluetooth pour accessoires
- [ ] Mode plein écran paysage optimisé
- [ ] Gestures tactiles (pinch-to-zoom)
- [ ] Historique de navigation
- [ ] Favoris/raccourcis caméras
