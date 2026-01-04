# 🎵 Implémentation Audio FLAC pour Blue Iris

## ✅ Solution Fonctionnelle

L'audio FLAC de Blue Iris est maintenant **fonctionnel** avec **Web Audio API** native!

### 🔍 Découverte Clé

Après analyse du code source UI3 (`ui3.js`), j'ai découvert que:
- UI3 n'utilise **PAS** de bibliothèque externe (libflac.js)
- UI3 utilise directement **`AudioContext.decodeAudioData()`**
- Le FLAC de Blue Iris est **décodable nativement** par les navigateurs modernes

## 🏗️ Architecture

### 1. FlacAudioPlayer (`src/utils/flacDecoder.js`)

Classe inspirée du `PcmAudioPlayer` de UI3:

```javascript
export class FlacAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.currentSampleRate = 0;
    this.nextPlayTime = 0;
    this.decoderState = {
      lastReceivedAudioIndex: -1,
      nextPlayAudioIndex: 0,
      buffers: [],
      startTime: -1
    };
  }

  initContext(sampleRate) {
    // CRITIQUE: AudioContext avec sampleRate spécifique
    this.audioContext = new AudioContext({ sampleRate: sampleRate });
  }

  async feed(audioData, sampleRate = 48000) {
    this.initContext(sampleRate);
    
    // Décodage async avec Web Audio API
    const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer.slice(0));
    
    // Mise en queue des buffers (maintenir l'ordre)
    this.decoderState.buffers.push({ buffer: audioBuffer, index: myIndex });
    
    // Lecture dans l'ordre
    this.playDecodedAudio();
  }
}
```

### 2. LiveView.vue - Streaming Dual

**Approche identique à UI3**: deux fetch séparés pour vidéo et audio

```javascript
// Stream vidéo (audio=0)
const streamURL = camerasStore.getStreamURL(camera, quality, false);

// Stream audio (audio=2 = FLAC)
const audioURL = camerasStore.getStreamURL(camera, quality, true);

// Vidéo: JMuxer mode='video'
jmuxer = new JMuxer({ node: player, mode: 'video', ... });

// Audio: FlacAudioPlayer
flacPlayer = new FlacAudioPlayer();

// Streaming vidéo
fetch(streamURL).then(response => {
  const reader = response.body.getReader();
  const read = () => {
    reader.read().then(({ value }) => {
      jmuxer.feed({ video: new Uint8Array(value) });
      read();
    });
  };
  read();
});

// Streaming audio
fetch(audioURL).then(response => {
  const reader = response.body.getReader();
  const read = () => {
    reader.read().then(({ value }) => {
      flacPlayer.feed(new Uint8Array(value), 48000);
      read();
    });
  };
  read();
});
```

### 3. API Client - URL Generation

```javascript
getStreamURL(camera, quality = 'high', enableAudio = false) {
  const audio = enableAudio ? 2 : 0; // 0=off, 2=FLAC
  return `/video/${camera}/2.0?session=${this.session}&audio=${audio}&stream=0&w=1920&h=1080&q=23&kbps=1000&gop=30&vcs=0&rc=0&extend=2`;
}
```

## 🎯 Paramètres Critiques

### AudioContext
```javascript
new AudioContext({ sampleRate: 48000 })
```
**IMPORTANT**: Blue Iris FLAC = 48kHz. Spécifier le sampleRate évite le resampling qui cause des pops/crackles.

### Blue Iris Stream
- `audio=2`: FLAC codec (format décodable par `decodeAudioData()`)
- `audio=1`: µ-law (nécessite décodeur manuel)
- `audio=0`: Pas d'audio

### Gestion de l'Ordre
Le `decoderState` maintient l'ordre des buffers audio:
- `lastReceivedAudioIndex`: Dernier paquet reçu
- `nextPlayAudioIndex`: Prochain paquet à jouer
- `buffers[]`: Queue des buffers décodés

Ceci évite que des paquets arrivés en désordre causent des glitches audio.

## 🔊 Contrôle Audio

### Bouton Audio UI
```vue
<button @click="toggleAudio" class="btn-audio" :class="{ active: audioEnabled }">
  <!-- Icône volume on/off -->
</button>
```

### Toggle Audio
```javascript
const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value;
  // Redémarre le stream avec/sans audio
};
```

## 📊 Logs de Debug

Console logs pour monitoring:

### Initialisation
```
✅ FlacAudioPlayer context: 48000Hz
🎵 FlacAudioPlayer created (audio enabled)
```

### Streaming
```
🔊 Audio stream started: camera1
🎵 First audio chunk received: 4096 bytes
📦 FLAC decoded: 2ch, 48000Hz, 0.085s
🎵 Audio chunk 50 received: 4096 bytes
```

### Erreurs
```
❌ FLAC decode failed: DOMException
❌ FLAC decoder stall detected { lastReceived: 25, nextPlay: 0 }
```

## 🚀 Tests

### Vérifier l'Audio
1. Ouvrir http://localhost:3001
2. Se connecter avec Blue Iris
3. Sélectionner une caméra
4. Cliquer sur le bouton audio (🔊)
5. Vérifier console pour:
   - `🔊 Audio stream started`
   - `📦 FLAC decoded`
   - Pas d'erreurs `decodeAudioData()`

### Vérifier Sync Audio/Video
- Buffer audio: `flacPlayer.getBufferedMs()` devrait rester entre 200-700ms
- Latence acceptable: 200-1000ms entre vidéo et audio

## ⚠️ Limitations Actuelles

1. **Toggle Audio = Restart Stream**
   - Actuellement, toggle audio redémarre le stream complet
   - Amélioration future: mute/unmute sans reconnexion

2. **Pas de Volume Control**
   - FlacAudioPlayer n'a pas encore de GainNode
   - Amélioration future: `audioContext.createGain()` pour volume

3. **Pas de Fallback µ-law**
   - Si FLAC échoue, pas de fallback automatique vers audio=1
   - UI3 implémente `DoAudioDecodingFallback()` vers µ-law

## 🔮 Améliorations Futures

### 1. Volume Control
```javascript
this.gainNode = this.audioContext.createGain();
source.connect(this.gainNode);
this.gainNode.connect(this.audioContext.destination);
this.gainNode.gain.value = 0.5; // 50% volume
```

### 2. Mute sans Reconnexion
```javascript
// Pause audio playback sans fermer le stream
this.audioContext.suspend();

// Resume
this.audioContext.resume();
```

### 3. Fallback µ-law
```javascript
catch (err) {
  if (settings.audioCodec === 'FLAC') {
    console.warn('FLAC failed, switching to µ-law');
    settings.audioCodec = 'µ-law';
    // Redémarrer stream avec audio=1
  }
}
```

### 4. Visualisation Audio
```javascript
const analyser = audioContext.createAnalyser();
source.connect(analyser);
analyser.connect(destination);

const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteTimeDomainData(dataArray);
// Draw waveform...
```

## 📚 Références

### UI3 Source Code
- **PcmAudioPlayer**: Utilise `decodeAudioData()` pour FLAC
- **FetchH264VideoModule**: Gère streams vidéo + audio séparés
- **acceptFrame()**: Dispatch video/audio frames

### Web Audio API
- [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)

### Blue Iris
- Stream URL format: `/video/{camera}/2.0?audio={0|1|2}`
- `audio=2`: FLAC codec (décodable nativement)
- Sample rate: 48000Hz (typique)

## ✨ Conclusion

L'audio FLAC fonctionne **sans bibliothèque externe**! La clé était de:
1. ✅ Créer AudioContext avec le bon sampleRate (48kHz)
2. ✅ Utiliser `decodeAudioData()` directement
3. ✅ Maintenir l'ordre des buffers
4. ✅ Planifier la lecture temporellement

Cette approche est **identique à UI3** et garantit la compatibilité avec Blue Iris.

---

**Date**: 2025-01-XX  
**Version**: v1.0.0  
**Auteur**: GitHub Copilot
