/* eslint-disable import/extensions */
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import url from 'url';
import IdBuilder from './lib/IdBuilder.mjs';
import Pack from './lib/Pack.mjs';

// ---------------------------------------------------
//
// ---------------------------------------------------

console.log('[INFO] - Starting build process.');

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const dataPath = path.resolve(dirName, '../packs');
const dirPaths = fs.readdirSync(dataPath)
  .map((name) => path.resolve(dataPath, name))
  .filter((filePath) => {
    // Filter out hidden files (like .DS_Store) and JSON files
    const basename = path.basename(filePath);
    if (basename.startsWith('.') || basename.endsWith('.json')) {
      return false;
    }
    // Only process directories
    const stats = fs.statSync(filePath);
    return stats.isDirectory();
  });

console.log('[INFO] - Validating and Updating document ids.');
const idBuilder = new IdBuilder();
idBuilder.loadIds();

console.log(`[INFO] - Loading ${dirPaths.length} packs.`);
const packs = dirPaths.map((pack) => Pack.loadJSONFiles(pack));

console.log(`[INFO] - Loaded ${packs.length} packs.`);

const counts = await Promise.all(packs.map((p) => p.saveAsPack()));
const totalCount = counts.reduce((acc, curr) => acc + curr, 0);

console.log(`[INFO] - Successfully built ${counts.length} packs with a total of ${totalCount} documents.`);
console.log(`[INFO] - ${idBuilder.summary}`);
