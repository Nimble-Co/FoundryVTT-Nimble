import type { MoveNode } from '#types/effectTree.js';
import { evaluateFormula } from '../evaluateFormula.js';

interface RecipientActor {
	getRollData(): Record<string, unknown>;
	system?: {
		attributes?: { movement?: { walk?: number }; sizeCategory?: string };
	};
}

/**
 * The offered distance in spaces for one recipient: the size override when
 * the node has one for the recipient's size, else the base formula, resolved
 * against the recipient's roll data with `@speed` as its walk speed.
 */
export function resolveMoveDistance(
	node: Pick<MoveNode, 'distance' | 'distanceBySize'>,
	recipient: RecipientActor,
): number {
	const size = recipient.system?.attributes?.sizeCategory ?? '';
	const formula = node.distanceBySize?.[size]?.trim() || node.distance;
	if (!formula) return 0;

	const rollData = () => ({
		...recipient.getRollData(),
		speed: recipient.system?.attributes?.movement?.walk ?? 0,
	});
	const resolved = evaluateFormula(formula, { getRollData: rollData });
	try {
		const value = Roll.safeEval(resolved);
		return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	} catch {
		return 0;
	}
}
