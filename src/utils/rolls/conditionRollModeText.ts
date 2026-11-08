import type { ConditionRollMode } from '#types/conditionRollMode.d.ts';
import localize from '../localize.js';

const TEXT = 'NIMBLE.conditionRollMode';

type ConditionLine = Pick<ConditionRollMode, 'condition' | 'side' | 'step' | 'name' | 'ask'>;

/** The text key of a Prone target line, or null for any other line. */
function proneKey(line: ConditionLine): 'proneMelee' | 'proneRanged' | null {
	if (line.side !== 'target' || line.condition !== 'prone') return null;
	return line.step > 0 ? 'proneMelee' : 'proneRanged';
}

/** "Blinded (Goblin)", with the part the table decides when the line has one. */
function conditionRollModeLabel(line: ConditionLine): string {
	const data = {
		condition: localize(`NIMBLE.conditions.${line.condition}`),
		name: line.name,
	};
	const prone = proneKey(line);
	if (prone) return localize(`${TEXT}.${prone}`, data);
	if (line.ask) return localize(`${TEXT}.${line.ask}`, data);
	return localize(`${TEXT}.label`, data);
}

/** What the rule says, for a tooltip. */
function conditionRollModeRule(line: ConditionLine): string {
	const prone = proneKey(line);
	if (prone) return localize(`${TEXT}.target.${prone}`);
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

export { conditionRollModeLabel, conditionRollModeTag };
