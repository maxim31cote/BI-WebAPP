/**
 * PCM Audio Player for Blue Iris µ-law/PCM audio (audio=1)
 * Based on UI3's PcmAudioPlayer.js
 * Decodes µ-law PCM audio and plays through Web Audio API
 */

export default class PcmAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.nextPlayTime = 0;
    
    // Decoder state (inspired by UI3)
    this.decoderState = {
      lastReceivedAudioIndex: -1,
      nextPlayAudioIndex: 0,
      buffers: [],
      startTime: -1
    };
    
    // Blue Iris PCM header detection
    this.headerBytes = [];
    this.foundHeader = false;
    this.audioFormat = null; // Will be 'pcm' or 'mulaw'
  }

  initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 8000 // Blue Iris audio=1 uses 8kHz
      });
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.audioContext.destination);
      
      console.log(`✅ PCM AudioContext: ${this.audioContext.sampleRate}Hz`);
    }
  }

  /**
   * µ-law decompression algorithm (G.711 µ-law)
   * Converts 8-bit µ-law samples to 16-bit linear PCM
   */
  mulawToLinear(mulawByte) {
    const MULAW_BIAS = 33;
    const MULAW_MAX = 0x1FFF;
    
    mulawByte = ~mulawByte;
    const sign = (mulawByte & 0x80);
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS << exponent;
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    
    return sign ? -sample : sample;
  }

  /**
   * A-law decompression algorithm (G.711 A-law)
   * Converts 8-bit A-law samples to 16-bit linear PCM
   * A-law is used in Europe/international telephony
   */
  alawToLinear(alawByte) {
    alawByte ^= 0x55; // XOR with 0x55 to invert even bits
    
    const sign = (alawByte & 0x80);
    const exponent = (alawByte >> 4) & 0x07;
    const mantissa = alawByte & 0x0F;
    
    let sample = mantissa << 4;
    
    if (exponent > 0) {
      sample += 0x100; // Add bias
    }
    
    sample <<= (exponent > 0) ? (exponent + 3) : 4;
    
    return sign ? -sample : sample;
  }

  /**
   * Detect and parse Blue Iris audio header
   * Format: "blue" + metadata including "H264" string
   */
  parseHeader(data) {
    // Look for "blue" signature (0x62 0x6c 0x75 0x65)
    if (data.length >= 4 && 
        data[0] === 0x62 && data[1] === 0x6c && 
        data[2] === 0x75 && data[3] === 0x65) {
      
      // Blue Iris header detected
      // Based on analysis, after "blue" and "H264", there are more metadata bytes
      // µ-law audio has high entropy - real audio won't be mostly zeros
      
      let headerSize = 4; // Start after "blue"
      
      // Strategy: Find where consistent audio data starts
      // Real µ-law audio has varied byte values (0x00-0xFF distributed)
      // Not just zeros, not just 0xFF, and not structured patterns
      
      for (let i = 20; i < Math.min(data.length - 100, 200); i++) {
        // Check 50-byte window for µ-law characteristics
        const window = data.slice(i, i + 50);
        
        // Count zeros and max values
        const zeros = window.filter(b => b === 0x00).length;
        const maxValues = window.filter(b => b === 0xFF || b === 0x00).length;
        
        // Real µ-law audio:
        // - Less than 30% zeros (audio has content)
        // - Less than 50% extreme values (not structured data)
        // - Values distributed across range
        const zeroRatio = zeros / window.length;
        const extremeRatio = maxValues / window.length;
        
        if (zeroRatio < 0.3 && extremeRatio < 0.5) {
          // Calculate byte distribution entropy
          const histogram = new Array(256).fill(0);
          window.forEach(b => histogram[b]++);
          const uniqueValues = histogram.filter(count => count > 0).length;
          
          // µ-law should have 20+ different byte values in 50 samples
          if (uniqueValues >= 20) {
            headerSize = i;
            console.log(`📦 Blue Iris header detected, audio data starts at byte ${headerSize} (entropy: ${uniqueValues}/256 unique values)`);
            break;
          }
        }
      }
      
      // If we didn't find a good start, use fallback
      if (headerSize <= 4) {
        headerSize = 80; // Larger conservative fallback
        console.log(`📦 Blue Iris header detected (no audio pattern found), using fallback offset ${headerSize}`);
      }
      
      this.foundHeader = true;
      this.audioFormat = 'mulaw'; // Blue Iris audio=1 uses µ-law
      
      return headerSize;
    }
    
    return 0;
  }

  /**
   * Feed audio data chunk
   */
  async feed(audioData) {
    if (!this.audioContext) {
      this.initContext();
    }
    
    const myIndex = ++this.decoderState.lastReceivedAudioIndex;
    
    if (myIndex === 0) {
      console.log(`🎵 First audio chunk: ${audioData.length} bytes`);
    }
    
    // IMPORTANT: Blue Iris ajoute un header "blue" à CHAQUE chunk, pas juste le premier !
    // Il faut parser le header pour chaque chunk
    let dataOffset = this.parseHeader(audioData);
    if (dataOffset > 0) {
      audioData = audioData.slice(dataOffset);
    }
    
    if (audioData.length === 0) {
      this.decoderState.lastReceivedAudioIndex--;
      return;
    }
    
    try {
      // Blue Iris audio=1 @ 8kHz - Format inconnu
      // Essayons A-law (G.711 A-law) au lieu de µ-law
      const pcmSamples = new Int16Array(audioData.length);
      
      // Test A-law decoding
      for (let i = 0; i < audioData.length; i++) {
        pcmSamples[i] = this.alawToLinear(audioData[i]);
      }
      
      // Log first few samples for debugging (once)
      if (myIndex === 0) {
        console.log('🔬 First 20 bytes (after header skip):', Array.from(audioData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('🔬 First 10 A-law decoded samples:', Array.from(pcmSamples.slice(0, 10)));
        console.log('🔬 Sample range check - min:', Math.min(...pcmSamples.slice(0, 100)), 'max:', Math.max(...pcmSamples.slice(0, 100)));
        
        // Check audio data quality
        const zeros = audioData.slice(0, 100).filter(b => b === 0x00).length;
        const histogram = new Array(256).fill(0);
        audioData.slice(0, 100).forEach(b => histogram[b]++);
        const uniqueValues = histogram.filter(count => count > 0).length;
        
        console.log('🔬 Audio quality: zeros:', zeros + '%', 'unique bytes:', uniqueValues + '/256');
        
        // Check for suspicious patterns
        const maxValues = pcmSamples.slice(0, 100).filter(s => Math.abs(s) > 8000).length;
        if (maxValues > 50) {
          console.warn('⚠️ Too many max-range samples! Trying µ-law instead...');
          
          // Re-decode with µ-law
          for (let i = 0; i < audioData.length; i++) {
            pcmSamples[i] = this.mulawToLinear(audioData[i]);
          }
          console.log('🔬 First 10 µ-law decoded samples:', Array.from(pcmSamples.slice(0, 10)));
        }
        if (zeros > 30) {
          console.warn('⚠️ Too many zero bytes! Might still be in header. Try checking chunks after first one.');
        }
      }
      
      // Create AudioBuffer from PCM samples
      const audioBuffer = this.audioContext.createBuffer(
        1, // mono
        pcmSamples.length,
        this.audioContext.sampleRate
      );
      
      // Copy PCM data to AudioBuffer (convert Int16 to Float32)
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmSamples.length; i++) {
        channelData[i] = pcmSamples[i] / 32768.0; // Normalize to [-1, 1]
      }
      
      // Queue for playback
      this.decoderState.buffers.push({ buffer: audioBuffer, index: myIndex });
      
      // Log chunk 2 to verify no header
      if (myIndex === 1) {
        console.log('🔬 Chunk 2 - First 20 bytes:', Array.from(audioData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('🔬 Chunk 2 - First 10 samples:', Array.from(pcmSamples.slice(0, 10)));
      }
      
      if (myIndex === 0 || myIndex % 100 === 0) {
        console.log(`📦 Decoded: ${pcmSamples.length} samples (${audioData.length} bytes), ${audioBuffer.duration.toFixed(3)}s`);
      }
      
      this.playDecodedAudio();
      
    } catch (err) {
      console.error(`❌ PCM decode error:`, err);
      this.decoderState.lastReceivedAudioIndex--;
    }
  }

  /**
   * Play queued audio buffers in order
   */
  playDecodedAudio() {
    if (!this.audioContext || !this.gainNode) return;
    
    // Play buffers in order
    for (let i = 0; i < this.decoderState.buffers.length; i++) {
      if (this.decoderState.buffers[i].index === this.decoderState.nextPlayAudioIndex) {
        const audioBuffer = this.decoderState.buffers[i].buffer;
        
        // Create source node
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect through gain node
        source.connect(this.gainNode);
        
        // Schedule playback for temporal continuity
        const now = this.audioContext.currentTime;
        if (this.nextPlayTime < now) {
          this.nextPlayTime = now;
        }
        
        source.start(this.nextPlayTime);
        this.nextPlayTime += audioBuffer.duration;
        
        // Move to next buffer
        this.decoderState.nextPlayAudioIndex++;
        this.decoderState.buffers.splice(i, 1);
        
        // Recursive call to play next buffer
        this.playDecodedAudio();
        return;
      }
    }
  }

  /**
   * Set playback volume (0.0 to 1.0)
   */
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Stop playback and clean up
   */
  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.decoderState.buffers = [];
    this.nextPlayTime = 0;
  }
}
