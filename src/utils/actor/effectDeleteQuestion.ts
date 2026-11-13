import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import { poolsLostOnEnd } from '#utils/dicePool/poolsEmptiedAtEnd.js';
import localize from '#utils/localize.js';

interface ItemEffect {
	id?: string | null;
	name?: string | null;
	transfer?: boolean;
}

export interface DeletedEffect {
	name?: string | null;
	origin?: string | null;
	parent?: { documentName?: string } | null;
}

interface OriginItem {
	documentName?: string;
	effects?: Iterable<ItemEffect> & { get(id: string): ItemEffect | undefined | null };
}

function originItemOf(effect: DeletedEffect): OriginItem | null {
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as never, { strict: false }) as OriginItem | null;
	return origin?.documentName === 'Item' ? origin : null;
}

/** The origin item still has the effect, so a new use of the item gives it again. */
function givenAgain(item: OriginItem | null, effect: DeletedEffect): boolean {
	if (!item?.effects) return false;
	return [...item.effects].some(
		(each) => each.name === effect.name && !!itemEffectOf(item as never, each.id),
	);
}

/**
 * The lines of the confirm before an effect is deleted, or null when it goes with no question.
 * An effect from an item that cannot give it again warns that it cannot come back; each pool
 * that the end empties gets a line.
 */
export function effectDeleteQuestion(effect: DeletedEffect): string[] | null {
	const name = effect.name ?? '';
	const pools = poolsLostOnEnd(effect as never).map((pool) =>
		localize('NIMBLE.ui.effectPoolLost', { pool }),
	);
	const originItem = originItemOf(effect);
	const fromItem = effect.parent?.documentName === 'Item' || !!originItem;
	if (!fromItem && pools.length < 1) return null;
	const first =
		fromItem && !givenAgain(originItem, effect)
			? localize('NIMBLE.ui.removeEffectConfirmation', { name })
			: localize('NIMBLE.ui.removeEffectQuestion', { name });
	return [first, ...pools];
}
