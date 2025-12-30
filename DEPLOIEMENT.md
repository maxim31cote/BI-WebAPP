# 🌐 Déploiement - Blue Iris Mobile PWA

## ✅ Application Indépendante

Cette application est **complètement autonome** et **ne nécessite PAS** d'être dans le dossier www de Blue Iris !

### Comment ça fonctionne

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   Application Mobile    │         │   Serveur Blue Iris     │
│   (N'importe où)       │  HTTP   │   (192.168.1.100:81)   │
│                         │ ──────> │                         │
│  - Netlify             │  JSON   │  - API /json            │
│  - Votre serveur       │  API    │  - Streaming /h264      │
│  - GitHub Pages        │ <────── │  - Images /image        │
│  - localhost:3000      │         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

L'application se connecte au serveur Blue Iris via:
- API JSON (`http://ip-blueiris:81/json`)
- Streaming vidéo (`http://ip-blueiris:81/h264/camera/temp.m3u8`)
- Snapshots (`http://ip-blueiris:81/image/camera`)

---

## 🚀 Méthodes de Déploiement

### Option 1️⃣ : Services Cloud (Plus Facile)

#### Netlify (Gratuit, HTTPS automatique)
```bash
cd mobile-app

# Build
npm run build

# Déployer
npx netlify-cli deploy --prod --dir=dist
```

**Avantages:**
- ✅ Gratuit
- ✅ HTTPS automatique
- ✅ CDN mondial
- ✅ Mise à jour facile
- ✅ Aucun serveur à gérer

**URL exemple:** `https://blueiris-mobile.netlify.app`

#### Vercel (Gratuit, HTTPS automatique)
```bash
cd mobile-app

# Déployer
npx vercel --prod
```

**URL exemple:** `https://blueiris-mobile.vercel.app`

#### GitHub Pages (Gratuit)
```bash
cd mobile-app

# Build
npm run build

# Déployer
npx gh-pages -d dist
```

**URL exemple:** `https://username.github.io/blueiris-mobile`

---

### Option 2️⃣ : Votre Propre Serveur

#### Nginx (Recommandé)

1. **Build l'application**
```bash
cd mobile-app
npm run build
# Fichiers générés dans dist/
```

2. **Copier sur le serveur**
```bash
# Créer le dossier
sudo mkdir -p /var/www/blueiris-mobile

# Copier les fichiers
sudo cp -r dist/* /var/www/blueiris-mobile/
```

3. **Configuration Nginx**
```bash
sudo nano /etc/nginx/sites-available/blueiris-mobile
```

```nginx
server {
    listen 80;
    server_name blueiris.example.com;  # Votre domaine
    
    root /var/www/blueiris-mobile;
    index index.html;
    
    # Support SPA (Single Page Application)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache des assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Compression gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

4. **Activer et redémarrer**
```bash
sudo ln -s /etc/nginx/sites-available/blueiris-mobile /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**URL:** `http://votre-serveur` ou `http://192.168.1.50`

#### Apache

1. **Build et copier**
```bash
cd mobile-app
npm run build
sudo cp -r dist/* /var/www/html/blueiris-mobile/
```

2. **Configuration Apache**
```bash
sudo nano /etc/apache2/sites-available/blueiris-mobile.conf
```

```apache
<VirtualHost *:80>
    ServerName blueiris.example.com
    DocumentRoot /var/www/html/blueiris-mobile
    
    <Directory /var/www/html/blueiris-mobile>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Support SPA
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

3. **Activer**
```bash
sudo a2ensite blueiris-mobile
sudo a2enmod rewrite
sudo systemctl reload apache2
```

---

### Option 3️⃣ : Docker (Portable)

1. **Créer Dockerfile**
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

2. **Créer nginx.conf**
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

3. **Build et run**
```bash
docker build -t blueiris-mobile .
docker run -d -p 8080:80 blueiris-mobile
```

**URL:** `http://localhost:8080`

---

### Option 4️⃣ : Développement Local

Pour tester uniquement:
```bash
cd mobile-app
npm run dev
```

**URL:** `http://localhost:3000`

⚠️ **Ne pas utiliser en production** (pas optimisé, pas sécurisé)

---

## 🔒 Configuration HTTPS (Recommandé)

### Pourquoi HTTPS ?
- ✅ Requis pour PWA sur iOS
- ✅ Sécurise les données
- ✅ Améliore le SEO
- ✅ Évite avertissements navigateur

### Let's Encrypt (Gratuit)

#### Avec Nginx
```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir certificat
sudo certbot --nginx -d blueiris.example.com

# Renouvellement auto
sudo certbot renew --dry-run
```

#### Avec Apache
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d blueiris.example.com
```

### Cloudflare (Gratuit + CDN)

1. Pointer votre domaine vers Cloudflare
2. Activer proxy (nuage orange)
3. SSL/TLS automatique
4. Bonus: CDN gratuit, protection DDoS

---

## ⚠️ Problème CORS (Cross-Origin)

Si l'application et Blue Iris sont sur des domaines différents, vous pourriez avoir une erreur CORS.

### Symptômes
```
Access to XMLHttpRequest at 'http://192.168.1.100:81/json' 
from origin 'https://blueiris-mobile.netlify.app' has been 
blocked by CORS policy
```

### Solutions

#### Solution 1: Proxy Nginx (Recommandé)

Au lieu de connecter directement à Blue Iris, passer par un proxy:

```nginx
server {
    listen 80;
    server_name blueiris-mobile.example.com;
    
    # Servir l'application
    location / {
        root /var/www/blueiris-mobile;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy vers Blue Iris
    location /api/ {
        proxy_pass http://192.168.1.100:81/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Désactiver buffering pour streaming
        proxy_buffering off;
    }
}
```

Ensuite, dans l'app, connecter à `/api/` au lieu de `http://192.168.1.100:81/`

#### Solution 2: Configurer CORS sur Blue Iris

Blue Iris ne supporte pas nativement CORS. Il faudrait:
1. Un proxy devant Blue Iris
2. Ou utiliser une extension navigateur (dev seulement)

#### Solution 3: Même domaine

Déployer l'app sur le même serveur que Blue Iris:
- Blue Iris: `http://blueiris.example.com:81`
- App: `http://blueiris.example.com:80`

Pas de problème CORS car même domaine (ports différents OK).

---

## 📱 Configuration dans l'Application

Quand vous ouvrez l'app la première fois:

```
┌─────────────────────────────────┐
│     🔐 Connexion                │
├─────────────────────────────────┤
│                                 │
│  Serveur: 192.168.1.100        │
│  Port: 81                       │
│  Username: admin                │
│  Password: ********             │
│  ☑ Se souvenir de moi          │
│                                 │
│     [Se connecter]              │
└─────────────────────────────────┘
```

**Exemples de configuration:**

### Réseau Local
```
Serveur: 192.168.1.100
Port: 81
```

### Domaine Public
```
Serveur: blueiris.example.com
Port: 81
```

### HTTPS
```
Serveur: blueiris.example.com
Port: 443
```

### Sous-domaine
```
Serveur: cameras.example.com
Port: 443
```

---

## 🎯 Recommandations par Scénario

### Usage Maison (LAN uniquement)
```
✅ Déployer sur serveur local (Nginx/Apache)
✅ HTTP OK (pas besoin HTTPS)
✅ IP locale: 192.168.x.x
✅ Ou cloud public + VPN
```

### Usage à Distance (Internet)
```
✅ Cloud (Netlify/Vercel) pour l'app
✅ HTTPS obligatoire pour PWA
✅ VPN pour accès Blue Iris
✅ Ou port forwarding + DynDNS
```

### Usage Mixte
```
✅ Cloud pour l'app (HTTPS gratuit)
✅ Cloudflare Tunnel pour Blue Iris
✅ Pas de port forwarding nécessaire
✅ Sécurité maximale
```

---

## 🔐 Sécurité Accès à Distance

### Option 1: VPN (Plus Sécurisé)
```bash
# Installer WireGuard
sudo apt install wireguard

# Configurer VPN
# Connecter au VPN avant d'utiliser l'app
# Blue Iris reste sur réseau local
```

**Avantages:**
- ✅ Blue Iris pas exposé sur Internet
- ✅ Chiffrement bout en bout
- ✅ Pas de port forwarding

### Option 2: Cloudflare Tunnel (Facile)
```bash
# Installer cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Créer tunnel
cloudflared tunnel create blueiris
cloudflared tunnel route dns blueiris blueiris.example.com

# Configurer
cat > ~/.cloudflared/config.yml << EOF
url: http://localhost:81
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json
EOF

# Démarrer
cloudflared tunnel run blueiris
```

**Avantages:**
- ✅ Pas de port forwarding
- ✅ HTTPS gratuit
- ✅ Protection DDoS Cloudflare

### Option 3: Port Forwarding + Auth (Basique)
```
Router: Forward port 81 → 192.168.1.100:81
Blue Iris: Authentification obligatoire
DynDNS: myhome.dyndns.org
App: Se connecter à myhome.dyndns.org:81
```

⚠️ **Moins sécurisé** - Utilisez mots de passe forts!

---

## 📋 Checklist Déploiement

### Avant de commencer
- [ ] Node.js installé
- [ ] Application build (`npm run build`)
- [ ] Serveur web ou compte cloud
- [ ] Blue Iris configuré et accessible

### Déploiement
- [ ] Fichiers copiés/déployés
- [ ] Configuration serveur web OK
- [ ] HTTPS configuré (si public)
- [ ] DNS configuré (si domaine)

### Test
- [ ] Ouvrir l'app dans navigateur
- [ ] Se connecter avec credentials Blue Iris
- [ ] Vérifier vue caméras
- [ ] Tester PTZ (si disponible)
- [ ] Vérifier clips et timeline

### Production
- [ ] HTTPS actif
- [ ] Certificat SSL valide
- [ ] PWA installable (test iOS/Android)
- [ ] Performance OK (Lighthouse)
- [ ] Logs et monitoring activés

---

## 🎓 Résumé

### ✅ OUI - L'app est indépendante
- Déployez où vous voulez
- Netlify, Vercel, votre serveur, GitHub Pages
- Se connecte à Blue Iris par HTTP/HTTPS
- Entrez l'IP au moment de la connexion

### ❌ NON - Pas besoin du dossier www Blue Iris
- L'app n'est pas une extension de Blue Iris
- C'est une application web séparée
- Communication via API JSON uniquement

### 🌐 Architecture
```
[Votre App sur Netlify] ←─HTTP API─→ [Blue Iris sur LAN]
       https://mon-app.netlify.app         192.168.1.100:81
```

---

## 🚀 Démarrage Rapide

**Pour tester rapidement:**
```bash
# 1. Build
cd mobile-app
npm run build

# 2. Déployer sur Netlify (gratuit)
npx netlify-cli deploy --prod --dir=dist

# 3. Ouvrir l'URL donnée
# 4. Entrer IP de votre Blue Iris
# 5. Done!
```

**Coût:** Gratuit avec Netlify/Vercel !
**Temps:** 5 minutes
**Difficulté:** Facile

---

## 📞 Support

Des questions sur le déploiement ?
- Voir INSTALLATION.md pour détails serveur
- Voir README.md pour utilisation
- Tester d'abord en local (`npm run dev`)
