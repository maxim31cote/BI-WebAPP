import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement
  const env = loadEnv(mode, process.cwd(), '');
  const blueIrisServer = env.VITE_BLUEIRIS_SERVER || 'http://localhost:81';
  
  console.log('🔧 Blue Iris Server:', blueIrisServer);
  
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Blue Iris Mobile',
          short_name: 'BI Mobile',
          description: 'Application mobile pour Blue Iris',
          theme_color: '#1a1a2e',
          background_color: '#0f0f1e',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true
        }
      })
    ],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: blueIrisServer,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Origin', blueIrisServer);
            });
          },
          // Timeout plus long pour les streams
          timeout: 60000
        },
        '/h264': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 60000
        },
        '/video': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 60000,
          selfHandleResponse: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('🎬 Proxying video request:', req.url);
              
              // Extraire la session de l'URL
              const sessionMatch = req.url.match(/[?&]session=([^&]+)/);
              if (sessionMatch) {
                const session = sessionMatch[1];
                // Ajouter le cookie de session comme Blue Iris l'attend
                proxyReq.setHeader('Cookie', `session=${session}`);
                console.log('🍪 Added session cookie:', session);
              }
              
              proxyReq.setHeader('Origin', blueIrisServer);
              proxyReq.setHeader('Referer', `${blueIrisServer}/ui3.htm`);
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('📹 Video response:', proxyRes.statusCode, proxyRes.headers['content-type']);
              
              // Copier les headers
              Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
              });
              
              res.writeHead(proxyRes.statusCode);
              
              // **NE PAS RETIRER** les wrappers "blue"/"Blue"
              // Le BlueIrisParser va les gérer côté client
              proxyRes.pipe(res);
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('❌ Proxy error:', err.message);
            });
          }
        },
        '/image': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 30000
        },
        '/file': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 30000
        },
        '/thumbs': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 30000
        },
        '/alerts': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 30000
        }
      }
    }
  };
});
