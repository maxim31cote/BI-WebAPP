# Guide d'Installation - Blue Iris Mobile PWA

## Prérequis

### 1. Installer Node.js et NPM

#### Linux (Debian/Ubuntu)
```bash
# Installation de Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier l'installation
node --version  # Devrait afficher v20.x.x
npm --version   # Devrait afficher 10.x.x
```

#### macOS
```bash
# Avec Homebrew
brew install node

# Ou télécharger depuis https://nodejs.org/
```

#### Windows
```bash
# Télécharger l'installeur depuis https://nodejs.org/
# Ou avec Chocolatey:
choco install nodejs
```

## Installation de l'Application

### 1. Naviguer vers le dossier
```bash
cd /home/kasm-user/VS-Code/ui3/mobile-app
```

### 2. Installer les dépendances
```bash
npm install
```

Cette commande va installer:
- Vue 3.4.21
- Vue Router 4.2.5
- Pinia 2.1.7
- Vue-i18n 9.8.0
- Axios 1.6.5
- HLS.js 1.5.0
- MD5 2.3.0
- Vite 5.0.11
- @vitejs/plugin-vue 5.0.3
- vite-plugin-pwa 0.17.4

### 3. Lancer en mode développement
```bash
npm run dev
```

L'application sera accessible sur **http://localhost:3000**

### 4. Build pour production
```bash
npm run build
```

Les fichiers optimisés seront dans le dossier `dist/`

### 5. Prévisualiser le build
```bash
npm run preview
```

## Configuration du Serveur Blue Iris

### 1. Activer le serveur web
1. Ouvrir Blue Iris
2. Menu > Settings (ou F2)
3. Onglet **Web server**
4. Cocher **"Enable web server"**
5. Port par défaut: **81** (ou personnalisé)

### 2. Configurer l'authentification
1. Dans Web server settings
2. Cocher **"Use secure session keys and login page"**
3. Cocher **"Non-LAN only"** (pour sécurité externe)
4. Créer un utilisateur:
   - Username: ex. "admin"
   - Password: choisir un mot de passe fort
   - Cocher **"Admin"** pour accès complet

### 3. Activer H.264 streaming
1. Pour chaque caméra:
   - Clic droit > Camera properties
   - Onglet **"Video"**
   - Activer **"Enable H.264/HEVC streaming"**
2. Ou globalement:
   - Settings > Cameras > onglet "Video"
   - Cocher "Enable H.264 streaming"

### 4. Configurer HTTPS (Recommandé)
1. Web server settings
2. Cocher **"Use secure HTTPS connections"**
3. Port HTTPS: **443** (ou personnalisé)
4. Installer un certificat SSL:
   - Let's Encrypt (gratuit)
   - Auto-signé (dev seulement)
   - Commercial (production)

### 5. Ouvrir le firewall
```bash
# Windows Firewall
# Ajouter une règle entrante pour le port 81 (HTTP) et 443 (HTTPS)

# Linux (UFW)
sudo ufw allow 81/tcp
sudo ufw allow 443/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 81 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 6. Trouver l'adresse IP du serveur

#### Windows
```cmd
ipconfig
```
Chercher "IPv4 Address"

#### Linux/macOS
```bash
ip addr show  # ou ifconfig
```

Exemple d'adresse: **192.168.1.100**

## Première Connexion

### 1. Ouvrir l'application
```
http://localhost:3000
```

### 2. Écran de connexion
Entrer:
- **Server**: 192.168.1.100 (IP de votre serveur Blue Iris)
- **Port**: 81 (ou votre port personnalisé)
- **Username**: admin (ou votre utilisateur)
- **Password**: votre mot de passe
- Cocher **"Se souvenir de moi"** pour sauvegarder

### 3. Navigation
- **Live**: Voir toutes les caméras en grille
- **Clips**: Consulter les enregistrements
- **Timeline**: Vue chronologique des événements
- **Settings**: Paramètres de l'application

## Déploiement Production

### Option 1: Serveur Web statique (Recommandé)

#### Avec Nginx
```bash
# Build de l'app
npm run build

# Copier les fichiers
sudo cp -r dist/* /var/www/blueiris/

# Configuration Nginx
sudo nano /etc/nginx/sites-available/blueiris
```

```nginx
server {
    listen 80;
    server_name blueiris.example.com;
    root /var/www/blueiris;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache des assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/blueiris /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Avec Apache
```bash
# Build de l'app
npm run build

# Copier les fichiers
sudo cp -r dist/* /var/www/html/blueiris/

# Configuration Apache
sudo nano /etc/apache2/sites-available/blueiris.conf
```

```apache
<VirtualHost *:80>
    ServerName blueiris.example.com
    DocumentRoot /var/www/html/blueiris

    <Directory /var/www/html/blueiris>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Réécriture pour SPA
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

```bash
# Activer
sudo a2ensite blueiris
sudo a2enmod rewrite
sudo systemctl reload apache2
```

### Option 2: Docker

Créer `Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Créer `nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Build et run
docker build -t blueiris-mobile .
docker run -d -p 8080:80 blueiris-mobile
```

### Option 3: Services Cloud

#### Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

#### GitHub Pages
```bash
# Ajouter dans package.json:
"homepage": "https://username.github.io/blueiris-mobile",

# Build et deploy
npm run build
npm install -g gh-pages
gh-pages -d dist
```

## HTTPS avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir certificat
sudo certbot --nginx -d blueiris.example.com

# Renouvellement auto
sudo certbot renew --dry-run
```

## Troubleshooting

### Erreur "npm: command not found"
```bash
# Installer Node.js (voir section Prérequis)
```

### Erreur de connexion au serveur
```bash
# Vérifier que Blue Iris est démarré
# Vérifier l'IP et le port
# Tester avec curl:
curl http://192.168.1.100:81/json -d '{"cmd":"login"}'
```

### Port 3000 déjà utilisé
```bash
# Changer le port dans vite.config.js:
server: {
  port: 3001
}
```

### Build échoue
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm run build
```

### PWA ne s'installe pas
- Utiliser HTTPS en production
- Vérifier que les icônes existent dans `/public`
- Vider le cache du navigateur
- Vérifier la console pour erreurs

## Performance

### Optimisations
1. **Activer la compression gzip** (nginx/apache)
2. **Mettre en cache** les assets statiques
3. **Utiliser un CDN** pour les fichiers statiques
4. **Lazy loading** des routes (déjà implémenté)
5. **Minification** automatique avec Vite

### Monitoring
```bash
# Analyser le bundle
npm run build -- --mode analyze
```

## Sécurité

### Checklist Production
- [ ] Utiliser HTTPS uniquement
- [ ] Configurer CORS correctement
- [ ] Activer authentification Blue Iris
- [ ] Utiliser mots de passe forts
- [ ] Limiter accès par IP (optionnel)
- [ ] Activer rate limiting
- [ ] Logs d'accès activés
- [ ] Mises à jour régulières

### Headers de sécurité (nginx)
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## Support

Pour toute question:
1. Consulter la documentation Blue Iris officielle
2. Vérifier les issues GitHub
3. Consulter les logs:
   - Blue Iris: `Help > Support info > Logs`
   - Application: Console navigateur (F12)
