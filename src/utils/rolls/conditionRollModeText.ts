import localize from '../localize.js';
import type { ConditionRollMode } from './conditionRollModes.js';

const TEXT = 'NIMBLE.conditionRollMode';

type ConditionLine = Pick<ConditionRollMode, 'condition' | 'side' | 'step' | 'name' | 'ask'>;

function isProne(line: ConditionLine): boolean {
	return line.side === 'target' && line.condition === 'prone';
}

/** "Blinded (Goblin)", with the part the table decides when the line has one. */
function conditionRollModeLabel(line: ConditionLine): string {
	const data = {
		condition: localize(`NIMBLE.conditions.${line.condition}`),
		name: line.name,
	};
	if (isProne(line)) {
		return localize(`${TEXT}.${line.step > 0 ? 'proneMelee' : 'proneRanged'}`, data);
	}
	if (line.ask) return localize(`${TEXT}.${line.ask}`, data);
	return localize(`${TEXT}.label`, data);
}

/** What the rule says, for a tooltip. */
function conditionRollModeRule(line: ConditionLine): string {
	if (isProne(line)) {
		return localize(`${TEXT}.target.${line.step > 0 ? 'proneMelee' : 'proneRanged'}`);
	}
	return localize(`${TEXT}.${line.side}.${line.condition}`);
}

/** A card tag: "Advantage: Blinded (Goblin)", with the rule as its tooltip. */
function conditionRollModeTag(line: ConditionLine): { label: string; tooltip: string } {
	return {
		label: localize(`${TEXT}.tag`, {
			mode: localize(`${TEXT}.${line.step > 0 ? 'advantage' : 'disadvantage'}`),
			label: conditionRollModeLabel(line),
		}),
		tooltip: conditionRollModeRule(line),
	};
}

export { conditionRollModeLabel, conditionRollModeRule, conditionRollModeTag };
