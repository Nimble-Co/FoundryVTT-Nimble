/* eslint-disable no-console */
import * as fs from 'fs/promises';
import { globSync } from 'glob';
import JSZip from 'jszip';
import path from 'path';
import { createInterface } from 'readline/promises';

const PACK_DEST = './packs';

let CURRENT_PATHS = {};

async function getCurrentOrganizedFiles() {
  const folders = (await fs.readdir(PACK_DEST, { withFileTypes: true }))
    .filter((f) => f.isDirectory());

  const data = folders.reduce((acc, folder) => {
    const filePaths = globSync(`${folder.path}/${folder.name}/**/*.json`);

    const files = filePaths.map((p) => path.parse(p));

    acc[folder.name] = files;
    return acc;
  }, {});

  return data;
}

async function overrideFile(doc, filename, key) {
  const currentFiles = CURRENT_PATHS[key];
  /** @type {path.ParsedPath[]} */
  const files = currentFiles.filter((f) => f.name === filename);
  if (files.length === 0 || files.length > 1) {
    return [filename, key, files.length];
  }

  const filePath = path.format(files[0]);
  // Override the file.
  await fs.writeFile(filePath, JSON.stringify(doc, null, 2), { encoding: 'utf-8' });

  return null;
}

async function sortMigratedFiles() {
  const userInputReader = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const filePath = (await userInputReader
    .question('Enter the path to the zip file: ')).trim();

  console.log('FilePath: ', filePath);

  const zip = await new JSZip().loadAsync(await fs.readFile(filePath));
  CURRENT_PATHS = await getCurrentOrganizedFiles();

  // Iterate over each file in the zip.
  const promises = [];

  for await (const file of Object.values(zip.files)) {
    const textData = (await file.async('text')).trim();
    if (!textData.length) continue;

    const doc = JSON.parse(textData);

    const { type } = doc;
    const { name } = path.parse(file.name);

    if (type === 'soloMonster') promises.push(overrideFile(doc, name, 'adventuringGear'));

    else if (type === 'background') promises.push(overrideFile(doc, name, 'backgrounds'));
    else if (type === 'class') promises.push(overrideFile(doc, name, 'classes'));
    else if (type === 'object') promises.push(overrideFile(doc, name, 'adventuringGear'));
    else if (type === 'spell') promises.push(overrideFile(doc, name, 'spells'));
  }

  const failed = await Promise.all(promises);
  console.log('Failed: ', failed.filter(Boolean));

  process.exit(0);
}

try {
  await sortMigratedFiles();
} catch (e) {
  console.error(e);
  process.exit(1);
}
