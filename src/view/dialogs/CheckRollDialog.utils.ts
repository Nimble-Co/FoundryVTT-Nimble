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
	/** Ticked when the window opens: only the tags of this roll make the rule apply. */
	on: boolean;
}

interface RollingActor {
	rules?: unknown[];
	getDomain?(): Set<string>;
}

export interface SituationalRollContext {
	type: RollDialogType;
	abilityKey?: string | undefined;
	saveKey?: string | undefined;
	skillKey?: string | undefined;
	/** Tags of this roll for rule predicates, such as `save:keep:concentration`. */
	rollTags?: readonly string[] | undefined;
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
 * target key match the roll, and its value is non-zero. The predicate also reads the
 * roll's own tags; an adjustment that only those tags make apply starts ticked.
 */
export function getSituationalRollModeOptions(
	actor: RollingActor | null | undefined,
	context: SituationalRollContext,
): SituationalRollModeOption[] {
	if (!actor) return [];

	const rules = (actor.rules ?? []) as SituationalRollModeRule[];
	const targetKey = targetKeyFor(context);
	const tags = context.rollTags ?? [];
	const domain = tags.length ? [...(actor.getDomain?.() ?? []), ...tags] : undefined;

	const options: SituationalRollModeOption[] = [];
	for (const rule of rules) {
		if (rule.type !== 'situationalRollMode') continue;
		if (!rule.offersAdjustment()) continue;
		if (!rule.matchesRoll(context.type, targetKey)) continue;
		if (!rule.appliesTo(domain)) continue;

		options.push({
			key: `${rule.parentDocument?.uuid ?? ''}:${rule.id}`,
			label:
				rule.label || rule.parentDocument?.name || localize('NIMBLE.ruleTypes.situationalRollMode'),
			icon: rule.iconPath(),
			value: rule.perStack ? rule.value * rule.stacks : rule.value,
			on: !!domain && !rule.appliesTo(),
		});
	}

	return options;
}
