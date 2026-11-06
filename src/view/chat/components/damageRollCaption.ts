import localize from '#utils/localize.js';

type DamageOutcome = 'fullDamage' | 'halfDamage' | 'noDamage' | string | undefined;

/** The part of the roll total that a damage outcome counts. A miss shows the roll as it is. */
function damageOutcomeMultiplier(outcome: DamageOutcome = 'fullDamage'): number {
	if (outcome === 'fullDamage' || outcome === 'noDamage') return 1;
	if (outcome === 'halfDamage') return 0.5;
	return 0;
}

function rollModeText(rollMode: number): string {
	if (rollMode >= 1)
		return localize('NIMBLE.chat.damageRoll.advantage', { count: String(rollMode) });
	if (rollMode <= -1) {
		return localize('NIMBLE.chat.damageRoll.disadvantage', { count: String(Math.abs(rollMode)) });
	}
	return '';
}

function outcomeText(outcome: DamageOutcome, ignoreArmor: boolean): string {
	if (outcome === 'halfDamage') {
		return localize(
			ignoreArmor
				? 'NIMBLE.chat.damageRoll.halfDamageIgnoresArmor'
				: 'NIMBLE.chat.damageRoll.halfDamage',
		);
	}
	// A miss says no "No Damage": the card header shows "Miss".
	const showsArmor = ignoreArmor && (outcome === 'fullDamage' || outcome === 'noDamage');
	return showsArmor ? localize('NIMBLE.chat.damageRoll.ignoresArmor') : '';
}

/** The line under a damage roll: its roll mode, what its outcome changes, and a damage multiplier. */
function damageRollCaption(input: {
	outcome: DamageOutcome;
	ignoreArmor: boolean;
	rollMode: number;
	damageMultiplier: number;
}): string {
	const parts = [
		rollModeText(Number(input.rollMode) || 0),
		outcomeText(input.outcome, input.ignoreArmor),
	];
	if (input.damageMultiplier !== 1) {
		parts.push(
			localize('NIMBLE.rules.damageMultiplier.onCard', {
				multiplier: String(input.damageMultiplier),
			}),
		);
	}
	return parts.filter(Boolean).join(' ');
}

export { damageOutcomeMultiplier, damageRollCaption };
