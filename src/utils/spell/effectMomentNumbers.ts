import type { EffectNode } from '#types/effectTree.js';
import {
	CARD_SELF_READER,
	CARD_TARGETS_READER,
	describeLastsUntil,
} from '#utils/lastsUntil/describeLastsUntil.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { raisableNumber } from '#utils/lastsUntil/raiseMoments.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type { TimeUnit } from '../../models/activeEffect/nimbleEffectChoices.js';

export interface ApplyEffectMomentNumbers {
	nodeId: string;
	label: string;
	/** The moments of the effect's Lasts Until that have a number, by index in it. */
	moments: { index: number; label: string; units: TimeUnit | 'turns' }[];
}

interface ItemWithEffects {
	system?: { activation?: { effects?: EffectNode[] } };
	effects?: { get(id: string): { name?: string; system?: unknown } | undefined } | null;
}

/**
 * The Apply Effect steps of an item's activation whose effect has a turn count or a time in its
 * Lasts Until, for an upcast step to lengthen.
 */
export function effectMomentNumbers(item: ItemWithEffects): ApplyEffectMomentNumbers[] {
	return flattenEffectsTree(item.system?.activation?.effects ?? []).flatMap((node) => {
		if (node.type !== 'applyEffect' || !node.effectId) return [];
		const effect = item.effects?.get(node.effectId);
		const lastsUntil = (effect?.system as { lastsUntil?: Moment[] } | undefined)?.lastsUntil ?? [];
		const reader = node.recipient === 'self' ? CARD_SELF_READER : CARD_TARGETS_READER;
		const moments = lastsUntil.flatMap((moment, index) =>
			raisableNumber(moment) === null
				? []
				: [
						{
							index,
							units: moment.kind === 'time' ? (moment.units ?? 'rounds') : ('turns' as const),
							label: describeLastsUntil({
								moments: [moment],
								reader,
								localize,
								format: localize,
							}),
						},
					],
		);
		if (!effect || !moments.length) return [];
		return [{ nodeId: node.id, label: effect.name ?? node.id, moments }];
	});
}
