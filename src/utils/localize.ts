import isObject from './isObject.js';

export default function localize(stringId: string, data?: Record<string, string | number>) {
	const result = !isObject(data)
		? game.i18n.localize(stringId)
		: game.i18n.format(stringId, data as Record<string, string>);

	return result !== undefined ? result : '';
}
