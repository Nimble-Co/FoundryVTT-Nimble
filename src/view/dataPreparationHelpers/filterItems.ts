import type { NimbleCharacter } from '../../documents/actor/character.js';

export default function filterItems(
	actor: NimbleCharacter,
	requiredItemTypes: string[],
	searchTerm: string,
) {
	return actor.items.filter((item) => {
		if (!requiredItemTypes.includes(item.type)) return false;
		if (!searchTerm) return true;

		return item.name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase());
	});
}
