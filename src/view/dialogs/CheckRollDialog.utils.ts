import type { RollDialogType } from '#types/components/CheckRollDialog.d.ts';
import type { SituationalRollModeRule } from '../../models/rules/situationalRollMode.js';
import localize from '../../utils/localize.js';

/**
 * Discovery helper for the `situationalRollMode` rule. The check roll dialog uses it to
 * list the roll mode adjustments the roller can opt into for the roll being configured.
 */

export interface SituationalRollModeOption {
	/**
	 * Stable per-roll key for the dialog's selection map and `{#each}`. Rule ids are
	 * only unique within an item, so two copies of the same item (or copy-pasted
	 * homebrew) would collide on `rule.id` alone; scoping by the owning item's uuid
	 * keeps them distinct.
	 */
	key: string;
	label: string;
	/** Image path for the icon shown beside the option: the granting item's artwork. */
	icon: string;
	/** Roll mode adjustment: positive for advantage, negative for disadvantage. */
	value: number;
}

interface RollingActor {
	rules?: unknown[];
}

export interface SituationalRollContext {
	type: RollDialogType;
	abilityKey?: string | undefined;
	saveKey?: string | undefined;
	skillKey?: string | undefined;
}

function targetKeyFor(context: SituationalRollContext): string | undefined {
	switch (context.type) {
		case 'savingThrow':
			return context.saveKey;
		case 'abilityCheck':
			return context.abilityKey;
		case 'skillCheck':
			return context.skillKey;
		default:
			return undefined;
	}
}

/**
 * Returns the situational adjustments offered to `actor` for the roll described by
 * `context`. An adjustment is offered when its predicate passes, its check type and
 * target key match the roll, and its value is non-zero.
 */
export function getSituationalRollModeOptions(
	actor: RollingActor | null | undefined,
	context: SituationalRollContext,
): SituationalRollModeOption[] {
	if (!actor) return [];

	const rules = (actor.rules ?? []) as SituationalRollModeRule[];
	const targetKey = targetKeyFor(context);

	const options: SituationalRollModeOption[] = [];
	for (const rule of rules) {
		if (rule.type !== 'situationalRollMode') continue;
		if (!rule.offersAdjustment()) continue;
		if (!rule.matchesRoll(context.type, targetKey)) continue;
		if (!rule.appliesTo()) continue;

		options.push({
			key: `${rule.item?.uuid ?? ''}:${rule.id}`,
			label: rule.label || rule.item?.name || localize('NIMBLE.ruleTypes.situationalRollMode'),
			icon: rule.iconPath(),
			value: rule.value,
		});
	}

	return options;
}
