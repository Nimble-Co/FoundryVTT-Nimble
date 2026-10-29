import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '#documents/actor/character.js';
import {
	getCombatantAdditionalActions,
	getCombatantBaseActions,
	getCombatantPendingActionDelta,
	isCombatantDying,
} from '#documents/combat/combatantSystem.js';
import { SYSTEM_ID, systemHookName } from '#system';
import { getActorDyingActionLimit } from '#utils/actor/actorHealthState.js';
import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
import { registerCombatStateHooks } from '#utils/combat/combatState.js';
import { getActiveCombatant } from '#utils/combat/combatTurnSync.js';
import { initiativeRollLock } from '#utils/combat/initiativeRollLock.js';
import { getUnarmedDamageFormula } from '#utils/damage/attackUtils.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import getLanguageName from '#utils/documents/getLanguageName.js';
import {
	getHeroicReactionAvailability,
	HEROIC_REACTIONS,
} from '#utils/incomingReactions/heroicActions.js';
import localize from '#utils/localize.js';
import { getTargetedTokens, getTargetName } from '#utils/tokens/targeting.js';
import getDeterministicBonus from '../../../dice/getDeterministicBonus.js';
import type { EffectLike, ItemLike, RuleLike } from '../shared/sheetSource.ts';
import { baseMaxActions, combatantOf, mayAddAction } from './heroActions.ts';
import { heroItemStates } from './heroItemState.ts';
import type {
	HeroActorLike,
	HeroCombatState,
	HeroSheetContext,
	HeroSource,
	RolledValue,
} from './heroSource.ts';

const POOL_HOOKS = [
	systemHookName('dicePool.changed'),
	systemHookName('dicePool.refilled'),
	systemHookName('chargePool.changed'),
	systemHookName('chargePool.recovered'),
];

function registerPoolHooks(listener: () => void): () => void {
	const hooks = Hooks as unknown as {
		on: (hook: string, listener: () => void) => number;
		off: (hook: string, id: number) => void;
	};
	const ids = [...POOL_HOOKS, 'targetToken'].map(
		(name) => [name, hooks.on(name, listener)] as const,
	);
	return () => {
		for (const [name, id] of ids) hooks.off(name, id);
	};
}

type AnyRecord = Record<string, unknown>;

function ruleLike(
	rule: AnyRecord & { appliesTo?: () => boolean; toObject?: () => AnyRecord },
	actor: NimbleCharacter,
): RuleLike {
	const fields = rule.toObject?.() ?? {};
	const value = fields.value;
	let amount: number | undefined;
	if (typeof value === 'number') amount = value;
	else if (typeof value === 'string' && value.trim()) {
		amount = getDeterministicBonus(value, actor.getRollData()) ?? undefined;
	}
	return {
		id: String(rule.id ?? ''),
		type: String(rule.type ?? ''),
		active: rule.disabled !== true && (rule.appliesTo?.() ?? true),
		amount,
		fields,
	};
}

function itemLike(item: Item, actor: NimbleCharacter): ItemLike {
	const rules = (item as unknown as { rules?: Map<string, AnyRecord> }).rules;
	return {
		id: item.id ?? '',
		uuid: item.uuid ?? '',
		name: item.name ?? '',
		img: item.img ?? '',
		type: item.type,
		system: item.system as unknown as AnyRecord,
		rules: rules ? [...rules.values()].map((rule) => ruleLike(rule, actor)) : [],
	};
}

function effectLike(effect: ActiveEffect): EffectLike {
	return {
		id: effect.id ?? '',
		name: effect.name ?? '',
		img: effect.img ?? '',
		disabled: effect.disabled === true,
		statuses: [...(effect.statuses ?? [])],
		origin: (effect.origin as string | null) ?? null,
	};
}

function rolled<K extends string>(
	entries: Partial<Record<K, { mod?: number; defaultRollMode?: number }>>,
): Record<K, RolledValue> {
	return Object.fromEntries(
		Object.entries<{ mod?: number; defaultRollMode?: number } | undefined>(entries ?? {}).map(
			([key, value]) => [
				key,
				{ mod: value?.mod ?? 0, defaultRollMode: value?.defaultRollMode ?? 0 },
			],
		),
	) as Record<K, RolledValue>;
}

function actorLike(actor: NimbleCharacter): HeroActorLike {
	const source = actor.reactive;
	const system = source.system as unknown as AnyRecord & HeroActorLike['system'];
	const { attributes } = system;
	const flags = (source.flags as AnyRecord)[SYSTEM_ID] as AnyRecord | undefined;
	return {
		id: source.id ?? '',
		name: source.name ?? '',
		img: source.img ?? '',
		system: {
			abilities: rolled(system.abilities),
			savingThrows: rolled(system.savingThrows),
			skills: rolled(system.skills),
			attributes: {
				hp: { ...attributes.hp },
				wounds: { ...attributes.wounds },
				armor: { value: attributes.armor.value },
				initiative: {
					mod: attributes.initiative.mod ?? 0,
					defaultRollMode: attributes.initiative.defaultRollMode ?? 0,
				},
				movement: { ...attributes.movement },
				sizeCategory: attributes.sizeCategory,
				hitDice: foundry.utils.deepClone(attributes.hitDice ?? {}),
				bonusHitDice: [...(attributes.bonusHitDice ?? [])],
				hitDiceSizeBonus: attributes.hitDiceSizeBonus ?? 0,
				damageResistances: [...(attributes.damageResistances ?? [])],
				damageImmunities: [...(attributes.damageImmunities ?? [])],
				damageVulnerabilities: [...(attributes.damageVulnerabilities ?? [])],
			},
			proficiencies: {
				languages: [...(system.proficiencies.languages ?? [])],
				armor: [...(system.proficiencies.armor ?? [])],
				weapons: [...(system.proficiencies.weapons ?? [])],
			},
			resources: { mana: { ...system.resources.mana } },
			levelUpHistory: [...(system.levelUpHistory ?? [])],
			conditionImmunities: [...(system.conditionImmunities ?? [])],
		},
		flags: {
			showPassiveSkillScores: flags?.showPassiveSkillScores === true,
			actorImageXOffset: Number(flags?.actorImageXOffset ?? 0),
			actorImageYOffset: Number(flags?.actorImageYOffset ?? 0),
			actorImageScale: Number(flags?.actorImageScale ?? 100),
			spellsBy: flags?.spellsBy === 'school' ? 'school' : 'tier',
		},
		items: source.items.map((item) => itemLike(item, actor)),
		effects: source.effects.map(effectLike),
	};
}

function combatState(actor: NimbleCharacter): HeroCombatState | null {
	const found = combatantOf(actor.id);
	if (!found) return null;
	const { combat, combatant } = found;

	const base = getCombatantBaseActions(combatant);
	const additional = getCombatantAdditionalActions(combatant);
	const max = isCombatantDying(combatant)
		? Math.min(baseMaxActions(base), getActorDyingActionLimit(combatant.actor))
		: baseMaxActions(base);
	return {
		initiativeRolled: combatant.initiative !== null,
		initiativePending: initiativeRollLock.hasActiveLock(combatant),
		isTurn: combat.started === true && getActiveCombatant(combat)?.actorId === actor.id,
		actions: {
			current: base.current,
			effectiveMax: max + additional,
			pendingDelta: getCombatantPendingActionDelta(combatant),
			mayAdd: mayAddAction(base, additional),
		},
		reactionsSpent: HEROIC_REACTIONS.filter(
			(key) => !getHeroicReactionAvailability(combatant as Combatant.Implementation, key),
		),
	};
}

function localizeAll(keys: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(keys).map(([key, name]) => [key, localize(name)]));
}

function labels(actor: HeroActorLike, ancestryIdentifier: string | null) {
	const config = CONFIG.NIMBLE as unknown as Record<string, Record<string, string>>;
	return {
		conditions: localizeAll(config.conditions ?? {}),
		damageTypes: localizeAll(config.damageTypes ?? {}),
		armorTypes: localizeAll(config.armorTypesPlural ?? {}),
		spellSchools: localizeAll(config.spellSchools ?? {}),
		languages: Object.fromEntries(
			actor.system.proficiencies.languages.map((key) => [
				key,
				getLanguageName(key, { ancestryIdentifier }),
			]),
		),
	};
}

export interface HeroSourceExtras {
	/** the levels that the Application's audit found with a missed choice */
	missingLevelSelections: () => number[];
	/** the actor has a rule that gives mana only when you roll Initiative */
	manaFromInitiative: () => boolean;
}

/** Builds the plain view-model input of the character sheet from `actor.reactive`. */
export function createHeroSource(actor: NimbleCharacter, extras: HeroSourceExtras) {
	const subscribeCombat = createSubscriber(registerCombatStateHooks);
	const subscribePools = createSubscriber(registerPoolHooks);

	return (): HeroSource => {
		subscribeCombat();
		subscribePools();
		const hero = actorLike(actor);
		const context: HeroSheetContext = {
			localize: (key) => localize(key),
			format: (key, data) => localize(key, data),
			combat: combatState(actor),
			manaFromInitiative: extras.manaFromInitiative(),
			missingLevelSelections: extras.missingLevelSelections(),
			labels: labels(hero, actor.ancestry?.identifier ?? null),
			skillAbilities: {
				...(CONFIG.NIMBLE.defaultSkillAbilities as HeroSheetContext['skillAbilities']),
			},
			dicePools: getDicePools(actor as unknown as Actor.Implementation).map((pool) => ({
				...pool,
				faces: [...pool.faces],
			})),
			chargePools: getChargePools(actor as unknown as Actor.Implementation).map((pool) => ({
				...pool,
			})),
			itemState: heroItemStates(actor),
			targets: getTargetedTokens(actor.id ?? '').map((token) => getTargetName(token)),
			unarmedDamage: getUnarmedDamageFormula(
				actor as unknown as Parameters<typeof getUnarmedDamageFormula>[0],
			),
		};
		return { actor: hero, context };
	};
}
