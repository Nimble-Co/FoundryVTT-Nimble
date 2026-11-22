import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type {
	Clock,
	EventSubject,
	LastsUntilEvent,
	TimeUnit,
	TurnBoundary,
	TurnSpan,
} from '../../src/models/activeEffect/nimbleEffectChoices.js';

/** A pack document or part of one, as its JSON file stores it. */
export type Json = Record<string, any>;

// Readers

const readPackFile = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

export const readItem = readPackFile;

export const readActor = readPackFile;

/** The one item with this name that the actor in this file holds. */
export function actorItem(file: string, name: string): Json {
	const found = ((readActor(file).items ?? []) as Json[]).filter((item) => item.name === name);
	if (found.length !== 1) throw new Error(`${file} has ${found.length} items named ${name}`);
	return found[0] as Json;
}

// Step tree

/** Every step of the item, flattened, with `parentNode` and `parentContext` set. */
export const allSteps = (item: Json): Json[] =>
	flattenEffectsTree(item.system?.activation?.effects ?? []) as Json[];

/** The steps at the root of the item, as the pack stores them. */
export const rootSteps = (item: Json): Json[] => item.system.activation.effects as Json[];

export const stepById = (item: Json, id: string): Json | undefined =>
	allSteps(item).find((node) => node.id === id);

function findRawStep(nodes: Json[], id: string): Json | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const children = [
			...Object.values((node.on ?? {}) as Record<string, Json[]>).flat(),
			...((node.sharedRolls ?? []) as Json[]),
		];
		const found = findRawStep(children, id);
		if (found) return found;
	}
	return undefined;
}

/** A step as the pack stores it, with its `on` branches and shared rolls. */
export const rawStepById = (item: Json, id: string): Json | undefined =>
	findRawStep(rootSteps(item), id);

/** Every Apply Effect step of the item that applies this effect. */
export const stepsApplying = (item: Json, effectId: string): Json[] =>
	allSteps(item).filter((node) => node.type === 'applyEffect' && node.effectId === effectId);

/** The one Apply Effect step of the item that applies this effect. */
export function stepApplying(item: Json, effectId: string): Json {
	const steps = stepsApplying(item, effectId);
	if (steps.length !== 1) throw new Error(`${item.name} has ${steps.length} steps for ${effectId}`);
	return steps[0] as Json;
}

export const rulesOfType = (rules: Json[], type: string): Json[] =>
	rules.filter((rule) => rule.type === type);

// Rule schema checks

type FieldLike = Json & { options?: Json };

const optionOf = (field: FieldLike, key: string): unknown => field.options?.[key];

function choicesOf(field: FieldLike): string[] | null {
	const raw = optionOf(field, 'choices');
	if (raw == null) return null;
	const choices = typeof raw === 'function' ? (raw as () => unknown)() : raw;
	return Array.isArray(choices) ? choices.map(String) : Object.keys(choices as Json);
}

/**
 * The reasons a value fails its field, as Foundry casts and validates it. The unit tests
 * mock the field classes, so this applies Foundry's checks to the options of the real schema.
 */
function fieldFailures(field: FieldLike, value: unknown, at: string): string[] {
	const { fields } = foundry.data;
	if (value === undefined) {
		const initial = optionOf(field, 'initial');
		if (initial === undefined) return [];
		return fieldFailures(field, typeof initial === 'function' ? initial({}) : initial, at);
	}
	if (value === null) {
		const nullable = optionOf(field, 'nullable') ?? field instanceof fields.NumberField;
		return nullable ? [] : [`${at}: may not be null`];
	}
	if (field instanceof fields.StringField) {
		const text = String(value).trim();
		const choices = choicesOf(field);
		const blank = optionOf(field, 'blank') ?? !choices;
		if (text === '') return blank ? [] : [`${at}: may not be a blank string`];
		return choices && !choices.includes(text) ? [`${at}: ${text} is not a valid choice`] : [];
	}
	if (field instanceof fields.NumberField) {
		if (value === '' && optionOf(field, 'nullable') !== false) return [];
		const number = Number(value);
		if (Number.isNaN(number)) return [`${at}: must be a number`];
		const min = optionOf(field, 'min') as number | undefined;
		const max = optionOf(field, 'max') as number | undefined;
		if (optionOf(field, 'integer') && !Number.isInteger(number))
			return [`${at}: must be an integer`];
		if (min !== undefined && number < min) return [`${at}: must be at least ${min}`];
		if (max !== undefined && number > max) return [`${at}: must be at most ${max}`];
		return [];
	}
	if (field instanceof fields.ArrayField || field instanceof fields.SetField) {
		if (!Array.isArray(value)) return [`${at}: must be an array`];
		return value.flatMap((each, index) => fieldFailures(field.element, each, `${at}.${index}`));
	}
	if (field instanceof fields.SchemaField) {
		if (typeof value !== 'object') return [`${at}: must be an object`];
		return Object.entries(field.fields as Record<string, FieldLike>).flatMap(([key, inner]) =>
			fieldFailures(inner, (value as Json)[key], `${at}.${key}`),
		);
	}
	return [];
}

/** Every rule of the document, of its effects and of the items an actor holds. */
function packRules(document: Json): Json[] {
	const effectRules = ((document.effects ?? []) as Json[]).flatMap(
		(effect) => (effect.system?.rules ?? []) as Json[],
	);
	return [
		...((document.system?.rules ?? []) as Json[]),
		...effectRules,
		...((document.items ?? []) as Json[]).flatMap(packRules),
	];
}

/**
 * Each rule of the pack document built through the schema of its rule type: the reasons
 * a rule would be invalid, and so disabled, when an actor holds it. Empty when all pass.
 */
export async function packRuleFailures(document: Json): Promise<string[]> {
	const { RULE_CLASSES } = await import('../../src/config/ruleClasses.js');
	return packRules(document).flatMap((rule) => {
		const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
		if (!ruleClass) return [`${rule.id}: ${rule.type} is not a rule type`];
		const schema = ruleClass.defineSchema() as Record<string, FieldLike>;
		const unknown = Object.keys(rule).filter((key) => !(key in schema));
		return [
			...unknown.map((key) => `${rule.id}.${key}: not a field of ${rule.type}`),
			...Object.entries(schema).flatMap(([key, field]) =>
				fieldFailures(field, rule[key], `${rule.id}.${key}`),
			),
		];
	});
}

// Effect finders

export function effectById(item: Json, id: string): Json {
	const effect = ((item.effects ?? []) as Json[]).find((each) => each._id === id);
	if (!effect) throw new Error(`${item.name} has no effect ${id}`);
	return effect;
}

/** The one effect of the item with this name. */
export function effectNamed(item: Json, name: string): Json {
	const found = ((item.effects ?? []) as Json[]).filter((each) => each.name === name);
	if (found.length !== 1) throw new Error(`${item.name} has ${found.length} effects named ${name}`);
	return found[0] as Json;
}

// Shared values

export const MOVEMENT_MODES = ['walk', 'fly', 'climb', 'swim', 'burrow'];

export const GRAPPLED_IMG = 'systems/nimble/assets/icons/grappled.svg';

const ESCAPE_SAVES = ['strength', 'dexterity'];

/** An Escape with this DC, by a STR or DEX save. */
export const escapeDc = (dc: string) => ({ dc, saves: ESCAPE_SAVES });

/** An Escape with no DC: the GM rules on it. */
export const NO_DC_ESCAPE = { dc: '', saves: ESCAPE_SAVES, noDc: true };

// Step tree checks

export function expectAtRoot(item: Json, step: Json): void {
	expect(step.parentNode).toBeNull();
	expect(step.parentContext).toBeNull();
	expect(rootSteps(item).map((node) => node.id)).toContain(step.id);
}

export function expectRootRecipient(step: Json, recipient: string): void {
	expect(step).toMatchObject({ recipient, parentContext: null, parentNode: null });
}

export function expectOnFailedSave(item: Json, step: Json, saveId: string): void {
	expect(step.parentNode).toBe(saveId);
	expect(step.parentContext).toBe('failedSave');
	const save = rawStepById(item, saveId) as Json;
	expect(save.type).toBe('savingThrow');
	expect((save.on.failedSave as Json[]).map((node) => node.id)).toContain(step.id);
}

/** Every effect, step and rule id of the item is a unique 16 character id. */
export function expectNewIds(item: Json): void {
	const ids = [
		...((item.effects ?? []) as Json[]).map((effect) => effect._id),
		...allSteps(item).map((node) => node.id),
	];
	const ruleIds = ((item.effects ?? []) as Json[]).flatMap((effect) =>
		((effect.system.rules ?? []) as Json[]).map((rule) => rule.id),
	);
	for (const id of [...ids, ...ruleIds]) expect(String(id)).toMatch(/^[A-Za-z0-9]{16}$/);
	expect(new Set(ids).size).toBe(ids.length);
	expect(new Set(ruleIds).size).toBe(ruleIds.length);
}

// Moments

/** A Lasts Until moment as the pack stores it: all nine keys, the keys of another kind null. */
export interface Moment {
	kind: 'turn' | 'time' | 'event';
	boundary: TurnBoundary | null;
	clock: Clock | null;
	span: TurnSpan | null;
	value: number | null;
	units: TimeUnit | null;
	who: EventSubject | null;
	event: LastsUntilEvent | null;
	effectName: string;
	damageTypes?: string[];
}

export type MomentKey = keyof Moment;

const MOMENT_KEYS: MomentKey[] = [
	'kind',
	'boundary',
	'clock',
	'span',
	'value',
	'units',
	'who',
	'event',
	'effectName',
];

const NO_FIELDS = {
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
} as const;

const turnMoment = (
	boundary: TurnBoundary,
	clock: Clock | null,
	span: TurnSpan,
	value: number | null = null,
): Moment => ({ ...NO_FIELDS, kind: 'turn', boundary, clock, span, value });

const timeMoment = (value: number, units: TimeUnit): Moment => ({
	...NO_FIELDS,
	kind: 'time',
	value,
	units,
});

export const endOfHoldersNextTurn = turnMoment('end', 'holder', 'nextTurn');
/** The end of the holder's 2nd (3rd...) next turn. */
export const endOfHoldersNthNextTurn = (count: number) =>
	turnMoment('end', 'holder', 'nextTurn', count);
export const startOfHoldersNextTurn = turnMoment('start', 'holder', 'nextTurn');
export const endOfHoldersCurrentTurn = turnMoment('end', 'holder', 'currentTurn');
export const startOfSourcesNextTurn = turnMoment('start', 'source', 'nextTurn');
export const endOfNextHerosTurn = turnMoment('end', 'nextHero', 'nextTurn');
/** The end of the turn of whoever is acting now. */
export const endOfAnyTurn = turnMoment('end', 'any', 'currentTurn');
export const endOfRound = turnMoment('end', null, 'currentRound');

export const rounds = (count: number) => timeMoment(count, 'rounds');
export const minutes = (count: number) => timeMoment(count, 'minutes');
export const hours = (count: number) => timeMoment(count, 'hours');
export const days = (count: number) => timeMoment(count, 'days');

export const onEvent = (
	who: EventSubject | null,
	event: LastsUntilEvent,
	fields: Partial<Moment> = {},
): Moment => ({ ...NO_FIELDS, kind: 'event', who, event, ...fields });

export const whileConcentrating = onEvent('source', 'loseConcentration');
export const tempHpGone = onEvent('holder', 'tempHpGone');
/** The source gains the effect or condition with this name. */
export const sourceGains = (effectName: string) => onEvent('source', 'gain', { effectName });
/** The holder's effect with this name ends. */
export const effectEnds = (effectName: string) => onEvent('holder', 'effectEnds', { effectName });
export const holderTakesDamage = (...damageTypes: string[]) =>
	onEvent('holder', 'takeDamage', { damageTypes });
/** The combat ends; a count waits for that many combat ends. */
export const combatEnds = (count: number | null = null) =>
	onEvent(null, 'combatEnd', { value: count });
/** The Grappled default ends, which an effect with its own moments repeats. */
export const grappleEnds = [
	onEvent('source', 'zeroHp'),
	onEvent('source', 'die'),
	sourceGains('incapacitated'),
];

const pick = (moment: Moment, keys: MomentKey[]): Partial<Moment> =>
	Object.fromEntries(keys.filter((key) => key in moment).map((key) => [key, moment[key]]));

/** Matches every field of the moment. */
export const exactMoment = (moment: Moment) => expect.objectContaining(moment);

/** Matches every field of the moment but the keys named. */
export const exactMomentWithout = (moment: Moment, ...skip: MomentKey[]) =>
	expect.objectContaining(
		pick(
			moment,
			(Object.keys(moment) as MomentKey[]).filter((key) => !skip.includes(key)),
		),
	);

const KIND_KEYS: Record<Moment['kind'], MomentKey[]> = {
	turn: ['kind', 'boundary', 'clock', 'span'],
	time: ['kind', 'value', 'units'],
	event: ['kind', 'who', 'event'],
};

/** Matches the fields that define the moment's kind, and the other keys named. */
export const looseMoment = (moment: Moment, ...also: MomentKey[]) =>
	expect.objectContaining(pick(moment, [...KIND_KEYS[moment.kind], ...also]));

/** Each moment of the effect has the nine keys, besides the keys named. */
export function expectNineKeys(effect: Json, ignore: string[] = []): void {
	for (const moment of effect.system.lastsUntil as Json[]) {
		const keys = Object.keys(moment).filter((key) => !ignore.includes(key));
		expect(keys.sort()).toEqual([...MOMENT_KEYS].sort());
	}
}

/** The effect's Lasts Until is these moments, each with the nine keys. */
export function expectLastsUntil(effect: Json, moments: unknown[]): void {
	expect(effect.system.lastsUntil).toEqual(moments);
	expectNineKeys(effect);
}
