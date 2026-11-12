import { effectDuration, effectLists, sourceItem } from './effectLists.ts';
import { firstSentence, plainText } from './plainText.ts';
import type { ConditionLike, EffectLike, Format, ItemLike, Localize } from './sheetSource.ts';

const FX = 'NIMBLE.actorSheet.shared.effects';

/** States that the system sets from HP, wounds and spells; they show in the group of the actor while they are on. */
export const SET_BY_THE_SYSTEM = new Set([
	'bloodied',
	'dying',
	'dead',
	'wounded',
	'lastStand',
	'concentration',
]);

/** Conditions that do nothing on their own (the "minor statuses" of the rules). */
const OTHER_CONDITIONS = new Set(['charged', 'distracted', 'marked', 'smoldering']);

/** What the Effects tab asks for. Both sheets have these intents, with the same shape. */
export type EffectIntent =
	| { kind: 'endEffect'; effectId: string }
	| { kind: 'openEffect'; effectId: string; itemId: string | null }
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
	| { kind: 'escape'; effectId: string }
	| { kind: 'setCondition'; conditionId: string; active: boolean }
	| { kind: 'openItem'; itemId: string };

/** A question in a ConfirmBar under the row; Yes sends the intent. */
export interface EffectRowAsk {
	label: string;
	question: string;
	confirmLabel: string;
	intent: EffectIntent;
}

export interface EffectRowView {
	id: string;
	name: string;
	img?: string;
	summary?: string;
	/** Font Awesome class before the summary: the hourglass of a Lasts Until line */
	summaryIcon?: string;
	description?: string;
	facts: [string, string][];
	state?: 'active';
	tag?: string;
	tagOn?: boolean;
	/** End at once, or Remove after a question; null: you change it through its item */
	use:
		| { kind: 'act'; label: string; intent: EffectIntent }
		| { kind: 'ask'; ask: EffectRowAsk }
		| null;
	/** the pen: open the effect window, or the item that keeps the effect on */
	edit: EffectIntent | null;
	/** a button at the end of the row: roll a save to Escape the effect */
	escape?: { label: string; ariaLabel: string; intent: EffectIntent };
}

export interface EffectRowGroup {
	id: 'active' | 'conditionsOn' | 'passive';
	label: string;
	/** the count; empty for none */
	note: string;
	rows: EffectRowView[];
}

export interface ConditionToggleView {
	id: string;
	name: string;
	img: string;
	on: boolean;
	intent: EffectIntent;
}

export interface EffectsTabView {
	/** Active effects, the conditions on the actor, Passive effects: only the groups that have rows */
	groups: EffectRowGroup[];
	/** the one line when no group has a row */
	empty: string | null;
	/** the conditions that a user sets by hand; `other` are the ones that do nothing on their own */
	conditions: {
		label: string;
		options: ConditionToggleView[];
		other: { label: string; options: ConditionToggleView[] };
	};
}

export interface EffectsTabInput {
	effects: EffectLike[];
	items: ItemLike[];
	/** every condition of the system, with the ones on the actor marked */
	conditions: ConditionLike[];
	conditionLabels: Record<string, string>;
	localize: Localize;
	format: Format;
	/** the heading of the conditions on the actor: "Conditions on you", "Conditions" */
	conditionsOnLabel: string;
	/** keep the empty groups, for a caller that adds rows and then calls `shownGroups` */
	keepEmpty?: boolean;
}

function askRemove(name: string, intent: EffectIntent, input: EffectsTabInput): EffectRowAsk {
	return {
		label: input.format(`${FX}.removeName`, { name }),
		question: input.format(`${FX}.removeQuestion`, { name }),
		confirmLabel: input.localize(`${FX}.remove`),
		intent,
	};
}

const HOURGLASS = 'fa-solid fa-hourglass-half';

/** "Until the end of your next turn - Snowblind"; the source only when it is not the row's name. */
function lastsLine(lasts: string, sourceName: string, name: string): string {
	return sourceName && sourceName !== name ? `${lasts} - ${sourceName}` : lasts;
}

function escapeButton(
	name: string,
	effectId: string | null,
	escapeData: { dc: number | null } | null,
	input: EffectsTabInput,
): EffectRowView['escape'] {
	if (!escapeData || !effectId) return undefined;
	const dc = escapeData.dc === null ? null : String(escapeData.dc);
	return {
		label: dc
			? input.format('NIMBLE.escape.button', { dc })
			: input.localize('NIMBLE.escape.buttonNoDc'),
		ariaLabel: dc
			? input.format('NIMBLE.escape.label', { name, dc })
			: input.format('NIMBLE.escape.labelNoDc', { name }),
		intent: { kind: 'escape', effectId },
	};
}

function stateRow(
	base: Pick<EffectRowView, 'id' | 'name' | 'img' | 'use'> & {
		/** Lasts Until, or the older duration words */
		lasts: string;
		from: string;
		sourceName: string;
		description: string;
		/** a condition keeps its short text in the open row */
		textInSummary: boolean;
	},
	input: EffectsTabInput,
	extra: Partial<EffectRowView> = {},
): EffectRowView {
	const { localize } = input;
	const summary = base.lasts
		? lastsLine(base.lasts, base.sourceName, base.name)
		: base.from ||
			(base.textInSummary ? firstSentence(plainText(base.description), base.name) : '');
	return {
		id: base.id,
		name: base.name,
		img: base.img || undefined,
		summary: summary || undefined,
		summaryIcon: base.lasts ? HOURGLASS : undefined,
		description: base.description || undefined,
		facts: [
			...(base.from ? [[localize(`${FX}.facts.from`), base.from] as [string, string]] : []),
			[localize(`${FX}.facts.lasts`), base.lasts || localize(`${FX}.untilItEnds`)],
		],
		use: base.use,
		edit: null,
		...extra,
	};
}

function effectRow(effect: EffectLike, input: EffectsTabInput, passive: boolean): EffectRowView {
	const { localize, format } = input;
	const item = sourceItem(input.items, effect);
	const base = {
		id: `effect-${effect.id}`,
		name: effect.name,
		img: effect.img,
		description: effect.description,
	};
	const from = item ? format(`${FX}.fromItem`, { name: item.name }) : '';
	const sourceName = effect.sourceName || item?.name || '';
	const lasts = effect.lastsUntil || effect.duration;
	if (effect.toggle) {
		return stateRow(
			{
				...base,
				lasts: effect.lastsUntil || effectDuration(effect, item, input),
				from,
				sourceName,
				textInSummary: true,
				use: {
					kind: 'act',
					label: format('NIMBLE.actorSheet.shared.endName', { name: effect.name }),
					intent: { kind: 'endEffect', effectId: effect.id },
				},
			},
			input,
			{ state: 'active', tag: localize('NIMBLE.actorSheet.shared.active'), tagOn: true },
		);
	}
	// an item keeps its passive effect on: you change it through the item
	if (passive && item) {
		return stateRow({ ...base, lasts, from, sourceName, textInSummary: true, use: null }, input, {
			edit: { kind: 'openItem', itemId: item.id },
		});
	}
	return stateRow(
		{
			...base,
			lasts,
			from,
			sourceName,
			textInSummary: true,
			use: {
				kind: 'ask',
				ask: askRemove(
					effect.name,
					{ kind: 'removeEffect', effectId: effect.id, itemId: effect.itemId },
					input,
				),
			},
		},
		input,
		{
			edit: { kind: 'openEffect', effectId: effect.id, itemId: effect.itemId },
			escape: escapeButton(effect.name, effect.id, effect.escape, input),
		},
	);
}

function conditionRow(condition: ConditionLike, input: EffectsTabInput): EffectRowView {
	return stateRow(
		{
			id: `condition-${condition.id}`,
			name: condition.name,
			img: condition.img,
			description: condition.description,
			lasts: condition.lastsUntil || condition.duration,
			from:
				condition.source && condition.source !== condition.name
					? input.format(`${FX}.fromItem`, { name: condition.source })
					: '',
			sourceName: condition.source,
			textInSummary: false,
			use: {
				kind: 'ask',
				ask: askRemove(
					condition.name,
					{ kind: 'setCondition', conditionId: condition.id, active: false },
					input,
				),
			},
		},
		input,
		{
			escape: escapeButton(condition.name, condition.effectId, condition.escape, input),
			edit: condition.effectId
				? { kind: 'openEffect', effectId: condition.effectId, itemId: null }
				: null,
		},
	);
}

/** Leaves out the groups with no rows; with none left, `empty` is the one line that says so. */
export function shownGroups<G extends { rows: unknown[] }>(
	groups: G[],
	localize: Localize,
): { groups: G[]; empty: string | null } {
	const shown = groups.filter((group) => group.rows.length);
	return { groups: shown, empty: shown.length ? null : localize(`${FX}.noEffects`) };
}

/** Active effects, the conditions on the actor and the passive effects; under them, every condition. */
export function effectsTab(input: EffectsTabInput): EffectsTabView {
	const { localize } = input;
	const lists = effectLists(input.effects, input.conditions, input.conditionLabels);
	const group = (
		id: EffectRowGroup['id'],
		label: string,
		rows: EffectRowView[],
	): EffectRowGroup => ({ id, label, note: rows.length ? String(rows.length) : '', rows });
	const toggles: ConditionToggleView[] = input.conditions
		.filter((condition) => !SET_BY_THE_SYSTEM.has(condition.id))
		.map((condition) => ({
			id: condition.id,
			name: condition.name,
			img: condition.img,
			on: condition.active,
			intent: { kind: 'setCondition', conditionId: condition.id, active: !condition.active },
		}));
	const groups = [
		group(
			'active',
			localize(`${FX}.active`),
			lists.active.map((effect) => effectRow(effect, input, false)),
		),
		group(
			'conditionsOn',
			input.conditionsOnLabel,
			lists.conditions.map((condition) => conditionRow(condition, input)),
		),
		group(
			'passive',
			localize(`${FX}.passive`),
			lists.passive.map((effect) => effectRow(effect, input, true)),
		),
	];
	return {
		...(input.keepEmpty ? { groups, empty: null } : shownGroups(groups, localize)),
		conditions: {
			label: localize(`${FX}.allConditions`),
			options: toggles.filter((toggle) => !OTHER_CONDITIONS.has(toggle.id)),
			other: {
				label: localize(`${FX}.otherConditions`),
				options: toggles.filter((toggle) => OTHER_CONDITIONS.has(toggle.id)),
			},
		},
	};
}
