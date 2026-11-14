import { SYSTEM_ID } from '#system';
import type { CritDiceSaveAction } from '#types/cardEvent.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import { refundRuleCharge, spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import {
	findPrimaryDamageNode,
	replaceDamageRollInRollsSource,
} from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '#utils/treeManipulation/reconstructEffectsTree.js';
import { DamageRoll } from '../../dice/DamageRoll.js';

/** On a save card: the attack card its result changes. */
export interface CritDiceSaveLink {
	attackMessageId: string;
	role: string;
	actorUuid: string;
	chargePoolIdentifier: string;
}

/** On the attack card: what the save did so far. */
export interface CritDiceSaveState {
	previous: number[] | null;
	usesBack: boolean;
}

type FlagDocument = {
	getFlag(scope: string, key: string): unknown;
	update(changes: Record<string, unknown>): Promise<unknown>;
	system: { activation?: { effects?: EffectNode[] } };
	rolls: unknown[];
	_source?: { rolls?: string[] };
};

const STATE_FLAG = 'critDiceSaveState';

/** What the save did so far to the attack card. */
export function critDiceSaveState(attack: Pick<FlagDocument, 'getFlag'>): CritDiceSaveState {
	return (
		(attack.getFlag(SYSTEM_ID, STATE_FLAG) as CritDiceSaveState | undefined) ?? {
			previous: null,
			usesBack: false,
		}
	);
}

async function changeDice(
	card: FlagDocument,
	change: (roll: DamageRoll) => void,
	state: CritDiceSaveState,
): Promise<void> {
	const activation = foundry.utils.deepClone(card.system.activation ?? { effects: [] });
	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const node = findPrimaryDamageNode(nodes) as (EffectNode & { roll?: object }) | undefined;
	if (!node?.roll) return;

	const roll = DamageRoll.fromData(foundry.utils.deepClone(node.roll) as never);
	change(roll);
	const json = roll.toJSON() as Record<string, unknown>;
	node.roll = json;
	(activation as { effects: unknown[] }).effects = reconstructEffectsTree(nodes) as unknown[];
	await card.update({
		rolls: replaceDamageRollInRollsSource((card._source?.rolls ?? []) as string[], json),
		'system.activation': activation,
		[`flags.${SYSTEM_ID}.${STATE_FLAG}`]: state,
	});
}

/**
 * The attack card and the use follow the result of a crit dice save: a failure sets the dice to
 * their max, a pass gives the use back, and a result that goes away undoes both.
 */
export async function settleCritDiceSave(
	link: CritDiceSaveLink,
	outcome: CritDiceSaveAction['outcome'],
): Promise<void> {
	const attack = game.messages?.get(link.attackMessageId) as FlagDocument | undefined;
	const actor = fromUuidSync(link.actorUuid as `Actor.${string}`) as Actor | null;
	if (!attack) return;

	const state = critDiceSaveState(attack);
	const wantsMax = outcome === 'fail';
	const wantsUseBack = outcome === 'pass';

	if (wantsUseBack !== state.usesBack) {
		if (wantsUseBack) await refundRuleCharge(actor, link.chargePoolIdentifier, 1);
		else await spendRuleCharge(actor, link.chargePoolIdentifier, 1);
	}

	const next: CritDiceSaveState = { previous: state.previous, usesBack: wantsUseBack };
	if (wantsMax && !state.previous) {
		await changeDice(
			attack,
			(roll) => {
				next.previous = roll.setRoleDiceToMax(link.role);
			},
			next,
		);
		return;
	}
	if (!wantsMax && state.previous) {
		const faces = state.previous;
		next.previous = null;
		await changeDice(attack, (roll) => roll.restoreRoleDice(link.role, faces), next);
		return;
	}
	await attack.update({ [`flags.${SYSTEM_ID}.${STATE_FLAG}`]: next });
}
