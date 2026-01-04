/**
 * Blue Iris Audio Player
 * Blue Iris audio=1 transmet le codec audio ORIGINAL de chaque caméra
 * (AAC, PCM, G.711, etc.) - On laisse le navigateur décoder via Audio element
 */

export default class BlueIrisAudioPlayer {
  constructor() {
    this.audioElement = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.queue = [];
    this.isAppending = false;
    this.volume = 1.0;
  }

  init() {
    if (this.audioElement) return;

    // Créer l'élément audio
    this.audioElement = new Audio();
    this.audioElement.volume = this.volume;
    
    // Ajouter au DOM (nécessaire pour certains navigateurs)
    this.audioElement.style.display = 'none';
    document.body.appendChild(this.audioElement);
    
    // Blue Iris envoie des chunks audio bruts, pas un container MP4
    // MediaSource ne fonctionne pas bien avec ça, on utilise Blob
    this.useBlobFallback = true;
    
    console.log('✅ Audio player initialisé (mode Blob)');
  }

  initMediaSource() {
    this.mediaSource = new MediaSource();
    this.audioElement.src = URL.createObjectURL(this.mediaSource);
    
    this.mediaSource.addEventListener('sourceopen', () => {
      try {
        // Blue Iris peut envoyer différents formats, on essaie des codecs communs
        // AAC est le plus courant pour les caméras IP
        const codecs = [
          'audio/aac',
          'audio/mpeg', // MP3
          'audio/mp4; codecs="mp4a.40.2"', // AAC in MP4
        ];
        
        for (const codec of codecs) {
          if (MediaSource.isTypeSupported(codec)) {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(codec);
            console.log(`✅ SourceBuffer créé avec codec: ${codec}`);
            
            this.sourceBuffer.addEventListener('updateend', () => {
              this.isAppending = false;
              this.processQueue();
            });
            
            break;
          }
        }
        
        if (!this.sourceBuffer) {
          throw new Error('Aucun codec audio supporté');
        }
      } catch (err) {
        console.error('❌ Erreur init SourceBuffer:', err);
        this.useBlobFallback = true;
      }
    });
  }

  /**
   * Parse et retire le header "blue" de Blue Iris
   */
  parseHeader(data) {
    // Détecter le header "blue" (0x62 0x6c 0x75 0x65)
    if (data.length >= 4 && 
        data[0] === 0x62 && data[1] === 0x6c && 
        data[2] === 0x75 && data[3] === 0x65) {
      
      // Chercher la fin du header (début des données audio)
      // Le header contient "blue" + métadonnées
      // Stratégie simple : chercher après les zeros/padding
      let offset = 4;
      
      // Sauter les métadonnées (souvent ~40-60 bytes)
      // On cherche un pattern de données audio (entropie élevée)
      for (let i = 20; i < Math.min(data.length - 50, 100); i++) {
        const window = data.slice(i, i + 20);
        const zeros = window.filter(b => b === 0).length;
        
        // Si moins de 20% de zeros, c'est probablement de l'audio
        if (zeros < 4) {
          offset = i;
          break;
        }
      }
      
      if (offset > 4) {
        console.log(`📦 Blue Iris header détecté, audio commence à l'offset ${offset}`);
        return offset;
      }
    }
    
    return 0;
  }

  /**
   * Alimenter le player avec des chunks audio
   */
  async feed(audioData) {
    if (!this.audioElement) {
      this.init();
    }
    
    // Retirer le header "blue" si présent
    const offset = this.parseHeader(audioData);
    if (offset > 0) {
      audioData = audioData.slice(offset);
    }
    
    if (audioData.length === 0) {
      return;
    }
    
    if (this.useBlobFallback) {
      // Fallback: Créer un Blob et le jouer directement
      // Note: Moins fluide, mais compatible avec plus de navigateurs
      this.playBlob(audioData);
    } else {
      // Utiliser MediaSource pour streaming fluide
      this.queue.push(audioData);
      this.processQueue();
    }
  }

  processQueue() {
    if (this.isAppending || this.queue.length === 0 || !this.sourceBuffer) {
      return;
    }
    
    const data = this.queue.shift();
    
    try {
      this.isAppending = true;
      this.sourceBuffer.appendBuffer(data);
    } catch (err) {
      console.error('❌ Erreur append buffer:', err);
      this.isAppending = false;
      // Fallback vers Blob
      this.useBlobFallback = true;
      this.playBlob(data);
    }
  }

  playBlob(audioData) {
    // Accumuler les chunks audio dans un buffer
    if (!this.audioBuffer) {
      this.audioBuffer = [];
    }
    
    this.audioBuffer.push(audioData);
    
    // Jouer l'audio accumulé toutes les 500ms pour réduire les gaps
    if (!this.playTimer) {
      this.playTimer = setInterval(() => {
        this.flushAudioBuffer();
      }, 500);
    }
  }
  
  flushAudioBuffer() {
    if (!this.audioBuffer || this.audioBuffer.length === 0) {
      return;
    }
    
    // Combiner tous les chunks accumulés
    const totalLength = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of this.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    this.audioBuffer = [];
    
    // Créer un Blob et le jouer
    // Essayer différents types MIME
    const blob = new Blob([combined], { type: 'audio/mpeg' }); // ou 'audio/aac'
    const url = URL.createObjectURL(blob);
    
    console.log(`🔊 Playing audio blob: ${combined.length} bytes`);
    
    // Si l'audio est en train de jouer, ne pas interrompre
    // Sinon, démarrer la lecture
    if (this.audioElement.paused || this.audioElement.ended) {
      // Nettoyer l'URL précédente
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }
      
      this.currentBlobUrl = url;
      this.audioElement.src = url;
      
      this.audioElement.play().catch(err => {
        console.error('❌ Erreur play audio:', err);
        // Réessayer avec un autre type MIME
        if (blob.type === 'audio/mpeg') {
          const newBlob = new Blob([combined], { type: 'audio/aac' });
          const newUrl = URL.createObjectURL(newBlob);
          URL.revokeObjectURL(url);
          this.currentBlobUrl = newUrl;
          this.audioElement.src = newUrl;
          this.audioElement.play().catch(e => console.error('❌ Second attempt failed:', e));
        }
      });
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  stop() {
    // Arrêter le timer de flush
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
    
    // Nettoyer le buffer
    this.audioBuffer = [];
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      
      // Retirer du DOM
      if (this.audioElement.parentNode) {
        this.audioElement.parentNode.removeChild(this.audioElement);
      }
      
      this.audioElement = null;
    }
    
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch (err) {
        // Ignorer les erreurs de fermeture
      }
    }
    
    this.queue = [];
    this.isAppending = false;
  }
}
