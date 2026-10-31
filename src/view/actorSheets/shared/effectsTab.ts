import { effectDuration, effectLists, sourceItem } from './effectLists.ts';
import type { ConditionLike, EffectLike, Format, ItemLike, Localize } from './sheetSource.ts';

const FX = 'NIMBLE.actorSheet.shared.effects';

/** States that the system sets from HP, wounds and spells; they show in the group of the actor while they are on. */
const SET_BY_THE_SYSTEM = new Set([
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
	| { kind: 'removeEffect'; effectId: string; itemId: string | null }
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
	/** how long it lasts, at the end of the row */
	lasts?: string;
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
	/** the pen: open the item that keeps the effect on */
	edit: EffectIntent | null;
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
	/** Active effects, the conditions on the actor, Passive effects: always all three */
	groups: EffectRowGroup[];
	/** the line in an empty group */
	none: string;
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
}

function askRemove(name: string, intent: EffectIntent, input: EffectsTabInput): EffectRowAsk {
	return {
		label: input.format(`${FX}.removeName`, { name }),
		question: input.format(`${FX}.removeQuestion`, { name }),
		confirmLabel: input.localize(`${FX}.remove`),
		intent,
	};
}

function stateRow(
	base: Pick<EffectRowView, 'id' | 'name' | 'img' | 'use'> & {
		duration: string;
		from: string;
		description: string;
	},
	input: EffectsTabInput,
	extra: Partial<EffectRowView> = {},
): EffectRowView {
	const { localize } = input;
	return {
		id: base.id,
		name: base.name,
		img: base.img || undefined,
		summary: base.from || base.description || undefined,
		lasts: base.duration || undefined,
		description: base.description || undefined,
		facts: [
			...(base.from ? [[localize(`${FX}.facts.from`), base.from] as [string, string]] : []),
			[localize(`${FX}.facts.lasts`), base.duration || localize(`${FX}.untilItEnds`)],
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
	if (effect.toggle) {
		return stateRow(
			{
				...base,
				duration: effectDuration(effect, item, input),
				from,
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
		return stateRow({ ...base, duration: effect.duration, from, use: null }, input, {
			edit: { kind: 'openItem', itemId: item.id },
		});
	}
	return stateRow(
		{
			...base,
			duration: effect.duration,
			from,
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
	);
}

function conditionRow(condition: ConditionLike, input: EffectsTabInput): EffectRowView {
	return stateRow(
		{
			id: `condition-${condition.id}`,
			name: condition.name,
			img: condition.img,
			description: condition.description,
			duration: condition.duration,
			from:
				condition.source && condition.source !== condition.name
					? input.format(`${FX}.fromItem`, { name: condition.source })
					: '',
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
	);
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
	return {
		groups: [
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
		],
		none: localize(`${FX}.none`),
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
