import localize from '#utils/localize.js';
import type { MovementContext } from '#utils/movement/movementContext.js';

const PLACEHOLDER = /\{(spacesMovedThisTurn|targetsSpacesAway)\}/g;

function spacesText(count: number): string {
	return localize(`NIMBLE.chat.movementOffers.${count === 1 ? 'space' : 'spaces'}`, {
		count: String(count),
	});
}

/**
 * Fills a note's movement placeholders from the numbers stamped on its card.
 * One pass, so a target name that holds a placeholder is left as written. The
 * result is plain text and must be rendered as text.
 */
export function resolveMovementPlaceholders(
	text: string,
	context: MovementContext | null | undefined,
): string {
	if (!text) return text;
	return text.replace(PLACEHOLDER, (_match, key: string) => {
		if (key === 'spacesMovedThisTurn') {
			const moved = context?.spacesMovedThisTurn;
			return typeof moved === 'number'
				? String(moved)
				: localize('NIMBLE.chat.movementContext.unknown');
		}
		const targets = context?.targetsSpacesAway ?? [];
		if (!targets.length) return localize('NIMBLE.chat.movementContext.noTarget');
		return targets
			.map((target) =>
				localize('NIMBLE.chat.movementContext.targetSpacesAway', {
					name: target.name,
					distance: spacesText(target.spaces),
				}),
			)
			.join(', ');
	});
}
