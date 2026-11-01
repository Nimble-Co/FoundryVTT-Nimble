import type { RollStat } from '#types/rollStat.d.ts';
import type { RollToReroll } from './rollToReroll.js';

const ROLL_STATS = ['strength', 'dexterity', 'intelligence', 'will'] as const;

const statReference = (stat: string) => new RegExp(`@${stat}(?![\\w.])`, 'g');

/** The stats a formula refers to, in stat order. `@key` is no named stat, and a number is none. */
function statsInFormula(formula: string | null | undefined): RollStat[] {
	if (!formula) return [];
	return ROLL_STATS.filter((stat) => statReference(stat).test(formula));
}

/** The formula with one stat's references changed to another stat. */
function swapStatInFormula(formula: string, from: string, to: string): string {
	return formula.replace(statReference(from), `@${to}`);
}

/** The stats a roll is related to. Initiative is related to none. */
function statsOfRoll(roll: RollToReroll): readonly string[] {
	if (roll.kind === 'attack') return roll.stats ?? [];
	if (roll.kind === 'initiative') return [];
	if (roll.kind === 'skillCheck') {
		const stat = (CONFIG.NIMBLE.defaultSkillAbilities as Record<string, string>)[roll.key];
		return stat ? [stat] : [];
	}
	return [roll.key];
}

function signedPart(value: number, label: string): string {
	return `${value < 0 ? '-' : '+'} ${Math.abs(value)}[${label}]`;
}

/**
 * A check formula with its labelled modifier moved by `delta` and renamed. A
 * formula with no such part gets a new one, so the total is right either way.
 */
function moveLabelledModifier(formula: string, from: string, to: string, delta: number): string {
	const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const part = new RegExp(`\\s*([+-])\\s*(\\d+)\\[${escaped}\\]`);
	const match = part.exec(formula);
	if (!match) return delta === 0 ? formula : `${formula} ${signedPart(delta, to)}`;
	const value = (match[1] === '-' ? -1 : 1) * Number(match[2]) + delta;
	return formula.replace(part, value === 0 ? '' : ` ${signedPart(value, to)}`);
}

export { moveLabelledModifier, ROLL_STATS, statsInFormula, statsOfRoll, swapStatInFormula };
