import en from '../../public/lang/en.json';

type Tree = { [key: string]: string | Tree };

function lookup(key: string): string | undefined {
	let node: string | Tree | undefined = en as Tree;
	for (const part of key.split('.')) {
		if (typeof node !== 'object') return undefined;
		node = node[part];
	}
	return typeof node === 'string' ? node : undefined;
}

function localize(key: string): string {
	const text = lookup(key);
	if (text !== undefined) return text;
	console.error(`No string in public/lang/en.json for ${key}`);
	return key;
}

// The same substitution as Foundry's Localization#format.
function format(key: string, data: Record<string, string> = {}): string {
	return localize(key).replace(/{[^}]+}/g, (match) => data[match.slice(1, -1)] ?? match);
}

/** `game.i18n` with the English strings, so a part can call the localize helper with no Foundry. */
export function installI18n() {
	Object.assign(globalThis, {
		game: { i18n: { localize, format, has: (key: string) => lookup(key) !== undefined } },
	});
}
