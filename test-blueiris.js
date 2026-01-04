#!/usr/bin/env node

/**
 * Script de test pour se connecter à Blue Iris et analyser les caméras
 * Usage: node test-blueiris.js <username> <password>
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const BLUEIRIS_SERVER = 'http://10.50.0.110:81';

// Credentials par défaut (à remplacer)
const USERNAME = process.argv[2] || 'admin';
const PASSWORD = process.argv[3] || '';

if (!PASSWORD) {
  console.error('❌ Usage: node test-blueiris.js <username> <password>');
  process.exit(1);
}

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BLUEIRIS_SERVER);
    const postData = JSON.stringify(data);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error('Invalid JSON: ' + body));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function login() {
  console.log('🔑 Connexion à Blue Iris...');
  
  // Étape 1: Obtenir la session
  const sessionRes = await makeRequest('/json', { cmd: 'login' });
  
  if (!sessionRes.session) {
    throw new Error('Pas de session reçue');
  }
  
  const session = sessionRes.session;
  const response = sessionRes.response || '';
  const salt = response || session;
  
  console.log('📋 Session:', session);
  
  // Étape 2: Authentification avec hash MD5
  const hash = crypto.createHash('md5')
    .update(`${USERNAME}:${salt}:${PASSWORD}`)
    .digest('hex');
  
  const authRes = await makeRequest('/json', {
    cmd: 'login',
    session: session,
    response: hash
  });
  
  if (authRes.result !== 'success') {
    throw new Error('Authentification échouée: ' + JSON.stringify(authRes));
  }
  
  console.log('✅ Authentification réussie!\n');
  return { session, data: authRes.data };
}

async function getCameras(session) {
  console.log('📹 Récupération de la liste des caméras...\n');
  
  const res = await makeRequest('/json', {
    cmd: 'camlist',
    session: session
  });
  
  if (res.result !== 'success') {
    throw new Error('Échec de récupération des caméras');
  }
  
  return res.data;
}

async function getCameraConfig(session, camera) {
  const res = await makeRequest('/json', {
    cmd: 'camconfig',
    camera: camera,
    session: session
  });
  
  return res;
}

async function getStatus(session) {
  console.log('📊 Récupération du statut du serveur...\n');
  
  const res = await makeRequest('/json', {
    cmd: 'status',
    session: session
  });
  
  if (res.result !== 'success') {
    throw new Error('Échec de récupération du statut');
  }
  
  return res.data;
}

function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(2) + ' GB';
}

function formatPercent(value) {
  return value + '%';
}

async function main() {
  try {
    // Connexion
    const { session, data: loginData } = await login();
    
    console.log('👤 Utilisateur:', loginData.admin ? 'Admin' : 'Utilisateur');
    console.log('━'.repeat(80) + '\n');
    
    // Statut du serveur
    const status = await getStatus(session);
    console.log('🖥️  STATUT DU SERVEUR');
    console.log('━'.repeat(80));
    console.log('CPU:', formatPercent(status.cpu));
    console.log('GPU:', formatPercent(status.gpu));
    console.log('RAM:', formatBytes(parseInt(status.ram)));
    console.log('Disque:', formatBytes(parseInt(status.disk)));
    console.log('Connexions:', status.cxns);
    console.log('Signal:', status.signal === '1' ? '✅ Connecté' : '❌ Déconnecté');
    console.log('Profil actif:', status.profile);
    console.log('Enregistrement actif:', status.recording === 'true' ? '🔴 OUI' : '⚪ NON');
    console.log('Alertes actives:', status.alerts === 'true' ? '🔔 OUI' : '🔕 NON');
    console.log('━'.repeat(80) + '\n');
    
    // Liste des caméras
    const cameras = await getCameras(session);
    
    console.log('📹 CAMÉRAS (' + cameras.length + ' total)');
    console.log('━'.repeat(80));
    
    for (const cam of cameras) {
      console.log(`\n🎥 ${cam.optionDisplay || cam.optionValue}`);
      console.log('   ID: ' + cam.optionValue);
      console.log('   Nom d\'affichage: ' + cam.optionDisplay);
      console.log('   Active:', cam.isEnabled ? '✅ OUI' : '❌ NON');
      console.log('   En alerte:', cam.isAlerting ? '🔴 OUI' : '⚪ NON');
      console.log('   Enregistrement:', cam.isRecording ? '🔴 OUI' : '⚪ NON');
      console.log('   Pause:', cam.isPaused ? '⏸️  OUI' : '▶️  NON');
      console.log('   Signal:', cam.isNoSignal ? '❌ Pas de signal' : '✅ Signal OK');
      console.log('   FPS:', cam.FPS || 'N/A');
      console.log('   Bande passante (kbit/s):', cam.nKBitsPerSecRecv || 'N/A');
      
      if (cam.audio) {
        console.log('   🔊 Audio: Supporté');
      }
      
      if (cam.ptz) {
        console.log('   🎮 PTZ: Supporté');
      }
      
      // Récupérer la configuration détaillée
      try {
        const config = await getCameraConfig(session, cam.optionValue);
        if (config.result === 'success' && config.data) {
          const cfg = config.data;
          console.log('   📡 Type:', cfg.type || 'N/A');
          console.log('   🌐 IP:', cfg.ip || 'N/A');
          console.log('   🔗 URL:', cfg.path ? cfg.path.substring(0, 60) + '...' : 'N/A');
          
          if (cfg.audio_enabled) {
            console.log('   🔊 Audio configuré: OUI');
            console.log('      Codec audio:', cfg.audio_codec || 'Auto');
          }
        }
      } catch (e) {
        console.log('   ⚠️  Configuration détaillée non disponible');
      }
    }
    
    console.log('\n' + '━'.repeat(80));
    console.log('✅ Analyse terminée!');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main();
