import getDeterministicBonus from '../dice/getDeterministicBonus.js';

interface CombatManaRuleLike {
	id?: string;
	type?: string;
	disabled?: boolean;
	resource?: string;
	trigger?: string;
	clearOn?: string;
	formula?: string;
	getGrantAmount?: () => number;
}

interface CombatManaGrantState {
	mana?: number;
}

type CombatManaGrantMap = Record<string, CombatManaGrantState>;

type ActorWithCollections = Actor & {
	items?: Iterable<Record<string, unknown>>;
	getFlag?: (scope: string, key: string) => unknown;
	getRollData?: () => Record<string, unknown>;
};

const COMBAT_MANA_FLAG_SCOPE = 'nimble';
const COMBAT_MANA_FLAG_KEY = 'combatManaGrants';
const sourceRuleCache = new Map<string, Record<string, unknown>[]>();

function getItemSourceId(item: {
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
}): string | undefined {
	return item.sourceId ?? item._stats?.compendiumSource ?? item.flags?.core?.source;
}

function normalizeGrantMap(value: unknown): CombatManaGrantMap {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return foundry.utils.deepClone(value as CombatManaGrantMap);
}

function isCombatManaRuleType(rule: Pick<CombatManaRuleLike, 'type'>): boolean {
	return rule.type === 'combatMana';
}

function isCombatManaRule(rule: CombatManaRuleLike): boolean {
	return isCombatManaRuleType(rule) && !rule.disabled;
}

function isManaResourceRule(rule: CombatManaRuleLike): boolean {
	return (rule.resource ?? 'mana') === 'mana';
}

function isInitiativeTriggerRule(rule: CombatManaRuleLike): boolean {
	return (rule.trigger ?? 'initiativeRoll') === 'initiativeRoll';
}

function isCombatEndClearRule(rule: CombatManaRuleLike): boolean {
	return (rule.clearOn ?? 'combatEnd') === 'combatEnd';
}

function fromRuleSource(
	source: Record<string, unknown>,
	actor: ActorWithCollections,
): CombatManaRuleLike {
	return {
		id: source.id as string | undefined,
		type: source.type as string | undefined,
		disabled: Boolean(source.disabled ?? false),
		resource: source.resource as string | undefined,
		trigger: source.trigger as string | undefined,
		clearOn: source.clearOn as string | undefined,
		formula: source.formula as string | undefined,
		getGrantAmount: () => {
			const formula = String(source.formula ?? '0');
			const rollData = actor.getRollData?.() ?? {};
			return Math.max(0, Number(getDeterministicBonus(formula, rollData as any) ?? 0));
		},
	};
}

function getRuleSourcesFromItemSource(item: {
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
}): Record<string, unknown>[] {
	const sourceId = getItemSourceId(item);
	if (!sourceId) return [];

	const cachedRules = sourceRuleCache.get(sourceId);
	if (cachedRules && cachedRules.length > 0) {
		return foundry.utils.deepClone(cachedRules);
	}

	const fromUuidSyncFn = (globalThis as Record<string, unknown>).fromUuidSync as
		| ((uuid: string) => unknown)
		| undefined;
	if (typeof fromUuidSyncFn !== 'function') return [];

	const sourceItem = fromUuidSyncFn(sourceId) as {
		system?: { rules?: Record<string, unknown>[] };
	} | null;
	const sourceRules = Array.isArray(sourceItem?.system?.rules) ? sourceItem.system.rules : [];
	if (sourceRules.length > 0) {
		sourceRuleCache.set(sourceId, foundry.utils.deepClone(sourceRules));
	}
	return foundry.utils.deepClone(sourceRules);
}

export async function primeActorCombatManaSourceRules(
	actor: Actor | null | undefined,
): Promise<void> {
	if (!actor || actor.type !== 'character') return;

	const fromUuidFn = (globalThis as Record<string, unknown>).fromUuid as
		| ((uuid: string) => Promise<unknown>)
		| undefined;
	if (typeof fromUuidFn !== 'function') return;

	const typedActor = actor as ActorWithCollections;
	const items = typedActor.items;
	if (!items) return;

	const sourceIds = new Set<string>();
	for (const item of Array.from(items)) {
		const itemWithRules = item as {
			sourceId?: string;
			_stats?: { compendiumSource?: string };
			flags?: { core?: { source?: string } };
		};
		const sourceId = getItemSourceId(itemWithRules);
		if (!sourceId) continue;
		sourceIds.add(sourceId);
	}

	for (const sourceId of sourceIds) {
		const cached = sourceRuleCache.get(sourceId);
		if (cached && cached.length > 0) continue;

		try {
			const sourceItem = (await fromUuidFn(sourceId)) as {
				system?: { rules?: Record<string, unknown>[] };
			} | null;
			const sourceRules = Array.isArray(sourceItem?.system?.rules) ? sourceItem.system.rules : [];
			if (sourceRules.length > 0) {
				sourceRuleCache.set(sourceId, foundry.utils.deepClone(sourceRules));
			}
		} catch {}
	}
}

export function getActorCombatManaRules(actor: Actor | null | undefined): CombatManaRuleLike[] {
	if (!actor || actor.type !== 'character') return [];

	const typedActor = actor as ActorWithCollections;
	const rules: CombatManaRuleLike[] = [];
	const seen = new Set<string>();
	const items = typedActor.items;
	if (!items) return rules;

	for (const [index, item] of Array.from(items).entries()) {
		const itemWithRules = item as {
			id?: string;
			uuid?: string;
			type?: string;
			name?: string;
			identifier?: string;
			sourceId?: string;
			_stats?: { compendiumSource?: string };
			flags?: { core?: { source?: string } };
			rules?: { values?: () => Iterable<CombatManaRuleLike> };
			system?: { rules?: Record<string, unknown>[]; parentClass?: string; identifier?: string };
		};
		const itemKey = itemWithRules.uuid ?? itemWithRules.id ?? String(index);
		let hasCombatManaDefinition = false;

		const itemRules = itemWithRules.rules;
		if (itemRules && typeof itemRules.values === 'function') {
			for (const [ruleIndex, rule] of Array.from(itemRules.values()).entries()) {
				if (isCombatManaRuleType(rule)) hasCombatManaDefinition = true;
				if (!isCombatManaRule(rule)) continue;
				const ruleKey = `${itemKey}:${rule.id ?? `managed-${ruleIndex}`}`;
				if (seen.has(ruleKey)) continue;
				seen.add(ruleKey);
				rules.push(rule);
			}
		}

		const ruleSources = itemWithRules.system?.rules ?? [];
		for (const [ruleIndex, source] of ruleSources.entries()) {
			const sourceRule = fromRuleSource(source, typedActor);
			if (isCombatManaRuleType(sourceRule)) hasCombatManaDefinition = true;
			if (!isCombatManaRule(sourceRule)) continue;
			const ruleKey = `${itemKey}:${sourceRule.id ?? `source-${ruleIndex}`}`;
			if (seen.has(ruleKey)) continue;
			seen.add(ruleKey);
			rules.push(sourceRule);
		}

		// Fallback for legacy embedded items that predate rule additions:
		// hydrate rules from their compendium source when no local combatMana definition exists.
		if (!hasCombatManaDefinition) {
			const sourceRules = getRuleSourcesFromItemSource(itemWithRules);
			for (const [ruleIndex, source] of sourceRules.entries()) {
				const sourceRule = fromRuleSource(source, typedActor);
				if (!isCombatManaRule(sourceRule)) continue;
				const ruleKey = `${itemKey}:${sourceRule.id ?? `compendium-${ruleIndex}`}`;
				if (seen.has(ruleKey)) continue;
				seen.add(ruleKey);
				rules.push(sourceRule);
			}
		}
	}

	return rules;
}

export function getInitiativeCombatManaRules(
	actor: Actor | null | undefined,
): CombatManaRuleLike[] {
	return getActorCombatManaRules(actor).filter(
		(rule) => isManaResourceRule(rule) && isInitiativeTriggerRule(rule),
	);
}

export function hasCombatEndCombatManaRule(actor: Actor | null | undefined): boolean {
	return getActorCombatManaRules(actor).some(
		(rule) => isManaResourceRule(rule) && isCombatEndClearRule(rule),
	);
}

export function getCombatManaGrantTotalForInitiative(actor: Actor | null | undefined): number {
	const initiativeRules = getInitiativeCombatManaRules(actor);
	return initiativeRules.reduce((sum, rule) => {
		const value = Number(rule.getGrantAmount?.() ?? 0);
		return sum + Math.max(0, value);
	}, 0);
}

export function getCombatManaGrantMap(actor: Actor | null | undefined): CombatManaGrantMap {
	if (!actor || typeof actor.getFlag !== 'function') return {};
	const value = (actor as ActorWithCollections).getFlag?.(
		COMBAT_MANA_FLAG_SCOPE,
		COMBAT_MANA_FLAG_KEY,
	);
	return normalizeGrantMap(value);
}

export function getCombatManaGrantForCombat(
	actor: Actor | null | undefined,
	combatId: string,
): number {
	if (!combatId) return 0;
	const grants = getCombatManaGrantMap(actor);
	return Math.max(0, Number(grants[combatId]?.mana ?? 0));
}

export { COMBAT_MANA_FLAG_KEY, COMBAT_MANA_FLAG_SCOPE, type CombatManaGrantMap };
