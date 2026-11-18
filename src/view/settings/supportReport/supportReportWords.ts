import localize from '#utils/localize.js';

function supportWindowWord(key: string, data: Record<string, string | number> = {}): string {
	return localize(
		`NIMBLE.support.window.${key}`,
		Object.fromEntries(Object.entries(data).map(([name, value]) => [name, String(value)])),
	);
}

export { supportWindowWord };
