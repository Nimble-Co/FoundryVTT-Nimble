import { SYSTEM_ID, systemHookName } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { refundRuleCharge, spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import {
	findPrimaryDamageNode,
	replaceDamageRollInRollsSource,
} from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import { registerRollSaveQuery } from '#utils/rolls/rollSaveWithOwner.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '#utils/treeManipulation/reconstructEffectsTree.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

/** On a save card: the attack card its result changes. */
interface CritDiceSaveLink {
	attackMessageId: string;
	role: string;
	actorUuid: string;
	chargePoolIdentifier: string;
}

/** On the attack card: what the save did so far. */
interface CritDiceSaveState {
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
 * The save of a crit dice rule has a result: a failure sets the dice to their
 * max, a pass gives the use back, and a result that goes away undoes both.
 */
async function followSave(payload: NimbleSavePayload): Promise<void> {
	if (!game.user?.isGM) return;
	const saveCard = game.messages?.get(payload.messageId ?? '') as FlagDocument | undefined;
	const link = saveCard?.getFlag(SYSTEM_ID, 'critDiceSave') as CritDiceSaveLink | undefined;
	if (!link) return;
	const attack = game.messages?.get(link.attackMessageId) as FlagDocument | undefined;
	const actor = fromUuidSync(link.actorUuid as `Actor.${string}`) as Actor | null;
	if (!attack) return;

	const state = (attack.getFlag(SYSTEM_ID, STATE_FLAG) as CritDiceSaveState | undefined) ?? {
		previous: null,
		usesBack: false,
	};
	const wantsMax = payload.outcome === 'fail';
	const wantsUseBack = payload.outcome === 'pass';

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

let didRegister = false;

export function registerCritDiceSaveHooks(): void {
	if (didRegister) return;
	didRegister = true;
	registerRollSaveQuery();
	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.on(systemHookName('saveResolved'), (payload: NimbleSavePayload) => {
		void followSave(payload).catch((error) => {
			console.error('Nimble | A save could not change the dice of its attack.', error);
		});
	});
}
