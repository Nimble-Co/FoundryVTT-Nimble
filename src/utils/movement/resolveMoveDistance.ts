import type { MoveNode } from '#types/effectTree.js';
import type { OfferActor } from '#types/movement.js';

/**
 * The offered distance in spaces for one recipient. The formula reads the
 * feature user's roll data, with `@speed` as the recipient's walk speed; a
 * size override keyed by the recipient's size replaces the formula.
 */
export function resolveMoveDistance(
	node: Pick<MoveNode, 'distance' | 'distanceBySize'>,
	source: OfferActor,
	recipient: OfferActor,
): number {
	const size = recipient.system?.attributes?.sizeCategory ?? '';
	const formula = node.distanceBySize?.[size]?.trim() || node.distance;
	if (!formula) return 0;

	const rollData = {
		...source.getRollData(),
		speed: recipient.system?.attributes?.movement?.walk ?? 0,
	};
	try {
		const value = Roll.safeEval(Roll.replaceFormulaData(formula, rollData, { missing: '0' }));
		return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	} catch (error) {
		console.warn(`Nimble | Could not work out the movement distance formula "${formula}".`, error);
		return 0;
	}
}
