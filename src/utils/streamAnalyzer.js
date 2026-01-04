/**
 * Stream Analyzer pour comprendre le format Blue Iris
 * Analyse les données brutes du stream pour identifier le format et les headers
 */

export class StreamAnalyzer {
  constructor() {
    this.chunks = [];
    this.analysis = {
      headers: [],
      patterns: [],
      codecInfo: null
    };
  }

  /**
   * Analyser un chunk de données
   */
  analyze(data, chunkIndex) {
    if (chunkIndex === 0) {
      console.log('🔬 ==================== ANALYSE STREAM ====================');
    }

    const result = {
      chunkIndex,
      size: data.length,
      firstBytes: Array.from(data.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      hasBlueHeader: false,
      blueHeaderType: null,
      payloadStart: 0,
      signatures: []
    };

    // Chercher signature "blue" ou "Blue"
    if (data.length >= 4) {
      if (data[0] === 0x62 && data[1] === 0x6c && data[2] === 0x75 && data[3] === 0x65) {
        result.hasBlueHeader = true;
        result.blueHeaderType = 'blue';
        
        // Lire les métadonnées du header
        if (data.length >= 16) {
          const size1 = data.readUInt32LE(4);
          const checksum = Array.from(data.slice(8, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          
          console.log(`📦 Header "blue": size=${size1}, checksum=[${checksum}]`);
          
          // Analyser après le header (16 bytes)
          const afterHeader = data.slice(16);
          this.analyzePayload(afterHeader, 16);
        }
      } else if (data[0] === 0x42 && data[1] === 0x6c && data[2] === 0x75 && data[3] === 0x65) {
        result.hasBlueHeader = true;
        result.blueHeaderType = 'Blue';
        
        if (data.length >= 16) {
          const size1 = data.readUInt32LE(4);
          const checksum = Array.from(data.slice(8, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          
          console.log(`📦 Header "Blue": size=${size1}, checksum=[${checksum}]`);
          
          const afterHeader = data.slice(16);
          this.analyzePayload(afterHeader, 16);
        }
      } else {
        // Pas de header Blue, analyser directement
        this.analyzePayload(data, 0);
      }
    }

    // Chercher signatures connues
    this.findSignatures(data, result);

    if (chunkIndex === 0 || chunkIndex % 100 === 0) {
      console.log(`📊 Chunk #${chunkIndex}:`, result);
    }

    this.chunks.push(result);
    return result;
  }

  /**
   * Analyser le payload après les headers Blue Iris
   */
  analyzePayload(data, offset) {
    if (data.length < 32) return;

    console.log(`\n🔍 Payload analysis (offset=${offset}):`);
    console.log('First 64 bytes:', Array.from(data.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Chercher patterns connus
    const patterns = {
      'MPEG-TS sync (0x47)': data[0] === 0x47,
      'FLV signature (FLV)': data[0] === 0x46 && data[1] === 0x4C && data[2] === 0x56,
      'H264 SPS (00 00 01 67)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x67,
      'H264 PPS (00 00 01 68)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x68,
      'H264 IDR (00 00 01 65)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x65,
      'H265 VPS (00 00 01 40)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x40,
      'H265 SPS (00 00 01 42)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x42,
      'H265 PPS (00 00 01 44)': data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x44,
      'AAC ADTS (FF F1/F9)': data[0] === 0xFF && (data[1] === 0xF1 || data[1] === 0xF9)
    };

    console.log('🔎 Pattern detection:');
    Object.entries(patterns).forEach(([name, found]) => {
      if (found) console.log(`  ✅ ${name}`);
    });

    // Chercher "H264" ou "H265" en ASCII
    const str = String.fromCharCode(...data.slice(0, 64));
    if (str.includes('H264')) {
      console.log('  ✅ Found "H264" string at:', str.indexOf('H264'));
    }
    if (str.includes('H265')) {
      console.log('  ✅ Found "H265" string at:', str.indexOf('H265'));
    }

    // Analyser structure si commence par 00 00 01
    if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01) {
      const nalType = data[3];
      console.log(`  📹 NAL unit type: 0x${nalType.toString(16)} (${nalType})`);
    }

    // Chercher tous les 00 00 01 dans les premiers bytes
    console.log('🔎 NAL start codes (00 00 01) found at:');
    for (let i = 0; i < Math.min(data.length - 3, 200); i++) {
      if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x01) {
        const nalType = data[i+3];
        console.log(`  - Offset ${i}: NAL type 0x${nalType.toString(16)}`);
      }
    }

    console.log('');
  }

  /**
   * Chercher signatures dans les données
   */
  findSignatures(data, result) {
    const signatures = [];

    // MPEG-TS sync bytes (0x47 tous les 188 bytes)
    let mpegtsCount = 0;
    for (let i = 0; i < data.length; i += 188) {
      if (data[i] === 0x47) mpegtsCount++;
    }
    if (mpegtsCount > 2) {
      signatures.push({ type: 'MPEG-TS', confidence: 'high', count: mpegtsCount });
    }

    // FLV
    if (data.length >= 3 && data[0] === 0x46 && data[1] === 0x4C && data[2] === 0x56) {
      signatures.push({ type: 'FLV', confidence: 'high' });
    }

    // H.264/H.265 NAL units
    let nalCount = 0;
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x00 && data[i+1] === 0x00 && data[i+2] === 0x01) {
        nalCount++;
      }
    }
    if (nalCount > 0) {
      signatures.push({ type: 'NAL units', confidence: 'medium', count: nalCount });
    }

    result.signatures = signatures;
  }

  /**
   * Générer rapport d'analyse
   */
  getReport() {
    console.log('\n📊 ==================== RAPPORT ANALYSE ====================');
    console.log(`Total chunks analysés: ${this.chunks.length}`);
    
    // Analyser premier chunk en détail
    if (this.chunks.length > 0) {
      const first = this.chunks[0];
      console.log('\n📦 Premier chunk:');
      console.log(`  Taille: ${first.size} bytes`);
      console.log(`  Header Blue Iris: ${first.hasBlueHeader ? first.blueHeaderType : 'Non'}`);
      console.log(`  Signatures trouvées:`, first.signatures);
    }

    return this.analysis;
  }
}
