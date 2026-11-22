import { SYSTEM_ID } from '#system';
import { isCompendiumId, toInstalledId, toPackSourceId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type Json = Record<string, unknown>;

/** Migration 076 wrote this rule onto Latched On. The condition carries cannot-miss now. */
const OLD_LATCHED_RULE = 'latchedCannotMis';

const GREAT_WORM = 'Compendium.nimble.nimble-monsters.Actor.lQ83gZRlm3bTgsbp';
const SWALLOWED_ITEM = `${GREAT_WORM}.Item.Zp4cNwRt9LkGvHqD`;

const HELD_CREATURE_FLAG = 'heldCreature';
const LINKED_ACTOR_FLAG = 'linkedActorUuid';

/** A copy of the condition rules added after these effects were first made. */
const CONDITION_RULES: Record<string, Json> = {
	swallowed: {
		id: 'swallowedAttacks',
		type: 'attackOutcome',
		side: 'yourAttacks',
		cannotMiss: true,
		ignoreArmor: true,
	},
	latched: {
		id: 'latchedAttacks',
		type: 'attackOutcome',
		side: 'yourAttacks',
		cannotMiss: true,
	},
};

function isRecord(value: unknown): value is Json {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function dieMoment(who: 'holder' | 'linked'): Json {
	return {
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who,
		event: 'die',
		effectName: '',
	};
}

const LATCHED_LASTS_UNTIL = [dieMoment('holder'), dieMoment('linked')];

function statusesOf(effect: Json): string[] {
	return Array.isArray(effect.statuses)
		? effect.statuses.filter((status): status is string => typeof status === 'string')
		: [];
}

function systemOf(effect: Json): Json {
	const current = effect.system;
	if (isRecord(current)) return current;
	const created: Json = {};
	effect.system = created;
	return created;
}

function rulesOf(effect: Json): Json[] | null {
	const system = systemOf(effect);
	if (system.rules === undefined) system.rules = [];
	return Array.isArray(system.rules) ? system.rules.filter(isRecord) : null;
}

function addRule(effect: Json, status: string): void {
	const rule = CONDITION_RULES[status];
	const rules = rule ? rulesOf(effect) : null;
	if (!rule || !rules || rules.some((entry) => entry.id === rule.id)) return;
	rules.push(foundry.utils.deepClone(rule));
	systemOf(effect).rules = rules;
}

function systemFlags(document: Json): Json | null {
	const flags = document.flags;
	if (!isRecord(flags)) return null;
	const bag = flags[SYSTEM_ID];
	return isRecord(bag) ? bag : null;
}

function heldUuid(actor: Json): string | null {
	const held = systemFlags(actor)?.[HELD_CREATURE_FLAG];
	if (!isRecord(held) || typeof held.uuid !== 'string' || held.uuid === '') return null;
	return held.uuid;
}

function linkedUuid(effect: Json): string | null {
	const uuid = systemFlags(effect)?.[LINKED_ACTOR_FLAG];
	return typeof uuid === 'string' && uuid ? uuid : null;
}

function copyHeldCreature(effect: Json, actor: Json): void {
	if (linkedUuid(effect)) return;
	const uuid = heldUuid(actor);
	if (!uuid) return;
	const flags: Json = isRecord(effect.flags) ? effect.flags : {};
	effect.flags = flags;
	const existing = flags[SYSTEM_ID];
	const bag: Json = isRecord(existing) ? existing : {};
	flags[SYSTEM_ID] = bag;
	bag[LINKED_ACTOR_FLAG] = uuid;
}

function giveLatchedAnEnd(effect: Json): void {
	const system = systemOf(effect);
	if (Array.isArray(system.lastsUntil) && system.lastsUntil.length > 0) return;
	system.lastsUntil = foundry.utils.deepClone(LATCHED_LASTS_UNTIL);
}

/** The description a Great Worm shows for Swallowed, as the pack item has it. */
function swallowedFeature(): Json {
	return {
		_id: foundry.utils.randomID(),
		name: 'Swallowed.',
		type: 'monsterFeature',
		img: 'icons/svg/cave.svg',
		system: {
			macro: '',
			identifier: '',
			rules: [],
			activation: {
				acquireTargetsFromTemplate: false,
				cost: { details: '', quantity: 1, type: 'none', isReaction: false },
				duration: { details: '', quantity: 1, type: 'none' },
				effects: [],
				showDescription: true,
				targets: { count: 1, restrictions: '', attackType: '', distance: 1 },
				template: { length: 1, radius: 1, shape: '', width: 1 },
			},
			description:
				'<p>You take 20 damage at the start of your turn. Your attacks cannot miss and ignore armor.</p>',
			subtype: 'feature',
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
		_stats: { compendiumSource: toInstalledId(SWALLOWED_ITEM) },
	};
}

/**
 * Live Latched and Swallowed effects were made before the condition carried its rules and its
 * end. Stirges still have the cannot-miss rule Migration 076 put on Latched On, and Great Worms
 * made before this version have no Swallowed. feature.
 */
class Migration094MonsterConditions extends MigrationBase {
	static override readonly version = 94;

	override readonly version = Migration094MonsterConditions.version;

	override readonly title = 'Monster conditions';

	override readonly kind: MigrationKind = 'content';

	/** Latched and Swallowed effects on a creature, not an effect stored on an item. */
	override async alwaysUpdateEffect(source: any, parent?: any): Promise<void> {
		if (!isRecord(source) || !isRecord(parent) || !Array.isArray(parent.items)) return;
		const statuses = statusesOf(source);
		for (const status of statuses) addRule(source, status);
		if (!statuses.includes('latched')) return;
		giveLatchedAnEnd(source);
		copyHeldCreature(source, parent);
	}

	override async updateItem(source: any): Promise<void> {
		if (!isRecord(source) || !isRecord(source.system) || !Array.isArray(source.system.rules))
			return;
		const rules = source.system.rules.filter(isRecord);
		if (!rules.some((rule) => rule.id === OLD_LATCHED_RULE)) return;
		source.system.rules = source.system.rules.filter(
			(rule: unknown) => !isRecord(rule) || rule.id !== OLD_LATCHED_RULE,
		);
		console.log(`Nimble Migration | ${source.name}: removed ${OLD_LATCHED_RULE}`);
	}

	override async updateActor(source: any): Promise<void> {
		if (!isRecord(source) || !Array.isArray(source.items) || !this.#isGreatWorm(source)) return;
		const items = source.items.filter(isRecord);
		if (items.some((item) => this.#isSwallowed(item))) return;
		source.items.push(swallowedFeature());
		console.log(`Nimble Migration | ${source.name}: Swallowed.`);
	}

	#isGreatWorm(source: Json): boolean {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (sourceId === GREAT_WORM) return true;
		if (isCompendiumId(sourceId)) return false;
		return typeof source.name === 'string' && source.name.trim().toLowerCase() === 'great worm';
	}

	#isSwallowed(item: Json): boolean {
		if (toPackSourceId(this.getSourceId(item)) === SWALLOWED_ITEM) return true;
		const name =
			typeof item.name === 'string' ? item.name.trim().toLowerCase().replace(/\.$/, '') : '';
		return item.type === 'monsterFeature' && name === 'swallowed';
	}
}

export { Migration094MonsterConditions };
