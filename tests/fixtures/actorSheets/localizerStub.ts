import en from '../../../public/lang/en.json';
import type { Format, Localize } from '../../../src/view/actorSheets/shared/sheetSource.ts';

type Tree = { [key: string]: string | Tree };

function hasKey(key: string): boolean {
	let node: string | Tree | undefined = en as Tree;
	for (const part of key.split('.')) {
		if (typeof node !== 'object') return false;
		node = node[part];
	}
	return typeof node === 'string';
}

function check(key: string): void {
	if (!hasKey(key)) throw new Error(`No string in public/lang/en.json for ${key}`);
}

/**
 * The localizer of the view-model tests. It gives back the key, and for `format` the key and its
 * data, so a test can check which words a view picks. A key that is not in `en.json` throws.
 */
export function createLocalizerStub(): { localize: Localize; format: Format } {
	return {
		localize: (key) => {
			check(key);
			return key;
		},
		format: (key, data) => {
			check(key);
			return `${key} ${JSON.stringify(data)}`;
		},
	};
}
