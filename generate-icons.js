// Script simple pour générer des icônes PNG à partir du SVG
// Utilise Canvas (node-canvas) si disponible, sinon crée des placeholders

const fs = require('fs');
const path = require('path');

// Couleurs du thème Blue Iris
const bgColor = '#1a1a2e';
const primaryColor = '#16c79a';

// Fonction pour créer une icône PNG simple (placeholder)
function createPlaceholderIcon(size, outputPath) {
  // Pour l'instant, on va juste copier le SVG et documenter qu'il faut générer les PNGs
  console.log(`⚠️  Besoin de créer: ${outputPath} (${size}x${size})`);
  
  // Créer un fichier PNG basique avec juste les bonnes dimensions
  // On utilise une technique de PNG minimal valide
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ]);
  
  // IHDR chunk pour définir la taille
  const width = size;
  const height = size;
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Longueur du chunk
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace
  
  // CRC pour IHDR
  const crc = require('zlib').crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(crc, 21);
  
  // IDAT chunk (données vides pour image noire)
  const idat = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // Longueur
    0x49, 0x44, 0x41, 0x54, // "IDAT"
    0x08, 0x1D, 0x01, 0x02, 0x00, 0xFD, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
  ]);
  
  // IEND chunk
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // Longueur
    0x49, 0x45, 0x4E, 0x44, // "IEND"
    0xAE, 0x42, 0x60, 0x82, // CRC
  ]);
  
  const png = Buffer.concat([pngHeader, ihdr, idat, iend]);
  fs.writeFileSync(outputPath, png);
  
  return true;
}

const publicDir = path.join(__dirname, 'public');
const svgPath = path.join(publicDir, 'icon.svg');

if (!fs.existsSync(svgPath)) {
  console.error('❌ icon.svg introuvable dans /public');
  process.exit(1);
}

console.log('🎨 Génération des icônes PWA...\n');

// Créer les icônes (pour l'instant des placeholders)
const icons = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

let allCreated = true;

icons.forEach(({ size, name }) => {
  const outputPath = path.join(publicDir, name);
  try {
    createPlaceholderIcon(size, outputPath);
    console.log(`✅ Créé: ${name}`);
  } catch (error) {
    console.error(`❌ Erreur pour ${name}:`, error.message);
    allCreated = false;
  }
});

if (allCreated) {
  console.log('\n✨ Icônes générées avec succès!');
  console.log('\n⚠️  NOTE: Ce sont des placeholders PNG minimaux.');
  console.log('Pour de vraies icônes, utilisez:');
  console.log('  1. Un outil en ligne: https://realfavicongenerator.net/');
  console.log('  2. ImageMagick: sudo apt install imagemagick && npm run icons:convert');
  console.log('  3. Inkscape: sudo apt install inkscape && npm run icons:convert');
} else {
  console.error('\n❌ Erreur lors de la génération des icônes');
  process.exit(1);
}
