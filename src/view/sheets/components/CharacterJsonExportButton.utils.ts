/**
 * Serialize a player character (with all embedded documents) and trigger a
 * JSON file download.
 *
 * Mirrors Foundry core's exportToJSON, which hardcodes its filename
 * (fvtt-Actor-<name>-<id>); we serialize the same way but name the file
 * fvtt-<system>-<character>-<classes> instead. Note exportSource lives under
 * _stats since v13 (flags.exportSource is a read-only deprecation shim).
 */

import type { NimbleCharacter } from '#documents/actor/character.js';

export function exportCharacterToJson(actor: NimbleCharacter): void {
	const data = actor.toCompendium(null, { clearSource: false });
	const stats = (data._stats ?? {}) as Record<string, unknown>;
	stats.exportSource = {
		worldId: game.world.id,
		uuid: actor.uuid,
		coreVersion: game.version,
		systemId: game.system.id,
		systemVersion: game.system.version,
	};
	(data as Record<string, unknown>)._stats = stats;

	const classNames = Object.values(actor.classes ?? {}).map((cls) => cls.name);
	const filename = ['fvtt', game.system.id, actor.name, ...classNames]
		.map((part) => part?.slugify({ strict: true }))
		.filterJoin('-');

	foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), 'text/json', `${filename}.json`);
}
