import type { DualWieldChoice, DualWieldKeep } from '#types/dualWield.d.ts';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import type { AttackDelivery } from '../../utils/damage/attackDelivery.js';
import {
	getDamageBonusFormulas,
	getDamageBonusTotal,
	hasWeaponProficiency,
} from '../../utils/damage/attackUtils.js';
import {
	dualWieldEntry,
	dualWieldRecord,
	dualWieldRollOptions,
	keepChoiceOfWeapon,
	rollModeOfWeapon,
} from '../../utils/damage/dualWield.js';
import { normalizeDamageRollFormula } from '../../utils/damage/normalizeDamageRollFormula.js';
import type { IncomingReactionEntry } from '../../utils/incomingReactions/incomingReactionEntry.js';
import localize from '../../utils/localize.js';
import { canShowDiceAnimation, showDiceAnimation } from '../../utils/rolls/showDiceAnimation.js';

/** The roll mode of the activated weapon: the same when there is no other weapon. */
export function activatedWeaponRollMode(
	rollMode: number,
	choice: DualWieldChoice | undefined,
): number {
	if (!choice?.otherItemUuid) return rollMode;
	return rollModeOfWeapon(rollMode, choice.extraDieOn, 'activated');
}

/**
 * Roll the other weapon of a dual wield attack and leave the choice for the
 * card. It keeps its own formula, damage type and item bonuses. On-hit effects
 * stay with the activated weapon.
 */
export async function rollOtherWeapon(input: {
	actor: Parameters<typeof getDamageBonusTotal>[0];
	item: { uuid?: string | null; name: string };
	DamageRollClass: typeof DamageRoll;
	first: DamageRoll;
	firstFormula: string;
	firstOptions: DamageRoll.Options;
	choice: DualWieldChoice;
	context: {
		rollData: DamageRoll.Data;
		rollMode: number;
		delivery: AttackDelivery;
		source: never;
		targetDomain: never;
		damageType: string;
	};
}): Promise<DualWieldKeep | null> {
	const { actor, first, firstFormula, firstOptions, choice, context } = input;
	const item = fromUuidSync(choice.otherItemUuid as `Item.${string}`) as {
		uuid: string;
		name: string;
		identifier: string;
		system: {
			activation?: {
				effects?: Array<{
					type?: string;
					formula?: string;
					damageType?: string;
					canCrit?: boolean;
					canMiss?: boolean;
				}>;
			};
		};
	} | null;
	const node = item?.system.activation?.effects?.find((each) => each.type === 'damage');
	if (!item || !node?.formula) return null;

	const damageType = node.damageType ?? '';
	let formula = normalizeDamageRollFormula(node.formula);
	if (context.delivery) {
		const flat = getDamageBonusTotal(
			actor,
			context.delivery,
			context.source,
			damageType,
			context.targetDomain,
			item.identifier,
		);
		if (flat > 0) formula = `${formula} + ${flat}`;
		for (const dice of getDamageBonusFormulas(
			actor,
			context.delivery,
			context.source,
			damageType,
			context.targetDomain,
			item.identifier,
		)) {
			formula = `${formula} + ${dice}`;
		}
	}

	const rollMode = rollModeOfWeapon(context.rollMode, choice.extraDieOn, 'other');
	const self = {
		itemUuid: input.item.uuid ?? '',
		label: input.item.name,
		damageType: context.damageType,
	};
	const otherSelf = { itemUuid: item.uuid, label: item.name, damageType };
	const otherOptions = {
		...firstOptions,
		rollMode,
		canCrit:
			firstOptions.canCrit &&
			node.canCrit !== false &&
			hasWeaponProficiency(actor as never, item as never),
		canMiss: firstOptions.canMiss && node.canMiss !== false,
		damageType,
	};
	first.options = dualWieldRollOptions(first.options as never, self, {
		...otherSelf,
		formula,
		options: otherOptions as never,
	}) as never;
	const second = new input.DamageRollClass(
		formula,
		context.rollData,
		dualWieldRollOptions(otherOptions as never, otherSelf, {
			...self,
			formula: firstFormula,
			options: firstOptions as never,
		}) as never,
	);
	await second.evaluate();
	if (canShowDiceAnimation()) await showDiceAnimation(second as never);

	const entryInput = {
		actorUuid: (actor as { uuid?: string } | null)?.uuid ?? '',
		itemUuid: item.uuid,
		label: localize('NIMBLE.rollWindow.dualWield.name'),
	};
	const entry = dualWieldEntry(entryInput) as IncomingReactionEntry;
	return {
		entry,
		pendingKeep: {
			entryId: entry.id,
			chooserUuid: entryInput.actorUuid,
			roll: second.toJSON(),
			reroll: dualWieldRecord({ ...entryInput, entryId: entry.id }),
			old: keepChoiceOfWeapon(first as never),
			new: keepChoiceOfWeapon(second as never),
			discardedCritTriggers: false,
		},
	};
}
