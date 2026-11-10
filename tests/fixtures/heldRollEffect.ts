import type { HeldAppliesTo, HeldChangeKind } from '#types/heldChange.d.ts';

/** One Held Roll rule source. */
export interface HeldRollSpec {
	kind?: HeldChangeKind;
	value?: number;
	label?: string;
	whichRoll?: HeldAppliesTo;
	usedUp?: boolean;
	meleeOnly?: boolean;
	fromSourceOnly?: boolean;
	damageType?: string;
	formula?: string;
	ruleDisabled?: boolean;
}

/** An effect that holds Held Roll rules. */
export interface HeldRollEffectSpec extends HeldRollSpec {
	origin?: string | null;
	messageId?: string;
	disabled?: boolean;
	active?: boolean;
	/** More Held Roll rules on the same effect. */
	moreRules?: HeldRollSpec[];
}

/** The source data of a Held Roll rule, as it is in `effect.system.rules`. */
export function heldRollSource(id: string, spec: HeldRollSpec = {}, fallbackLabel = '') {
	return {
		id,
		type: 'heldRoll',
		label: spec.label ?? fallbackLabel,
		heldKind: spec.kind ?? 'primaryDie',
		value: spec.value ?? 1,
		whichRoll: spec.whichRoll ?? 'attacksOnHolder',
		usedUp: spec.usedUp ?? true,
		meleeOnly: spec.meleeOnly ?? false,
		fromSourceOnly: spec.fromSourceOnly ?? false,
		damageType: spec.damageType ?? '',
		formula: spec.formula ?? '',
		disabled: spec.ruleDisabled ?? false,
	};
}

/** An effect with Held Roll rules, as a Held Change is on a creature. */
export function heldRollEffect(id: string, spec: HeldRollEffectSpec = {}) {
	const label = spec.label ?? 'Create an Opening';
	const extra = (spec.moreRules ?? []).map((more, index) =>
		heldRollSource(`${id}-rule${index + 1}`, more, label),
	);
	return {
		id,
		name: label,
		origin: spec.origin ?? null,
		disabled: spec.disabled ?? false,
		...(spec.active === undefined ? {} : { active: spec.active }),
		system: { rules: [heldRollSource(`${id}-rule`, spec, label), ...extra] },
		flags: spec.messageId ? { nimble: { heldChangeMessage: spec.messageId } } : {},
	};
}
