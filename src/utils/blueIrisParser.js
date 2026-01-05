/**
 * Parser pour le protocole Blue Iris (basé sur ui3.js)
 * Parse les streams avec headers "blue" et "Blue"
 */

class BlueIrisParser {
  constructor(onVideoFrame, onAudioFrame, onStreamInfo, onStatusBlock) {
    this.onVideoFrame = onVideoFrame;
    this.onAudioFrame = onAudioFrame;
    this.onStreamInfo = onStreamInfo;
    this.onStatusBlock = onStatusBlock;
    
    this.reset();
  }

  reset() {
    this.state = 0;
    this.buffer = new Uint8Array(0);
    this.availableStreams = 0;
    this.streamHeaderSize = 0;
    this.blockType = -1;
    this.bitmapHeader = null;
    this.audioHeader = null;
    this.baseVideoFrameTime = -1;
    this.lastVideoFrameTime = -1;
    this.currentVideoFrame = { pos: 0, time: 0, rawtime: 0, utc: 0, size: 0 };
    this.currentAudioFrame = { size: 0 };
    this.statusBlockSize = 0;
  }

  // Ajoute des données au buffer
  write(data) {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
  }

  // Lit n bytes du buffer (retourne null si pas assez de données)
  read(n) {
    if (this.buffer.length < n) {
      return null;
    }
    const result = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return result;
  }

  // Parse le buffer
  parse() {
    while (true) {
      if (this.state === 0) {
        // Read Stream Header Start (6 bytes: "blue" + streams + headerSize)
        const buf = this.read(6);
        if (!buf) return;

        // Debug: log ce qui est reçu
        const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        console.log('🔍 Parser state 0: received 6 bytes:', text, 'hex:', Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('🔍 Buffer length before read:', this.buffer.length + 6, 'bytes');

        // Vérifie "blue"
        if (buf[0] !== 98 || buf[1] !== 108 || buf[2] !== 117 || buf[3] !== 101) {
          console.error('❌ Expected "blue" (62 6c 75 65) but got:', Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(' '));
          throw new Error('Stream did not start with "blue"');
        }

        this.availableStreams = buf[4];
        if (this.availableStreams !== 1 && this.availableStreams !== 2) {
          throw new Error(`Invalid availableStreams: ${this.availableStreams}`);
        }

        this.streamHeaderSize = buf[5];
        console.log('✅ Found "blue" header, streams:', this.availableStreams, 'headerSize:', this.streamHeaderSize);
        this.state = 1;
      } 
      else if (this.state === 1) {
        // Read Stream Header Remainder
        const buf = this.read(this.streamHeaderSize);
        if (!buf) return;

        let offset = 0;

        // Read BITMAPINFOHEADER
        const bitmapHeaderSize = this.readUInt32LE(buf, offset);
        offset += 4;
        
        if (bitmapHeaderSize > 0) {
          const headerData = buf.slice(offset - 4, offset - 4 + bitmapHeaderSize);
          this.bitmapHeader = this.parseBitmapHeader(headerData);
          offset += bitmapHeaderSize - 4;
        }

        // Read audio header si présent
        if (offset < this.streamHeaderSize) {
          const audioData = buf.slice(offset, this.streamHeaderSize);
          this.audioHeader = this.parseAudioHeader(audioData);
        }

        if (this.onStreamInfo) {
          this.onStreamInfo(this.bitmapHeader, this.audioHeader);
        }

        this.state = 2;
      } 
      else if (this.state === 2) {
        // Read Block Header Start (5 bytes: "Blue" + type)
        const buf = this.read(5);
        if (!buf) return;

        // Vérifie "Blue"
        if (buf[0] !== 66 || buf[1] !== 108 || buf[2] !== 117 || buf[3] !== 101) {
          throw new Error('Block did not start with "Blue"');
        }

        this.blockType = buf[4];
        this.state = 3;
      } 
      else if (this.state === 3) {
        // Read Block Header Remainder
        if (this.blockType === 0) {
          // Video frame header (18 bytes)
          const buf = this.read(18);
          if (!buf) return;

          let offset = 0;
          this.currentVideoFrame.pos = this.readUInt16(buf, offset);
          offset += 2;
          this.currentVideoFrame.rawtime = this.readUInt32(buf, offset);
          offset += 4;
          this.currentVideoFrame.time = this.currentVideoFrame.rawtime;
          this.currentVideoFrame.utc = this.readUInt64LE(buf, offset);
          offset += 8;
          this.currentVideoFrame.size = this.readUInt32(buf, offset);

          // Gestion du temps (overflow UINT32)
          const UINT32_MAX = 4294967296;
          if (this.baseVideoFrameTime === -1) {
            this.baseVideoFrameTime = this.currentVideoFrame.time;
          }

          if (this.lastVideoFrameTime !== -1) {
            if (this.lastVideoFrameTime - 1000000000 > this.currentVideoFrame.time) {
              this.baseVideoFrameTime -= UINT32_MAX;
            }
            if (this.lastVideoFrameTime + 1000000000 < this.currentVideoFrame.time) {
              this.baseVideoFrameTime += UINT32_MAX;
            }
          }

          this.lastVideoFrameTime = this.currentVideoFrame.time;
          this.currentVideoFrame.time -= this.baseVideoFrameTime;
          this.currentVideoFrame.time = Math.abs(this.currentVideoFrame.time);

          if (this.currentVideoFrame.size > 10000000) {
            throw new Error(`Video frame size too large: ${this.currentVideoFrame.size}`);
          }

          this.state = 4;
        } 
        else if (this.blockType === 1) {
          // Audio frame header (4 bytes)
          const buf = this.read(4);
          if (!buf) return;

          this.currentAudioFrame.size = this.readInt32(buf, 0);

          if (this.currentAudioFrame.size > 2000000) {
            throw new Error(`Audio frame size too large: ${this.currentAudioFrame.size}`);
          }

          this.state = 4;
        } 
        else if (this.blockType === 2) {
          // Status block header (1 byte)
          const buf = this.read(1);
          if (!buf) return;

          this.statusBlockSize = buf[0];

          if (this.statusBlockSize < 6) {
            throw new Error(`Invalid status block size: ${this.statusBlockSize}`);
          }

          this.state = 4;
        } 
        else if (this.blockType === 4) {
          // End of stream
          return { ended: true };
        } 
        else {
          throw new Error(`Unknown block type: ${this.blockType}`);
        }
      } 
      else if (this.state === 4) {
        // Read AV frame data
        if (this.blockType === 0) {
          // Video frame
          const buf = this.read(this.currentVideoFrame.size);
          if (!buf) return;

          const codec = this.bitmapHeader?.biCompression || 'Unknown';
          const isH265 = codec === 'H265';
          const keyframe = this.identifyKeyframe(buf, isH265);

          if (this.onVideoFrame) {
            this.onVideoFrame({
              frameData: buf,
              codec,
              keyframe,
              time: this.currentVideoFrame.time,
              pos: this.currentVideoFrame.pos,
              utc: this.currentVideoFrame.utc,
              size: this.currentVideoFrame.size,
              meta: { ...this.currentVideoFrame, keyframe }
            });
          }

          this.state = 2;
        } 
        else if (this.blockType === 1) {
          // Audio frame
          const buf = this.read(this.currentAudioFrame.size);
          if (!buf) return;

          if (this.onAudioFrame) {
            this.onAudioFrame({
              frameData: buf,
              format: this.audioHeader,
              size: this.currentAudioFrame.size
            });
          }

          this.state = 2;
        } 
        else if (this.blockType === 2) {
          // Status block
          const buf = this.read(this.statusBlockSize - 6);
          if (!buf) return;

          if (this.onStatusBlock) {
            this.onStatusBlock(this.parseStatusBlock(buf));
          }

          this.state = 2;
        }
      }
    }
  }

  // Identifie si une frame est un keyframe en analysant les NAL units
  identifyKeyframe(buf, isH265) {
    let foundKeyframe = false;
    let zeroBytes = 0;

    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i] === 0) {
        zeroBytes++;
      } else {
        if ((zeroBytes === 2 || zeroBytes === 3) && buf[i] === 1 && i + 1 < buf.length) {
          // Start code trouvé
          if (isH265) {
            const naluType = (buf[i + 1] >> 1) & 63;
            if (naluType >= 19 && naluType <= 21) {
              foundKeyframe = true;
              break;
            }
          } else {
            // H.264
            const naluType = buf[i + 1] & 31;
            if (naluType === 5) {
              foundKeyframe = true;
              break;
            }
          }
        }
        zeroBytes = 0;
      }
    }

    return foundKeyframe;
  }

  // Parse BITMAPINFOHEADER
  parseBitmapHeader(buf) {
    let offset = 0;
    return {
      biSize: this.readUInt32LE(buf, offset),
      biWidth: this.readInt32LE(buf, offset + 4),
      biHeight: this.readInt32LE(buf, offset + 8),
      biPlanes: this.readUInt16LE(buf, offset + 12),
      biBitCount: this.readUInt16LE(buf, offset + 14),
      biCompression: this.readASCII(buf, offset + 16, 4),
      biSizeImage: this.readUInt32LE(buf, offset + 20),
      biXPelsPerMeter: this.readInt32LE(buf, offset + 24),
      biYPelsPerMeter: this.readInt32LE(buf, offset + 28),
      biClrUsed: this.readUInt32LE(buf, offset + 32),
      biClrImportant: this.readUInt32LE(buf, offset + 36)
    };
  }

  // Parse WAVEFORMATEX
  parseAudioHeader(buf) {
    if (buf.length < 14) return null;

    return {
      wFormatTag: this.readUInt16LE(buf, 0),
      nChannels: this.readUInt16LE(buf, 2),
      nSamplesPerSec: this.readUInt32LE(buf, 4),
      nAvgBytesPerSec: this.readUInt32LE(buf, 8),
      nBlockAlign: this.readUInt16LE(buf, 12),
      wBitsPerSample: buf.length >= 18 ? this.readUInt16LE(buf, 14) : 0,
      cbSize: buf.length >= 18 ? this.readUInt16LE(buf, 16) : 0
    };
  }

  // Parse status block
  parseStatusBlock(buf) {
    return {
      bRec: buf[0],
      bMotion: buf[1],
      bCheckFPS: buf[2],
      bTriggered: buf[3],
      bSignalLost: buf[4],
      bPushError: buf[5],
      bFlashError: buf[6],
      bForceMovie: buf[7],
      fps: this.readInt32(buf, 10),
      apeak: this.readInt32(buf, 14),
      tpause: this.readInt32(buf, 18)
    };
  }

  // Utilitaires de lecture
  readUInt16(buf, offset) {
    return (buf[offset] << 8) | buf[offset + 1];
  }

  readUInt16LE(buf, offset) {
    return buf[offset] | (buf[offset + 1] << 8);
  }

  readUInt32(buf, offset) {
    return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
  }

  readInt32(buf, offset) {
    return (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
  }

  readUInt32LE(buf, offset) {
    return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
  }

  readInt32LE(buf, offset) {
    return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
  }

  readUInt64LE(buf, offset) {
    const low = this.readUInt32LE(buf, offset);
    const high = this.readUInt32LE(buf, offset + 4);
    return high * 4294967296 + low;
  }

  readASCII(buf, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(buf[offset + i]);
    }
    return str;
  }
}

export default BlueIrisParser;
