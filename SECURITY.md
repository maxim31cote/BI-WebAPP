# 🔒 Sécurité et Configuration

## Configuration du serveur Blue Iris

### Pour le développement local

1. **Créez un fichier `.env.local`** (déjà ignoré par Git) :
```bash
VITE_BLUEIRIS_SERVER=http://VOTRE_IP:81
```

2. **Démarrez le serveur de développement** :
```bash
npm run dev
```

Le fichier `.env.local` ne sera **JAMAIS** commité sur Git (déjà dans `.gitignore`).

### Pour la production

Définissez la variable d'environnement `VITE_BLUEIRIS_SERVER` sur votre plateforme de déploiement :
- Vercel : Settings → Environment Variables
- Netlify : Site settings → Environment variables
- Docker : `-e VITE_BLUEIRIS_SERVER=http://...`
- Linux : `export VITE_BLUEIRIS_SERVER=http://...`

## ⚠️ Important : Limitation technique

L'IP du serveur Blue Iris ne peut **PAS** être configurée depuis la page de login car :
- `vite.config.js` configure le proxy au **démarrage** du serveur de développement
- La page de login s'exécute **après** que le proxy soit déjà configuré
- Le proxy Vite est côté serveur, pas côté client

### Solutions alternatives

1. **Développement** : Utilisez `.env.local` (recommandé)
2. **Multi-environnements** : Créez `.env.development`, `.env.production`
3. **Future évolution** : Créer un backend Node.js qui gère le proxy dynamiquement

## Fichiers à NE JAMAIS committer

- ❌ `.env.local` - Contient votre IP locale
- ❌ `test_*.py`, `test_*.js` - Scripts de test avec identifiants
- ❌ Tout fichier contenant des mots de passe ou IPs privées

## Fichiers sûrs à committer

- ✅ `.env.example` - Template sans données sensibles
- ✅ `vite.config.js` - Maintenant utilise des variables d'environnement
- ✅ `vite.config.example.js` - Documentation
- ✅ `src/` - Code source de l'application
- ✅ `package.json` - Dépendances
- ✅ `.gitignore` - Configuration Git

## Configuration initiale

```bash
# 1. Copier le fichier d'exemple
cp .env.example .env.local

# 2. Éditer avec votre IP
nano .env.local
# VITE_BLUEIRIS_SERVER=http://VOTRE_IP:81

# 3. Installer et démarrer
npm install
npm run dev
```

## Vérification avant commit

```bash
# Vérifier qu'aucune donnée sensible n'est présente
git diff
git status

# Les fichiers modifiés ne doivent PAS contenir :
# - Adresses IP privées (10.x.x.x, 192.168.x.x)
# - Mots de passe
# - Noms d'utilisateur réels
```
