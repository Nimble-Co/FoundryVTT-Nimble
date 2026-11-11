import { SYSTEM_ID } from '#system';
import type { WholeRoundDefend } from '#types/defend.d.ts';
import type { ApplyEffectNode } from '#types/effectTree.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { statusOf } from '#utils/treeManipulation/conditionsToItemEffects.js';
import {
	LASTS_UNTIL_EVENTS,
	type LastsUntilEvent,
	NIMBLE_EFFECT_TYPE,
} from '../../models/activeEffect/nimbleEffectChoices.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown>;
type NodeSource = Record<string, unknown>;

interface EffectSource {
	_id: string;
	name: string;
	img: string;
	type: typeof NIMBLE_EFFECT_TYPE;
	transfer: false;
	statuses: string[];
	description: string;
	disabled: boolean;
	origin: null;
	system: {
		changes: unknown[];
		rules: unknown[];
		lastsUntil: Moment[];
		escape: { dc: string; saves: string[] };
		tempHp: null;
		minor: boolean;
	};
	flags: Record<string, unknown>;
}

interface ItemEffectSource {
	_id?: string;
	transfer?: boolean;
	system?: { lastsUntil?: Moment[]; rules?: unknown };
}

interface ItemSource {
	name?: string;
	img?: string | null;
	effects?: ItemEffectSource[];
	system?: { identifier?: string; rules?: unknown; activation?: { effects?: unknown } };
}

/** Toggle rule identifiers and ids, to the identifier of the item that holds the rule. */
type ToggleIndex = Map<string, string>;

const NO_MOMENT = {
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
} as const;

const DEFAULT_IMG = 'icons/svg/aura.svg';

function eventMoment(event: LastsUntilEvent): Moment {
	return { ...NO_MOMENT, kind: 'event', who: event === 'combatEnd' ? null : 'holder', event };
}

const HOLDER_TURN_STARTS: Moment = {
	...NO_MOMENT,
	kind: 'turn',
	boundary: 'start',
	clock: 'holder',
	span: 'nextTurn',
};

const HOLDER_TURN_ENDS: Moment = {
	...NO_MOMENT,
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'currentTurn',
};

const ROUND_ENDS: Moment = { ...NO_MOMENT, kind: 'turn', boundary: 'end', span: 'currentRound' };

function forRounds(value: number): Moment {
	return { ...NO_MOMENT, kind: 'time', value, units: 'rounds' };
}

/** The old turn-off ids that are events. */
const TURN_OFF_EVENTS: Record<string, LastsUntilEvent> = {
	onActorKilled: 'die',
	onActorDying: 'zeroHp',
	onActorWounded: 'wounded',
	onActorHealed: 'healed',
	onRest: 'rest',
	onEncounterEnd: 'combatEnd',
};

const TURN_OFF_TURNS: Record<string, Moment> = {
	onTurnStart: HOLDER_TURN_STARTS,
	onTurnEnd: HOLDER_TURN_ENDS,
	onRoundEnd: ROUND_ENDS,
};

/** A copy of `conditionLastsUntil.despair` as it was when this migration was written. */
const DESPAIR_MOMENTS: Moment[] = [eventMoment('attack'), eventMoment('combatEnd')];

const OLD_TOGGLE_FIELDS = ['turnOff', 'endAfterInactiveRounds'] as const;
const OLD_ACTIVITY_ROUND_FLAG = 'toggleEffectActivityRound';
const OLD_ACTIVITY_COMBAT_FLAG = 'toggleEffectActivityCombatId';
const LAST_ACTIVITY_FLAG = 'lastActivity';
const TOGGLE_RULE_FLAG = 'toggleEffectRuleId';
const TOGGLE_ITEM_FLAG = 'toggleEffectItemId';
const MARKER_FLAG = 'markTargetItemUuid';
const WHOLE_ROUND_DEFEND_FLAG = 'wholeRoundDefend';
const ROUND_DEFEND_FLAG = 'roundDefend';
const ROUND_DEFEND_IMG = 'icons/svg/shield.svg';

function isBlank(value: unknown): boolean {
	return typeof value !== 'string' || value.trim() === '';
}

function positive(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function withoutRepeats(moments: Moment[]): Moment[] {
	const seen = new Set<string>();
	return moments.filter((moment) => {
		const key = JSON.stringify(moment);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function hasOldToggleFields(rule: RuleSource): boolean {
	return OLD_TOGGLE_FIELDS.some((field) => field in rule);
}

/** The Lasts Until of a toggle's old `turnOff` and `endAfterInactiveRounds`. */
function toggleMoments(rule: RuleSource): Moment[] {
	const moments: Moment[] = [];
	for (const id of Array.isArray(rule.turnOff) ? rule.turnOff : []) {
		if (typeof id !== 'string') continue;
		const event = TURN_OFF_EVENTS[id];
		if (event) moments.push(eventMoment(event));
		else if (TURN_OFF_TURNS[id]) moments.push({ ...TURN_OFF_TURNS[id] });
	}
	if ((positive(rule.endAfterInactiveRounds) ?? 0) >= 1) moments.push(eventMoment('inactiveRound'));
	return withoutRepeats(moments);
}

/** The old `suppressTurnOff` ids as Lasts Until events. A turn or round id has no event. */
function dropMomentsOf(suppressTurnOff: unknown): LastsUntilEvent[] {
	if (!Array.isArray(suppressTurnOff)) return [];
	const events = suppressTurnOff
		.map((id) => (typeof id === 'string' ? TURN_OFF_EVENTS[id] : undefined))
		.filter((event): event is LastsUntilEvent => !!event);
	return [...new Set(events)];
}

/**
 * The Lasts Until of an old core duration (seconds first, then turns, then rounds, as core read
 * it). Seconds become whole hours or minutes when exact, else rounds of 6 seconds.
 */
function durationMoments(duration: unknown): Moment[] {
	if (!duration || typeof duration !== 'object') return [];
	const { rounds, turns, seconds } = duration as Record<string, unknown>;
	const secs = positive(seconds);
	if (secs !== null) {
		if (secs % 3600 === 0)
			return [{ ...NO_MOMENT, kind: 'time', value: secs / 3600, units: 'hours' }];
		if (secs % 60 === 0)
			return [{ ...NO_MOMENT, kind: 'time', value: secs / 60, units: 'minutes' }];
		return [forRounds(Math.ceil(secs / 6))];
	}
	const count = positive(turns) ?? positive(rounds);
	return count === null ? [] : [forRounds(Math.max(1, Math.round(count)))];
}

function newEffect(data: {
	name: string;
	img: string | null | undefined;
	statuses?: string[];
	lastsUntil: Moment[];
}): EffectSource {
	return {
		_id: foundry.utils.randomID(),
		name: data.name,
		img: data.img || DEFAULT_IMG,
		type: NIMBLE_EFFECT_TYPE,
		transfer: false,
		statuses: data.statuses ?? [],
		description: '',
		disabled: false,
		origin: null,
		system: {
			changes: [],
			rules: [],
			lastsUntil: data.lastsUntil,
			escape: { dc: '', saves: ['strength', 'dexterity'] },
			tempHp: null,
			minor: false,
		},
		flags: {},
	};
}

function conditionEffect(condition: string, lastsUntil: Moment[]): EffectSource {
	return newEffect({ ...statusOf(condition), statuses: [condition], lastsUntil });
}

function ruleName(rule: RuleSource, item: ItemSource): string {
	return isBlank(rule.label) ? (item.name ?? '') : (rule.label as string);
}

function rulesIn(rules: unknown): RuleSource[] {
	return Array.isArray(rules)
		? rules.filter((rule): rule is RuleSource => !!rule && typeof rule === 'object')
		: [];
}

function filledStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
		.map((entry) => entry.trim());
}

/** The identifier of an item, as the item document resolves it. */
function identifierOf(item: { name?: string | null; system?: { identifier?: unknown } | null }) {
	const own = item.system?.identifier;
	return typeof own === 'string' && own ? own : (item.name ?? '').slugify({ strict: true });
}

function addToggles(index: ToggleIndex, rules: unknown, itemIdentifier: string): void {
	for (const rule of rulesIn(rules)) {
		if (rule.type !== 'toggleEffect') continue;
		for (const key of [rule.identifier, rule.id]) {
			if (typeof key !== 'string' || key.trim() === '') continue;
			if (!index.has(key.trim())) index.set(key.trim(), itemIdentifier);
		}
	}
}

function newRule(type: string, fields: RuleSource, base: RuleSource): RuleSource {
	return {
		type,
		disabled: false,
		id: foundry.utils.randomID(),
		identifier: '',
		label: '',
		predicate: {},
		priority: 1,
		...base,
		...fields,
	};
}

/** The Tags and Empty pools at end rules that carry a toggle rule's state onto its effect. */
function stateRules(toggle: RuleSource, label: string): RuleSource[] {
	const base: RuleSource = { disabled: toggle.disabled === true, label };
	if (typeof toggle.priority === 'number') base.priority = toggle.priority;
	const made: RuleSource[] = [];
	const tags = filledStrings(toggle.tags);
	if (tags.length > 0) made.push(newRule('tags', { tags }, base));
	const pools = filledStrings(toggle.clearPoolsOnEnd);
	if (pools.length > 0) made.push(newRule('emptyPoolsAtEnd', { pools }, base));
	return made;
}

const TURN_ON_TRIGGERS: Record<string, string> = {
	onTurnStart: 'onTurnStart',
	onActorDying: 'onDying',
	onCritReceived: 'onCritReceived',
};

function removedMoments(rule: RuleSource): string[] {
	if (!Array.isArray(rule.dropMoments)) return dropMomentsOf(rule.suppressTurnOff);
	const events = new Set<string>(LASTS_UNTIL_EVENTS);
	return [...new Set(filledStrings(rule.dropMoments).filter((event) => events.has(event)))];
}

/** A Modify Toggle rule becomes Use an item for free, Change an effect, both, or nothing. */
function modifyToggleRules(rule: RuleSource, index: ToggleIndex): RuleSource[] {
	const target = typeof rule.toggleIdentifier === 'string' ? rule.toggleIdentifier.trim() : '';
	const itemIdentifier = index.get(target) ?? target;
	const base: RuleSource = {
		disabled: rule.disabled === true,
		identifier: typeof rule.identifier === 'string' ? rule.identifier : '',
		label: typeof rule.label === 'string' ? rule.label : '',
		predicate: rule.predicate ?? {},
		priority: typeof rule.priority === 'number' ? rule.priority : 1,
	};
	const made: RuleSource[] = [];
	const triggers = [
		...new Set(filledStrings(rule.turnOn).flatMap((id) => TURN_ON_TRIGGERS[id] ?? [])),
	];
	if (triggers.length > 0) {
		made.push(newRule('useItemFree', { itemIdentifier, triggers, freeOf: ['uses', 'mana'] }, base));
	}
	const removeMoments = removedMoments(rule);
	if (removeMoments.length > 0) {
		made.push(newRule('changeEffect', { itemIdentifier, removeMoments, addMoments: [] }, base));
	}
	if (made[0] && !isBlank(rule.id)) made[0].id = rule.id;
	return made;
}

function migrateModifyToggles(item: ItemSource, index: ToggleIndex): void {
	const rules = item.system?.rules;
	if (!item.system || !Array.isArray(rules)) return;
	if (!rules.some((rule) => (rule as RuleSource | null)?.type === 'modifyToggle')) return;
	item.system.rules = rules.flatMap((rule) =>
		(rule as RuleSource | null)?.type === 'modifyToggle'
			? modifyToggleRules(rule as RuleSource, index)
			: [rule],
	);
}

function toggleEffectOf(rule: RuleSource, item: ItemSource, created: EffectSource[]) {
	const named = isBlank(rule.effectId)
		? undefined
		: item.effects?.find((effect) => effect._id === rule.effectId && effect.transfer === false);
	if (named) return named;
	const effect = newEffect({
		name: ruleName(rule, item),
		img: item.img,
		lastsUntil: toggleMoments(rule),
	});
	created.push(effect);
	return effect;
}

function rootNodes(item: ItemSource): unknown[] {
	const system = (item.system ??= {});
	const activation = (system.activation ??= {});
	if (!Array.isArray(activation.effects)) activation.effects = [];
	return activation.effects as unknown[];
}

/**
 * The toggle's effect gets the state rules, and the activation applies it to the user. The step
 * takes the rule's id, so an actor effect that the rule made can find it after the item is done.
 */
function migrateToggle(rule: RuleSource, item: ItemSource, created: EffectSource[]): void {
	const effect = toggleEffectOf(rule, item, created);
	const effectId = effect._id as string;
	const system = (effect.system ??= {});
	system.rules = [...rulesIn(system.rules), ...stateRules(rule, ruleName(rule, item))];
	if (rule.disabled === true) return;
	const nodes = rootNodes(item);
	const ids = new Set(nodes.map((node) => (node as NodeSource | null)?.id));
	const id = isBlank(rule.id) || ids.has(rule.id) ? foundry.utils.randomID() : (rule.id as string);
	const node: ApplyEffectNode = {
		id,
		type: 'applyEffect',
		effectId,
		recipient: 'self',
		tempHealingNodeId: null,
		parentContext: null,
		parentNode: null,
	};
	nodes.push(node);
}

function migrateApplyCondition(rule: RuleSource, created: EffectSource[]): void {
	if (!('duration' in rule)) return;
	const moments = durationMoments(rule.duration);
	delete rule.duration;
	if (!isBlank(rule.effectId)) return;
	if (moments.length === 0 || isBlank(rule.condition)) {
		rule.effectId ??= '';
		return;
	}
	const effect = conditionEffect(rule.condition as string, moments);
	created.push(effect);
	rule.effectId = effect._id;
}

function migrateMarkTarget(rule: RuleSource, item: ItemSource, created: EffectSource[]): void {
	if (!('endsAtEncounterEnd' in rule)) return;
	const endsAtCombatEnd = rule.endsAtEncounterEnd === true;
	delete rule.endsAtEncounterEnd;
	if (!isBlank(rule.effectId)) return;
	if (!endsAtCombatEnd) {
		rule.effectId ??= '';
		return;
	}
	const condition = rule.statusCondition;
	const effect = newEffect({
		name: ruleName(rule, item),
		// The marker takes the effect's image: keep the condition's image it had.
		img: isBlank(condition) ? item.img : statusOf(condition as string).img,
		lastsUntil: [eventMoment('combatEnd')],
	});
	created.push(effect);
	rule.effectId = effect._id;
}

function migrateDefendOption(rule: RuleSource, created: EffectSource[]): void {
	if (!('attackerCondition' in rule) && !('attackerConditionEnds' in rule)) return;
	const condition = rule.attackerCondition;
	const untilTheirTurn = rule.attackerConditionEnds === 'attackerTurn';
	delete rule.attackerCondition;
	delete rule.attackerConditionEnds;
	if (!isBlank(rule.attackerEffectId)) return;
	if (isBlank(condition)) {
		rule.attackerEffectId ??= '';
		return;
	}
	const effect = conditionEffect(
		condition as string,
		untilTheirTurn ? [{ ...HOLDER_TURN_STARTS }] : [],
	);
	created.push(effect);
	rule.attackerEffectId = effect._id;
}

/** Calls `migrateNode` on each Apply Effect node with a `duration`, in the activation tree. */
function eachDurationNode(nodes: unknown, migrateNode: (node: NodeSource) => void): void {
	if (!Array.isArray(nodes)) return;
	for (const value of nodes) {
		if (!value || typeof value !== 'object') continue;
		const node = value as NodeSource;
		if (node.type === 'applyEffect' && 'duration' in node) migrateNode(node);
		eachDurationNode(node.sharedRolls, migrateNode);
		const on = node.on;
		if (!on || typeof on !== 'object') continue;
		for (const branch of Object.values(on)) {
			if (Array.isArray(branch)) eachDurationNode(branch, migrateNode);
			else if (branch && typeof branch === 'object') {
				for (const nested of Object.values(branch)) eachDurationNode(nested, migrateNode);
			}
		}
	}
}

/** The old code read the duration only for a bare condition, not for an item effect. */
function bareConditionMoments(node: NodeSource): Moment[] {
	return isBlank(node.effectId) && !isBlank(node.condition) ? durationMoments(node.duration) : [];
}

/** On an item, the node's condition and duration become an item effect. */
function migrateItemNode(node: NodeSource, created: EffectSource[]): void {
	const moments = bareConditionMoments(node);
	delete node.duration;
	if (moments.length === 0) return;
	const made = conditionEffect(node.condition as string, moments);
	created.push(made);
	node.effectId = made._id;
}

/** A card has no item to hold an effect: the node keeps its condition, with a Lasts Until. */
function migrateCardNode(node: NodeSource): void {
	const moments = bareConditionMoments(node);
	delete node.duration;
	if (moments.length > 0 && !Array.isArray(node.lastsUntil)) node.lastsUntil = moments;
}

/** The item part: old rule fields and node durations become item effects with a Lasts Until. */
function migrateItemSource(item: ItemSource, index: ToggleIndex): void {
	migrateModifyToggles(item, index);
	const created: EffectSource[] = [];
	const rules = rulesIn(item.system?.rules);
	for (const rule of rules) {
		if (rule.type === 'toggleEffect') migrateToggle(rule, item, created);
		else if (rule.type === 'applyCondition') migrateApplyCondition(rule, created);
		else if (rule.type === 'markTarget') migrateMarkTarget(rule, item, created);
		else if (rule.type === 'defendOption') migrateDefendOption(rule, created);
	}
	if (item.system && rules.some((rule) => rule.type === 'toggleEffect')) {
		item.system.rules = (item.system.rules as unknown[]).filter(
			(rule) => (rule as RuleSource | null)?.type !== 'toggleEffect',
		);
	}
	eachDurationNode(item.system?.activation?.effects, (node) => migrateItemNode(node, created));
	if (created.length > 0) item.effects = [...(item.effects ?? []), ...created];
}

interface LiveEffect {
	id: string | null;
	origin?: string | null;
	transfer?: boolean;
	statuses?: Iterable<string> | null;
	flags?: Record<string, Record<string, unknown> | undefined> | null;
	system?: { lastsUntil?: Moment[]; rules?: unknown } | null;
}

interface LiveItem {
	uuid?: string | null;
	name?: string | null;
	system?: { identifier?: unknown; rules?: unknown; activation?: { effects?: unknown } } | null;
	effects?: { get(id: string): LiveEffect | undefined | null } | null;
}

interface LiveActor {
	uuid?: string | null;
	flags?: Record<string, Record<string, unknown> | undefined> | null;
	items?: (Iterable<LiveItem> & { get(id: string): LiveItem | undefined | null }) | null;
	effects?: Iterable<LiveEffect> | null;
	update(data: object, operation: object): Promise<unknown>;
	updateEmbeddedDocuments(
		type: 'ActiveEffect',
		updates: object[],
		operation: object,
	): Promise<unknown>;
	createEmbeddedDocuments(
		type: 'ActiveEffect',
		data: object[],
		operation: object,
	): Promise<unknown>;
}

function rulesOf(item: LiveItem | null | undefined): RuleSource[] {
	return rulesIn(item?.system?.rules);
}

/** The item effect's Lasts Until, when the effect is not applied to the item's owner. */
function itemEffectMoments(item: LiveItem, effectId: unknown): Moment[] {
	if (isBlank(effectId)) return [];
	const effect = item.effects?.get(effectId as string);
	if (!effect || effect.transfer !== false) return [];
	return effect.system?.lastsUntil ?? [];
}

/** The moments of a toggle rule: from its old fields, or from its effect. */
function toggleRuleMoments(item: LiveItem, rule: RuleSource): Moment[] {
	if (hasOldToggleFields(rule)) return toggleMoments(rule);
	return itemEffectMoments(item, rule.effectId);
}

/**
 * The events that the actor's rules take out of the toggle's effect: old Modify Toggle rules that
 * name the toggle, and Change an effect rules that name its item.
 */
function droppedEvents(actor: LiveActor, toggleKeys: Set<unknown>, itemIdentifier: string) {
	const dropped = new Set<string>();
	for (const item of actor.items ?? []) {
		for (const rule of rulesOf(item)) {
			if (rule.disabled === true) continue;
			const target = typeof rule.toggleIdentifier === 'string' ? rule.toggleIdentifier.trim() : '';
			if (rule.type === 'modifyToggle' && toggleKeys.has(target)) {
				for (const event of removedMoments(rule)) dropped.add(event);
			} else if (rule.type === 'changeEffect' && rule.itemIdentifier === itemIdentifier) {
				for (const event of filledStrings(rule.removeMoments)) dropped.add(event);
			}
		}
	}
	return dropped;
}

function withoutDropped(moments: Moment[], dropped: Set<string>): Moment[] {
	return moments.filter(
		(moment) => !(moment.kind === 'event' && moment.event && dropped.has(moment.event)),
	);
}

interface ToggleState {
	rules: RuleSource[];
	moments: Moment[];
}

/** What a toggle effect on an actor takes from its item, before or after the item pass. */
function toggleStateOf(actor: LiveActor, item: LiveItem, ruleId: string): ToggleState | null {
	const itemIdentifier = identifierOf(item);
	const rule = rulesOf(item).find((entry) => entry.type === 'toggleEffect' && entry.id === ruleId);
	if (rule) {
		const keys = new Set([rule.identifier, rule.id].filter((key) => !isBlank(key)));
		return {
			rules: stateRules(rule, ruleName(rule, { name: item.name ?? undefined })),
			moments: withoutDropped(
				toggleRuleMoments(item, rule),
				droppedEvents(actor, keys, itemIdentifier),
			),
		};
	}
	const nodes = item.system?.activation?.effects;
	const node = (Array.isArray(nodes) ? nodes : []).find(
		(entry) => entry?.type === 'applyEffect' && entry.id === ruleId,
	) as NodeSource | undefined;
	if (!node || isBlank(node.effectId)) return null;
	const effect = item.effects?.get(node.effectId as string);
	if (!effect) return null;
	return {
		rules: rulesIn(effect.system?.rules)
			.filter((entry) => entry.type === 'tags' || entry.type === 'emptyPoolsAtEnd')
			.map((entry) => foundry.utils.deepClone(entry)),
		moments: withoutDropped(
			effect.system?.lastsUntil ?? [],
			droppedEvents(actor, new Set(), itemIdentifier),
		),
	};
}

/**
 * A toggle effect keeps its moments (or gets them when it has none), gets the state rules of its
 * item's toggle, takes the item as its origin, and loses the toggle flags.
 */
function toggleEffectUpdate(
	actor: LiveActor,
	effect: LiveEffect,
	flags: Record<string, unknown>,
): Record<string, unknown> {
	const update: Record<string, unknown> = { _id: effect.id };
	const itemId = flags[TOGGLE_ITEM_FLAG];
	const item = isBlank(itemId) ? null : actor.items?.get(itemId as string);
	const ruleId = flags[TOGGLE_RULE_FLAG];
	const state = item && !isBlank(ruleId) ? toggleStateOf(actor, item, ruleId as string) : null;
	if (state) {
		if ((effect.system?.lastsUntil ?? []).length === 0 && state.moments.length > 0) {
			update['system.lastsUntil'] = foundry.utils.deepClone(state.moments);
		}
		const own = rulesIn(effect.system?.rules);
		const ownIds = new Set(own.map((rule) => rule.id));
		const added = state.rules.filter((rule) => !ownIds.has(rule.id));
		if (added.length > 0) update['system.rules'] = [...own, ...added];
	}
	if (item?.uuid && isBlank(effect.origin)) update.origin = item.uuid;
	const round = flags[OLD_ACTIVITY_ROUND_FLAG];
	const combatId = flags[OLD_ACTIVITY_COMBAT_FLAG];
	if (typeof round === 'number' && typeof combatId === 'string') {
		update[`flags.${SYSTEM_ID}.${LAST_ACTIVITY_FLAG}`] = { combatId, round };
	}
	for (const flag of [
		TOGGLE_RULE_FLAG,
		TOGGLE_ITEM_FLAG,
		OLD_ACTIVITY_ROUND_FLAG,
		OLD_ACTIVITY_COMBAT_FLAG,
	]) {
		if (flag in flags) {
			update[`flags.${SYSTEM_ID}.${flag}`] = new foundry.data.operators.ForcedDeletion();
		}
	}
	return update;
}

/** A marker of a rule that ended its marks when combat ended. */
function markerEndsAtCombatEnd(itemUuid: unknown): boolean {
	if (isBlank(itemUuid)) return false;
	let item: LiveItem | null = null;
	try {
		item = fromUuidSync(itemUuid as string) as LiveItem | null;
	} catch {
		return false;
	}
	if (!item) return false;
	return rulesOf(item).some(
		(rule) =>
			rule.type === 'markTarget' &&
			(rule.endsAtEncounterEnd === true ||
				itemEffectMoments(item, rule.effectId).some(
					(moment) => moment.kind === 'event' && moment.event === 'combatEnd',
				)),
	);
}

/** The update of one effect on an actor, or null when it keeps its Lasts Until. */
function actorEffectUpdate(actor: LiveActor, effect: LiveEffect): Record<string, unknown> | null {
	if (!effect.id) return null;
	const flags = effect.flags?.[SYSTEM_ID] ?? {};
	if (TOGGLE_RULE_FLAG in flags || TOGGLE_ITEM_FLAG in flags) {
		return toggleEffectUpdate(actor, effect, flags);
	}
	if ((effect.system?.lastsUntil ?? []).length > 0) return null;
	if (!isBlank(flags[MARKER_FLAG])) {
		return markerEndsAtCombatEnd(flags[MARKER_FLAG])
			? { _id: effect.id, 'system.lastsUntil': [eventMoment('combatEnd')] }
			: null;
	}
	if (new Set(effect.statuses ?? []).has('despair')) {
		return { _id: effect.id, 'system.lastsUntil': foundry.utils.deepClone(DESPAIR_MOMENTS) };
	}
	return null;
}

interface LiveCombat {
	started?: boolean;
	round?: number | null;
	turn?: number | null;
	turns?: Array<{ actor?: { uuid?: string | null } | null }> | null;
}

interface DefendRecordSource {
	id?: string;
	options?: Array<{ label?: string; itemUuid?: string | null }>;
}

/** A copy of `roundMarkHolds` as it was when this migration was written, for the combat the mark names. */
function wholeRoundHolds(whole: WholeRoundDefend, combat: LiveCombat, actorUuid: string): boolean {
	const round = Number(whole.round);
	const turn = Number(whole.turn);
	if (!combat.started || !Number.isFinite(round) || !Number.isFinite(turn)) return false;
	const own = (combat.turns ?? []).findIndex((each) => each.actor?.uuid === actorUuid);
	const nowRound = combat.round ?? 0;
	if (own < 0) return round === nowRound;
	const nextOwnRound = own > turn ? round : round + 1;
	return nowRound < nextOwnRound || (nowRound === nextOwnRound && (combat.turn ?? 0) < own);
}

/** The item of the Defend option the hero used, from the record on the attack card. */
function defendItem(whole: WholeRoundDefend): { uuid?: string; img?: string | null } | null {
	const system = game.messages?.get(whole.messageId)?.system as
		| { defends?: DefendRecordSource[] }
		| undefined;
	const record = system?.defends?.find((entry) => entry.id === whole.recordId);
	const itemUuid = record?.options?.find((use) => use.label === whole.label)?.itemUuid;
	if (!itemUuid) return null;
	try {
		return fromUuidSync(itemUuid) as { uuid?: string; img?: string | null } | null;
	} catch {
		return null;
	}
}

/** A copy of `roundDefendEffectData` as it was when this migration was written. */
function roundDefendEffect(actor: LiveActor, whole: WholeRoundDefend): Record<string, unknown> {
	const item = defendItem(whole);
	return {
		name: whole.label || game.i18n?.localize('NIMBLE.chat.defend.confirmDefend') || 'Defend',
		img: item?.img || ROUND_DEFEND_IMG,
		type: NIMBLE_EFFECT_TYPE,
		origin: item?.uuid ?? actor.uuid ?? null,
		system: { lastsUntil: [{ ...HOLDER_TURN_STARTS }] },
		flags: { [SYSTEM_ID]: { [ROUND_DEFEND_FLAG]: whole } },
	};
}

function hasRoundDefendEffect(actor: LiveActor, recordId: string): boolean {
	return [...(actor.effects ?? [])].some((effect) => {
		const whole = effect.flags?.[SYSTEM_ID]?.[ROUND_DEFEND_FLAG] as
			| { recordId?: string }
			| undefined;
		return whole?.recordId === recordId;
	});
}

/** The old flag of a Defend that still holds becomes the Timed Effect; the flag goes. */
async function migrateWholeRoundDefend(actor: LiveActor): Promise<void> {
	const systemFlags = actor.flags?.[SYSTEM_ID];
	if (!systemFlags || !(WHOLE_ROUND_DEFEND_FLAG in systemFlags)) return;
	const whole = systemFlags[WHOLE_ROUND_DEFEND_FLAG] as WholeRoundDefend | null;
	const combat = whole?.combatId ? (game.combats?.get(whole.combatId) ?? null) : null;
	if (
		whole &&
		combat &&
		actor.uuid &&
		wholeRoundHolds(whole, combat, actor.uuid) &&
		!hasRoundDefendEffect(actor, whole.recordId)
	) {
		await actor.createEmbeddedDocuments('ActiveEffect', [roundDefendEffect(actor, whole)], {
			noHook: true,
		});
	}
	await actor.update(
		{
			[`flags.${SYSTEM_ID}.${WHOLE_ROUND_DEFEND_FLAG}`]:
				new foundry.data.operators.ForcedDeletion(),
		},
		{ noHook: true },
	);
}

function reportError(uuid: string | null | undefined, error: unknown): void {
	console.error(`Nimble Migration | 088 failed for ${uuid ?? 'a document'}:`, error);
}

async function migrateActor(actor: LiveActor): Promise<void> {
	try {
		const updates = [...(actor.effects ?? [])]
			.map((effect) => actorEffectUpdate(actor, effect))
			.filter((update): update is Record<string, unknown> => update !== null);
		if (updates.length > 0) {
			await actor.updateEmbeddedDocuments('ActiveEffect', updates, { noHook: true });
		}
		await migrateWholeRoundDefend(actor);
	} catch (error) {
		reportError(actor.uuid, error);
	}
}

interface LiveMessage {
	uuid?: string | null;
	system?: unknown;
	update(data: object, operation: object): Promise<unknown>;
}

/** A chat card keeps the condition on its Apply Effect node, so the duration becomes the node's Lasts Until. */
async function migrateMessage(message: LiveMessage): Promise<void> {
	const tree = (message.system as { activation?: { effects?: unknown } } | undefined)?.activation
		?.effects;
	if (!Array.isArray(tree)) return;
	const copy = foundry.utils.deepClone(tree);
	eachDurationNode(copy, migrateCardNode);
	if (JSON.stringify(copy) === JSON.stringify(tree)) return;
	try {
		await message.update({ 'system.activation.effects': copy }, { noHook: true });
	} catch (error) {
		reportError(message.uuid, error);
	}
}

function toggleIndexOf(items: unknown): ToggleIndex {
	const index: ToggleIndex = new Map();
	for (const item of Array.isArray(items) ? (items as ItemSource[]) : []) {
		if (item && typeof item === 'object') addToggles(index, item.system?.rules, identifierOf(item));
	}
	return index;
}

/**
 * The end fields of rules and nodes (turn-off events, inactive rounds, core durations, combat end,
 * the attacker's turn) become item effects with a Lasts Until, and the rules point at them. A
 * Toggle Effect becomes a step that applies its effect to the user, with Tags and Empty pools at
 * end on the effect; a Modify Toggle becomes Use an item for free and Change an effect. A chat
 * card's node keeps its condition with a Lasts Until. The effects on actors that those rules made
 * get the same Lasts Until and state rules; a Despair with none gets the default; a whole-round
 * Defend flag that still holds becomes its Timed Effect.
 */
class Migration088LastsUntilVocabularies extends MigrationBase {
	static override readonly version = 88;

	override readonly version = Migration088LastsUntilVocabularies.version;

	#worldToggles: ToggleIndex | null = null;

	/** Read once, before the item pass changes the world items. */
	#worldToggleIndex(): ToggleIndex {
		if (this.#worldToggles) return this.#worldToggles;
		const index: ToggleIndex = new Map();
		for (const item of (game.items ?? []) as Iterable<LiveItem>) {
			addToggles(index, item.system?.rules, identifierOf(item));
		}
		this.#worldToggles = index;
		return index;
	}

	/** All items of the actor at once, while each one still has its toggle rules. */
	override async updateActor(source: any): Promise<void> {
		if (!source || typeof source !== 'object' || !Array.isArray(source.items)) return;
		const index = toggleIndexOf(source.items);
		for (const item of source.items as ItemSource[]) {
			if (item && typeof item === 'object') migrateModifyToggles(item, index);
		}
	}

	override async updateItem(source: any, parent?: any): Promise<void> {
		if (!source || typeof source !== 'object') return;
		const index = toggleIndexOf([source]);
		const others = Array.isArray(parent?.items)
			? toggleIndexOf(parent.items)
			: this.#worldToggleIndex();
		for (const [key, identifier] of others) if (!index.has(key)) index.set(key, identifier);
		migrateItemSource(source, index);
	}

	override async migrate(): Promise<void> {
		for (const actor of game.actors ?? []) await migrateActor(actor);
		for (const scene of game.scenes ?? []) {
			for (const token of scene.tokens) {
				if (token.actorLink || !token.actor) continue;
				await migrateActor(token.actor);
			}
		}
		for (const message of game.messages ?? []) await migrateMessage(message);
	}
}

export { Migration088LastsUntilVocabularies };
