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
      allowedHosts: ['bi.mxmk.cc', 'localhost'],
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
          timeout: 0, // Pas de timeout pour les streams
          selfHandleResponse: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('🎬 Proxying video request:', req.url);
              
              // Désactiver le timeout de Node.js
              req.socket.setTimeout(0);
              res.socket?.setTimeout(0);
              
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
              
              // CORS headers pour permettre l'accès depuis le client
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('Access-Control-Expose-Headers', 'x-camlist, x-reclist, Content-Type');
              
              // Copier les headers de Blue Iris
              Object.keys(proxyRes.headers).forEach(key => {
                if (key.toLowerCase() !== 'access-control-allow-origin') {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              
              res.writeHead(proxyRes.statusCode);
              
              // Pour les streams vidéo MJPEG, retirer les wrappers Blue Iris
              if (proxyRes.headers['content-type'] === 'video/mpeg') {
                let buffer = Buffer.alloc(0);
                let headerRemoved = false;
                
                proxyRes.on('data', (chunk) => {
                  buffer = Buffer.concat([buffer, chunk]);
                  
                  // Retirer le wrapper "blue((" ou "Blue((" du début
                  if (!headerRemoved) {
                    const bufferStr = buffer.toString('binary', 0, Math.min(10, buffer.length));
                    if (bufferStr.startsWith('blue((') || bufferStr.startsWith('Blue((')) {
                      buffer = buffer.slice(6); // Retirer "blue((" ou "Blue(("
                      console.log('🔧 Removed Blue Iris wrapper from video stream');
                      headerRemoved = true;
                    } else if (bufferStr.startsWith('blue(') || bufferStr.startsWith('Blue(')) {
                      buffer = buffer.slice(5); // Retirer "blue(" ou "Blue("
                      console.log('🔧 Removed Blue Iris wrapper from video stream');
                      headerRemoved = true;
                    }
                  }
                  
                  // Envoyer les données nettoyées
                  if (buffer.length > 0) {
                    res.write(buffer);
                    buffer = Buffer.alloc(0);
                  }
                });
                
                proxyRes.on('end', () => {
                  res.end();
                });
              } else {
                // Pour les autres types de contenu, passer tel quel
                proxyRes.pipe(res);
              }
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('❌ Proxy error:', err.message);
            });
          }
        },
        '/time': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 0, // Pas de timeout pour les streams
          selfHandleResponse: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('🎬 Proxying time/historical request:', req.url);
              
              // Désactiver le timeout de Node.js
              req.socket.setTimeout(0);
              res.socket?.setTimeout(0);
              
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
              console.log('📹 Time response:', proxyRes.statusCode, proxyRes.headers['content-type']);
              
              // CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('Access-Control-Expose-Headers', 'x-camlist, x-reclist, Content-Type');
              
              // Copier les headers de Blue Iris
              Object.keys(proxyRes.headers).forEach(key => {
                if (key.toLowerCase() !== 'access-control-allow-origin') {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              
              res.writeHead(proxyRes.statusCode);
              
              // Pour les streams vidéo, passer tel quel (le format "blue" est géré par le parser)
              proxyRes.pipe(res);
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('❌ Proxy time error:', err.message);
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
    },
    preview: {
      port: 4173,
      host: true,
      allowedHosts: ['bi.mxmk.cc', 'localhost'],
      proxy: {
        '/api': {
          target: blueIrisServer,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
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
          timeout: 60000
        },
        '/time': {
          target: blueIrisServer,
          changeOrigin: true,
          timeout: 0
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
