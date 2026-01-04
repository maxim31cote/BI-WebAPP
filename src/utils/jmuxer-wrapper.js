/**
 * Wrapper ES6 pour JMuxer UI3 (format UMD)
 */

// Importer le script UMD qui définit window.JMuxer
import './jmuxer-h265.js';

// Exporter la classe JMuxer disponible globalement
export default window.JMuxer || globalThis.JMuxer;
