import type { MoveNode } from '#types/effectTree.js';
import { evaluateFormula } from '../evaluateFormula.js';

interface RollDataActor {
	getRollData(): Record<string, unknown>;
	system?: { attributes?: { movement?: { walk?: number }; sizeCategory?: string } };
}

/**
 * The offered distance in spaces for one recipient. The formula reads the
 * feature user's roll data, with `@speed` as the recipient's walk speed; a
 * size override keyed by the recipient's size replaces the formula.
 */
export function resolveMoveDistance(
	node: Pick<MoveNode, 'distance' | 'distanceBySize'>,
	source: RollDataActor,
	recipient: RollDataActor,
): number {
	const size = recipient.system?.attributes?.sizeCategory ?? '';
	const formula = node.distanceBySize?.[size]?.trim() || node.distance;
	if (!formula) return 0;

	const rollData = () => ({
		...source.getRollData(),
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
