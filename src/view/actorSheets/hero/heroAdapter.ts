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
import { deriveDurationDetails, expandDurationLabel } from '#utils/formatDuration.js';
import {
	getHeroicReactionAvailability,
	HEROIC_REACTIONS,
} from '#utils/incomingReactions/heroicActions.js';
import localize from '#utils/localize.js';
import { getTargetedTokens, getTargetName } from '#utils/tokens/targeting.js';
import prepareActorConditions, {
	type ActorCondition,
} from '#view/dataPreparationHelpers/prepareActorConditions.js';
import getDeterministicBonus from '../../../dice/getDeterministicBonus.js';
import {
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	TOGGLE_EFFECT_RULE_ID_FLAG,
} from '../../../models/rules/toggleEffect.js';
import { CONDITIONS_CHANGED_HOOK } from '../../../settings/customConditionSettings.js';
import { plainText } from '../shared/plainText.ts';
import type { ConditionLike, EffectLike, ItemLike, RuleLike } from '../shared/sheetSource.ts';
import { baseMaxActions, combatantOf, mayAddAction } from './heroActions.ts';
import { heroItemStates } from './heroItemState.ts';
import type {
	HeroActorLike,
	HeroCombatState,
	HeroSheetContext,
	HeroSource,
	RolledValue,
} from './heroSource.ts';

/** Item effects and the condition list are not on `actor.reactive`, so these hooks redraw them. */
const POOL_HOOKS = [
	systemHookName('dicePool.changed'),
	systemHookName('dicePool.refilled'),
	systemHookName('chargePool.changed'),
	systemHookName('chargePool.recovered'),
	'createActiveEffect',
	'updateActiveEffect',
	'deleteActiveEffect',
	CONDITIONS_CHANGED_HOOK,
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

type EffectDocument = ActiveEffect & {
	parent?: { documentName?: string; id?: string | null } | null;
	isTemporary?: boolean;
	description?: string;
	duration?: Parameters<typeof deriveDurationDetails>[0];
};

/** Same split as the old Conditions tab: an effect that no item keeps on is temporary. */
function isTemporary(effect: EffectDocument, fromItem: boolean): boolean {
	if (!fromItem) return true;
	if (typeof effect.isTemporary === 'boolean') return effect.isTemporary;
	const duration = effect.duration as { remaining?: number; rounds?: number } | undefined;
	return (
		typeof duration?.remaining === 'number' ||
		(typeof duration?.rounds === 'number' && duration.rounds > 0)
	);
}

function durationWords(label: string): string {
	return label === '∞' ? '' : expandDurationLabel(label, (key) => localize(key));
}

function effectLike(effect: EffectDocument): EffectLike {
	const itemId = effect.parent?.documentName === 'Item' ? (effect.parent.id ?? null) : null;
	const ruleId = effect.getFlag?.(SYSTEM_ID as 'core', TOGGLE_EFFECT_RULE_ID_FLAG as never);
	const toggleItemId = effect.getFlag?.(SYSTEM_ID as 'core', TOGGLE_EFFECT_ITEM_ID_FLAG as never);
	return {
		id: effect.id ?? '',
		name: effect.name ?? '',
		img: effect.img ?? '',
		disabled: effect.disabled === true,
		statuses: [...(effect.statuses ?? [])],
		origin: (effect.origin as string | null) ?? null,
		itemId,
		toggle:
			typeof ruleId === 'string'
				? { itemId: typeof toggleItemId === 'string' ? toggleItemId : '', ruleId }
				: null,
		temporary: isTemporary(effect, !!itemId || !!effect.origin),
		duration: durationWords(deriveDurationDetails(effect.duration).label),
		description: plainText(effect.description ?? ''),
	};
}

function conditionLike(condition: ActorCondition): ConditionLike {
	return {
		id: condition.id,
		name: condition.name,
		img: condition.img,
		active: condition.active,
		description: plainText(condition.descriptionHtml),
		duration: durationWords(condition.durationLabel),
		source: condition.active ? condition.sourceLabel : '',
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
				wounds: {
					value: attributes.wounds.value,
					max: attributes.wounds.max,
					bonus: attributes.wounds.bonus ?? 0,
				},
				armor: { value: attributes.armor.value },
				initiative: {
					mod: attributes.initiative.mod ?? 0,
					defaultRollMode: attributes.initiative.defaultRollMode ?? 0,
					bonuses: attributes.initiative.bonuses ?? '',
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
			resources: {
				mana: { ...system.resources.mana },
				highestUnlockedSpellTier: system.resources.highestUnlockedSpellTier ?? null,
				inspiration: system.resources.inspiration === true,
			},
			levelUpHistory: [...(system.levelUpHistory ?? [])],
			conditionImmunities: [...(system.conditionImmunities ?? [])],
			currency: { ...system.currency },
			inventory: {
				totalSlots: system.inventory.totalSlots ?? 0,
				usedSlots: system.inventory.usedSlots ?? 0,
				bonusSlots: system.inventory.bonusSlots ?? 0,
				containerCapacityUsage: { ...(system.inventory.containerCapacityUsage ?? {}) },
			},
			details: {
				age: system.details.age ?? '',
				height: system.details.height ?? '',
				weight: system.details.weight ?? '',
				gender: system.details.gender ?? '',
				notes: system.details.notes ?? '',
			},
		},
		flags: {
			showPassiveSkillScores: flags?.showPassiveSkillScores === true,
			actorImageXOffset: Number(flags?.actorImageXOffset ?? 0),
			actorImageYOffset: Number(flags?.actorImageYOffset ?? 0),
			actorImageScale: Number(flags?.actorImageScale ?? 100),
			spellsBy: flags?.spellsBy === 'school' ? 'school' : 'tier',
			trackInventorySlots: flags?.trackInventorySlots !== false,
			includeCurrencyBulk: flags?.includeCurrencyBulk !== false,
			automaticallyExecuteAvailableMacros: flags?.automaticallyExecuteAvailableMacros !== false,
		},
		items: source.items.map((item) => itemLike(item, actor)),
		// item effects live on their item, so `actor.effects` alone would leave them out
		effects: [...actor.allApplicableEffects()].map((effect) =>
			effectLike(effect as EffectDocument),
		),
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
		featureGroups: localizeAll(config.featureGroupHeadings ?? {}),
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
	/** the Bio notes, enriched by the Application (enrichment is async) */
	enrichedNotes: () => string;
	/** the descriptions of the open item rows, enriched by the Application */
	enrichedDescriptions: () => Record<string, string>;
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
			enrichedNotes: extras.enrichedNotes(),
			enrichedDescriptions: extras.enrichedDescriptions(),
			labels: labels(hero, actor.ancestry?.identifier ?? null),
			conditions: prepareActorConditions(actor as unknown as Actor.Implementation, {
				includeInactive: true,
			}).map(conditionLike),
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
