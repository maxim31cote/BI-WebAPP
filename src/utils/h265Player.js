/**
 * H.265/HEVC Player avec MSE natif
 * Parse les streams Blue Iris vcs=3 et joue via Media Source Extensions
 */

export class H265Player {
  constructor(videoElement) {
    this.video = videoElement;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.queue = [];
    this.isUpdating = false;
    this.initialized = false;
    
    // Track de codec info
    this.vps = null;
    this.sps = null;
    this.pps = null;
  }

  async init(codec = 'video/mp4; codecs="hev1.1.6.L153.B0"') {
    return new Promise((resolve, reject) => {
      // Vérifier support MSE
      if (!window.MediaSource) {
        reject(new Error('MSE not supported'));
        return;
      }

      // Vérifier support H.265
      if (!MediaSource.isTypeSupported(codec)) {
        console.warn(`⚠️ ${codec} not supported, trying alternatives...`);
        
        // Essayer différents profils H.265
        const alternatives = [
          'video/mp4; codecs="hvc1.1.6.L153.B0"',
          'video/mp4; codecs="hev1.1.6.L120.B0"',
          'video/mp4; codecs="hvc1"',
          'video/mp4; codecs="hev1"'
        ];
        
        codec = alternatives.find(c => MediaSource.isTypeSupported(c));
        
        if (!codec) {
          reject(new Error('H.265 not supported by browser'));
          return;
        }
        
        console.log(`✅ Using codec: ${codec}`);
      }

      this.codec = codec;
      this.mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(this.mediaSource);

      this.mediaSource.addEventListener('sourceopen', () => {
        try {
          this.sourceBuffer = this.mediaSource.addSourceBuffer(this.codec);
          
          this.sourceBuffer.addEventListener('updateend', () => {
            this.isUpdating = false;
            this.processQueue();
          });
          
          this.sourceBuffer.addEventListener('error', (e) => {
            console.error('❌ SourceBuffer error:', e);
          });
          
          this.initialized = true;
          console.log('✅ H.265 MSE Player initialized');
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.mediaSource.addEventListener('sourceclose', () => {
        console.log('📺 MediaSource closed');
      });
    });
  }

  /**
   * Parser les wrappers Blue Iris et extraire NAL units
   */
  parseBlueIrisChunk(data) {
    const nalUnits = [];
    let offset = 0;

    while (offset < data.length) {
      // Chercher wrapper "blue"/"Blue"
      if (offset + 16 <= data.length &&
          ((data[offset] === 0x62 || data[offset] === 0x42) &&
           data[offset + 1] === 0x6c &&
           data[offset + 2] === 0x75 &&
           data[offset + 3] === 0x65)) {
        
        // Sauter le wrapper (16 bytes)
        offset += 16;
        continue;
      }

      // Chercher NAL start code (00 00 01)
      if (offset + 3 < data.length &&
          data[offset] === 0x00 &&
          data[offset + 1] === 0x00 &&
          data[offset + 2] === 0x01) {
        
        const nalStart = offset;
        
        // Trouver fin du NAL unit (prochain start code)
        let nalEnd = data.length;
        for (let i = nalStart + 3; i < data.length - 2; i++) {
          if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
            nalEnd = i;
            break;
          }
        }
        
        const nalUnit = data.slice(nalStart, nalEnd);
        const nalType = (data[nalStart + 3] >> 1) & 0x3F; // H.265 NAL type
        
        nalUnits.push({ type: nalType, data: nalUnit });
        
        // Stocker VPS/SPS/PPS
        if (nalType === 32) this.vps = nalUnit; // VPS
        if (nalType === 33) this.sps = nalUnit; // SPS
        if (nalType === 34) this.pps = nalUnit; // PPS
        
        offset = nalEnd;
      } else {
        offset++;
      }
    }

    return nalUnits;
  }

  /**
   * Créer fMP4 initialization segment
   */
  createInitSegment() {
    // TODO: Créer vrai fMP4 init avec VPS/SPS/PPS
    // Pour l'instant, retourner null (le browser pourrait tolérer)
    return null;
  }

  /**
   * Feed data brute
   */
  feed(data) {
    if (!this.initialized) {
      console.warn('⚠️ Player not initialized');
      return;
    }

    // Parser NAL units
    const nalUnits = this.parseBlueIrisChunk(data);
    
    if (nalUnits.length > 0) {
      // Pour l'instant, essayons de donner directement les données à MSE
      // (simplification - dans la vraie vie il faut créer des fMP4 boxes)
      this.queue.push(data);
      this.processQueue();
    }
  }

  /**
   * Process queued data
   */
  processQueue() {
    if (this.isUpdating || this.queue.length === 0 || !this.sourceBuffer) {
      return;
    }

    this.isUpdating = true;
    const data = this.queue.shift();
    
    try {
      this.sourceBuffer.appendBuffer(data);
    } catch (err) {
      console.error('❌ Failed to append buffer:', err);
      this.isUpdating = false;
    }
  }

  /**
   * Destroy player
   */
  destroy() {
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
    }
    
    if (this.video) {
      this.video.src = '';
    }
    
    this.queue = [];
    this.initialized = false;
  }
}
