import type { RollDetailLine } from '#types/components/RollSummary.d.ts';
import type { DamageNodeSource, DamagePart } from '#types/damagePart.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import { displayFormula } from '#utils/rolls/displayFormula.ts';
import { docLink, type LinkedData, type LinkedPart, linkedParts, partsText } from '#utils/documents/docLink.ts';
import localize from '../../../utils/localize.js';

export interface DamageRollDetailOptions {
	canCrit?: boolean;
	canMiss?: boolean;
	primaryDieValue?: string | number;
	primaryDieModifier?: string | number;
	primaryDieBaseResult?: number;
	primaryDieBonusOff?: boolean;
	damageParts?: readonly DamagePart[];
	[key: string]: unknown;
}

export interface DamageRollDetailsInput {
	rollOptions?: DamageRollDetailOptions | null;
	roll?: { terms?: readonly unknown[] | null } | null;
	/** The card's Primary Die Bonus lines, to name who added the Primary Die bonus. */
	primaryDieBonuses?: readonly PrimaryDieBonusLine[];
	/** Why the Primary Die bonus is not on the die, when it is not. */
	bonusNotAdded?: string | null;
	/** The feature that made this damage box. */
	source?: DamageNodeSource | null;
}

interface SerializedTerm {
	class?: string;
	operator?: string;
	number?: number;
	result?: number;
	total?: number;
	roll?: { total?: number } | null;
	results?: Array<{ result: number; active?: boolean; discarded?: boolean }>;
	options?: { flavor?: string; dieRole?: string };
}

const TEXT = 'NIMBLE.chat.damageParts';

function signed(value: number): string {
	return value < 0 ? `-${Math.abs(value)}` : `+${value}`;
}

/** Each part of a Primary Die bonus: a named line per feature, and the part no feature added. */
function bonusParts(
	modifier: number,
	lines: readonly PrimaryDieBonusLine[],
): BonusPart[] {
	const named = lines.filter((line) => line.value);
	const unnamed = modifier - named.reduce((sum, line) => sum + line.value, 0);
	return [
		...named.map((line) => ({ value: line.value, label: line.label, uuid: line.itemUuid ?? '' })),
		...(unnamed ? [{ value: unnamed, label: '', uuid: '' }] : []),
	];
}

interface BonusPart {
	value: number;
	label: string;
	uuid: string;
}

function partParts(part: BonusPart, spaced: boolean): LinkedPart[] {
	const sign = part.value < 0 ? '-' : '+';
	const amount = `${sign}${spaced ? ' ' : ''}${Math.abs(part.value)}`;
	return part.label ? [`${amount} (`, docLink(part.label, part.uuid), ')'] : [amount];
}

function joinParts(groups: readonly LinkedPart[][], separator: string): LinkedPart[] {
	return groups.flatMap((group, index) => (index === 0 ? group : [separator, ...group]));
}

function line(
	id: string,
	key: string,
	data: LinkedData,
	extra: Partial<RollDetailLine> = {},
): RollDetailLine {
	const parts = linkedParts(key, data);
	return { id, text: partsText(parts), parts, ...extra };
}

function bonusTooltip(parts: readonly BonusPart[]): string {
	return parts
		.map((part) =>
			part.label
				? `${part.label} ${signed(part.value)}`
				: localize('NIMBLE.chat.primaryDieBonus.dialog', { value: signed(part.value) }),
		)
		.join(', ');
}

/**
 * The Primary Die line: the face, each bonus with who added it, and the
 * result, such as "Primary Die: 4 + 1 (Juggernaut) = 5". A value set in the
 * roll window and a bonus that a set value kept off show in the same line.
 */
export function primaryDieLine(input: DamageRollDetailsInput): RollDetailLine | null {
	const options = input.rollOptions ?? {};
	if (options.canCrit === false && options.canMiss === false) return null;

	const modifier = Math.trunc(Number(options.primaryDieModifier) || 0);
	const setValue = Math.trunc(Number(options.primaryDieValue) || 0);
	const base =
		typeof options.primaryDieBaseResult === 'number' ? options.primaryDieBaseResult : null;
	if (!modifier) {
		return setValue
			? line('primaryDie', `${TEXT}.primaryDieSet`, { value: String(setValue) })
			: null;
	}

	const parts = bonusParts(modifier, input.primaryDieBonuses ?? []);
	const tooltip = bonusTooltip(parts);

	if (options.primaryDieBonusOff) {
		return line(
			'primaryDie',
			base === null ? `${TEXT}.primaryDieNotAddedNoFace` : `${TEXT}.primaryDieNotAdded`,
			{
				face: String(base ?? ''),
				bonuses: joinParts(
					parts.map((part) => partParts(part, false)),
					', ',
				),
			},
			{
				tooltip: input.bonusNotAdded || localize('NIMBLE.chat.primaryDieBonus.notAddedTooltip'),
				notAdded: true,
			},
		);
	}

	const start =
		setValue && (base === null || base === setValue)
			? localize(`${TEXT}.setTo`, { value: String(setValue) })
			: base === null
				? ''
				: String(base);
	const sum = joinParts(
		[...(start ? [[start]] : []), ...parts.map((part) => partParts(part, true))],
		' ',
	);
	if (base === null) {
		const key = start ? `${TEXT}.primaryDieNoResult` : `${TEXT}.primaryDieAdded`;
		return line('primaryDie', key, { sum }, { tooltip });
	}

	const faces = (input.roll?.terms ?? []).find(
		(term) => (term as { faces?: number } | null)?.faces,
	) as { faces?: number } | undefined;
	const total = base + modifier;
	const result = Math.max(1, faces?.faces ? Math.min(total, faces.faces) : total);
	const key =
		result < total
			? `${TEXT}.primaryDieMax`
			: result > total
				? `${TEXT}.primaryDieLowest`
				: `${TEXT}.primaryDie`;
	return line('primaryDie', key, { sum, result: String(result) }, { tooltip });
}

function termClass(term: SerializedTerm): string {
	return term.class ?? (term as { constructor?: { name?: string } }).constructor?.name ?? '';
}

function termValue(term: SerializedTerm): number | null {
	if (Array.isArray(term.results)) {
		return term.results.reduce(
			(sum, result) => (result.active === false || result.discarded ? sum : sum + result.result),
			0,
		);
	}
	if (typeof term.number === 'number') return term.number;
	if (typeof term.roll?.total === 'number') return term.roll.total;
	if (typeof term.result === 'number') return term.result;
	if (typeof term.total === 'number') return term.total;
	return null;
}

/**
 * The parts of a roll that carry a flavor, as their flavor and amount: each
 * run of terms between a `+` and a `-` is one part. The Primary Die and the
 * dice a crit added are not parts. Parts with the same flavor add up.
 */
export function flavoredParts(
	terms: readonly unknown[] | null | undefined,
): Array<{ label: string; amount: number }> {
	const chunks: Array<{ sign: number; terms: SerializedTerm[] }> = [{ sign: 1, terms: [] }];
	for (const term of (terms ?? []) as SerializedTerm[]) {
		if (termClass(term) === 'OperatorTerm' && (term.operator === '+' || term.operator === '-')) {
			chunks.push({ sign: term.operator === '-' ? -1 : 1, terms: [] });
		} else {
			chunks.at(-1)?.terms.push(term);
		}
	}

	const amounts = new Map<string, number>();
	for (const chunk of chunks) {
		const label = chunk.terms.find((term) => term.options?.flavor)?.options?.flavor?.trim();
		if (!label) continue;
		if (chunk.terms.some((term) => termClass(term) === 'PrimaryDie' || term.options?.dieRole)) {
			continue;
		}
		let value: number | null = null;
		let operator = '*';
		for (const term of chunk.terms) {
			if (termClass(term) === 'OperatorTerm') {
				operator = term.operator ?? '*';
				continue;
			}
			const next = termValue(term);
			if (next === null) {
				value = null;
				break;
			}
			value = value === null ? next : operator === '/' ? value / next : value * next;
		}
		if (value === null || !Number.isFinite(value)) continue;
		amounts.set(label, (amounts.get(label) ?? 0) + chunk.sign * value);
	}
	return [...amounts].map(([label, amount]) => ({ label, amount: Math.floor(amount) }));
}

/**
 * The small lines under a damage box: the Primary Die line, one line per part
 * a feature added, and the feature that made the box.
 */
export function damageRollDetails(input: DamageRollDetailsInput): RollDetailLine[] {
	const lines: RollDetailLine[] = [];
	const source = input.source?.label?.trim() ?? '';
	if (source) {
		lines.push(line('source', `${TEXT}.source`, { label: docLink(source, input.source?.uuid) }));
	}

	const primaryDie = primaryDieLine(input);
	if (primaryDie) lines.push(primaryDie);

	for (const [index, part] of (input.rollOptions?.damageParts ?? []).entries()) {
		const label = part.label?.trim();
		if (!label) continue;
		const amount =
			typeof part.amount === 'number'
				? signed(part.amount)
				: part.formula
					? `+${displayFormula(part.formula)}`
					: '';
		if (!amount) continue;
		lines.push(
			line(`part-${index}`, `${TEXT}.part`, { label: docLink(label, part.itemUuid), amount }),
		);
	}

	for (const part of flavoredParts(input.roll?.terms)) {
		if (part.label === source) continue;
		lines.push({
			id: `flavor-${part.label}`,
			text: localize(`${TEXT}.part`, { label: part.label, amount: signed(part.amount) }),
		});
	}
	return lines;
}
