/**
 * Décodeur FLAC pour Blue Iris audio streaming
 * Implémentation basée sur UI3's PcmAudioPlayer avec Web Audio API
 * 
 * CRITIQUE: Blue Iris envoie des fragments FLAC, pas des frames complets
 * Il faut accumuler les chunks avant de décoder
 */

export class FlacAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.currentSampleRate = 0;
    this.nextPlayTime = 0;
    
    // État du décodeur (comme UI3)
    this.decoderState = {
      lastReceivedAudioIndex: -1,
      nextPlayAudioIndex: 0,
      buffers: [],
      startTime: -1
    };
    
    // Buffer pour accumuler les chunks FLAC incomplets
    this.chunkBuffer = [];
    this.totalBufferSize = 0;
    this.minFrameSize = 8192; // Taille minimale pour tenter un décodage (8KB)
    this.maxBufferSize = 524288; // 512KB max avant de forcer le décodage
    
    this.isPlaying = false;
  }

  /**
   * Initialise l'AudioContext avec le bon sampleRate
   * CRITIQUE: Blue Iris FLAC nécessite un contexte avec le sampleRate correct
   * pour éviter le resampling qui cause pops/crackles
   */
  initContext(sampleRate) {
    if (this.audioContext && this.currentSampleRate === sampleRate) {
      return; // Déjà initialisé avec le bon sampleRate
    }
    
    // Fermer l'ancien contexte si changement de sampleRate
    if (this.audioContext) {
      this.audioContext.close();
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      
      // CRITIQUE: Spécifier le sampleRate pendant la construction
      // C'est la différence clé avec ton approche précédente
      this.audioContext = new AudioContext({ sampleRate: sampleRate });
      this.currentSampleRate = sampleRate;
      this.nextPlayTime = this.audioContext.currentTime + 0.2; // 200ms initial delay
      
      // Reset decoder state
      this.decoderState = {
        lastReceivedAudioIndex: -1,
        nextPlayAudioIndex: 0,
        buffers: [],
        startTime: -1
      };
      
      console.log(`✅ FlacAudioPlayer context: ${sampleRate}Hz`);
    } catch (err) {
      console.error('❌ FlacAudioPlayer init failed:', err);
    }
  }

  /**
   * Accepte un chunk audio brut de Blue Iris
   * @param {Uint8Array} audioData - Données FLAC brutes (souvent fragmentées)
   * @param {number} sampleRate - Fréquence d'échantillonnage (typiquement 48000Hz)
   */
  async feed(audioData, sampleRate = 48000) {
    // Init context avec le bon sampleRate
    this.initContext(sampleRate);
    
    if (!this.audioContext) {
      console.warn('⚠️ AudioContext not available');
      return;
    }

    // Blue Iris ajoute un en-tête "blue" ou "Blue" même avec audio=2 - le retirer AVANT accumulation
    // Premier chunk: "blue" (0x62), chunks suivants: "Blue" (0x42)
    const audioArray = new Uint8Array(audioData);
    let flacData = audioArray;

    if (audioArray.length >= 44 && 
        (audioArray[0] === 0x62 || audioArray[0] === 0x42) && 
        audioArray[1] === 0x6c && 
        audioArray[2] === 0x75 && audioArray[3] === 0x65) {
      
      // Chercher la signature FLAC
      let flacOffset = -1;
      for (let i = 4; i < Math.min(audioArray.length, 100); i++) {
        if (audioArray[i] === 0x66 && audioArray[i+1] === 0x4C && 
            audioArray[i+2] === 0x61 && audioArray[i+3] === 0x43) {
          flacOffset = i;
          break;
        }
      }
      
      if (flacOffset > 0) {
        flacData = audioArray.slice(flacOffset);
      } else {
        flacData = audioArray.slice(44);
      }
    }

    // Accumuler les chunks NETTOYÉS
    this.chunkBuffer.push(flacData);
    this.totalBufferSize += flacData.length;

    // Démarrer tracking du temps de décodage
    if (this.decoderState.startTime === -1) {
      this.decoderState.startTime = performance.now();
    }

    // Tentative de décodage si on a assez de données OU si le buffer est trop gros
    if (this.totalBufferSize >= this.minFrameSize || this.totalBufferSize >= this.maxBufferSize) {
      await this.tryDecodeBuffer();
    }
  }

  /**
   * NOUVEAU: Tente de décoder le buffer accumulé
   */
  async tryDecodeBuffer() {
    if (this.chunkBuffer.length === 0) return;

    // Fusionner tous les chunks en un seul ArrayBuffer
    const combinedArray = new Uint8Array(this.totalBufferSize);
    let offset = 0;
    for (const chunk of this.chunkBuffer) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    // DEBUG: Analyser les premiers bytes pour comprendre le format
    if (this.decoderState.lastReceivedAudioIndex === -1) {
      const header = Array.from(combinedArray.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`🔍 Audio header (${this.totalBufferSize} bytes):`, header);
      
      // Vérifier signature FLAC: fLaC (0x664C6143)
      if (combinedArray[0] === 0x66 && combinedArray[1] === 0x4C && 
          combinedArray[2] === 0x61 && combinedArray[3] === 0x43) {
        console.log('✅ FLAC signature detected (fLaC)');
      }
      // Vérifier FLAC frame sync: 0xFFF8 ou 0xFFF9
      else if (combinedArray[0] === 0xFF && (combinedArray[1] & 0xFC) === 0xF8) {
        console.log('✅ FLAC frame sync detected');
      }
      // Autre format?
      else {
        console.warn(`⚠️ Unknown audio format. First 4 bytes: ${combinedArray.slice(0, 4).join(' ')}`);
      }
    }

    // Incrémenter l'index du paquet reçu
    this.decoderState.lastReceivedAudioIndex++;
    const myIndex = this.decoderState.lastReceivedAudioIndex;

    try {
      // CRITIQUE: Web Audio API decodeAudioData() avec FLAC de Blue Iris
      // Essayer de décoder le buffer accumulé
      const audioBuffer = await this.audioContext.decodeAudioData(combinedArray.buffer.slice(0));
      
      console.log(`📦 FLAC decoded successfully: ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(3)}s, buffer: ${this.totalBufferSize} bytes`);

      // Ajouter le buffer décodé dans la queue (maintenir l'ordre)
      this.decoderState.buffers.push({ buffer: audioBuffer, index: myIndex });
      
      // Jouer les buffers dans l'ordre
      this.playDecodedAudio();
      
      // SUCCÈS: Vider le buffer
      this.chunkBuffer = [];
      this.totalBufferSize = 0;
      
    } catch (err) {
      // DEBUG: Montrer l'erreur complète
      if (myIndex === 0) {
        console.error(`❌ FLAC decode error (${this.totalBufferSize} bytes):`, err.name, err.message);
      }
      
      // Échec du décodage - peut-être frame incomplète
      if (this.totalBufferSize < this.maxBufferSize) {
        // Attendre plus de données (ne pas vider le buffer)
        // NE PAS incrémenter l'index à nouveau - on va réessayer
        this.decoderState.lastReceivedAudioIndex--;
      } else {
        // Buffer trop gros, quelque chose ne va pas
        console.error(`❌ FLAC decode failed after ${this.totalBufferSize} bytes - giving up`);
        
        // Vider le buffer et recommencer
        this.chunkBuffer = [];
        this.totalBufferSize = 0;
        
        // Détection de stall du décodeur (comme UI3)
        if (this.decoderState.nextPlayAudioIndex <= 1 && 
            this.decoderState.lastReceivedAudioIndex > 20 && 
            this.decoderState.startTime > -1 && 
            performance.now() - this.decoderState.startTime > 5000) {
          console.error('❌ FLAC decoder stall detected', this.decoderState);
        }
      }
    }
  }

  /**
   * Joue les buffers audio décodés dans l'ordre correct
   * Adapté de UI3's PlayDecodedAudio()
   */
  playDecodedAudio() {
    for (let i = 0; i < this.decoderState.buffers.length; i++) {
      if (this.decoderState.buffers[i].index === this.decoderState.nextPlayAudioIndex) {
        this.decoderState.nextPlayAudioIndex++;
        const audioBuffer = this.decoderState.buffers[i].buffer;
        this.decoderState.buffers.splice(i, 1);

        // Créer source et planifier lecture
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Planifier pour continuité (comme UI3)
        const now = this.audioContext.currentTime;
        if (this.nextPlayTime < now) {
          this.nextPlayTime = now;
        }

        source.start(this.nextPlayTime);
        this.nextPlayTime += audioBuffer.duration;
        this.isPlaying = true;

        // Appel récursif pour jouer le prochain buffer si disponible
        this.playDecodedAudio();
        return;
      }
    }
  }

  /**
   * Obtient le buffer audio en cours (en ms)
   */
  getBufferedMs() {
    if (!this.audioContext) return 0;
    const buffered = this.nextPlayTime - this.audioContext.currentTime;
    return buffered < 0 ? 0 : buffered * 1000;
  }

  /**
   * Reset complet du player
   */
  reset() {
    if (this.audioContext) {
      this.audioContext.suspend();
      this.nextPlayTime = 0;
    }
    
    this.decoderState = {
      lastReceivedAudioIndex: -1,
      nextPlayAudioIndex: 0,
      buffers: [],
      startTime: -1
    };
    
    // Vider le buffer d'accumulation
    this.chunkBuffer = [];
    this.totalBufferSize = 0;
    
    this.isPlaying = false;
  }

  /**
   * Ferme le player et libère les ressources
   */
  close() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.reset();
  }
}
