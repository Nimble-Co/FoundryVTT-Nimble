import fs from 'node:fs';

/** A pack file has no final newline. When that is the only difference, the file stays as it is. */
export function writePackFile(file, source) {
	const text = JSON.stringify(source, null, '\t');
	if (fs.readFileSync(file, 'utf-8').trimEnd() === text) return false;
	fs.writeFileSync(file, text, { encoding: 'utf-8' });
	return true;
}
