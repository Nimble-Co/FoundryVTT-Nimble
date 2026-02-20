import {
	getCombatManaGrantForCombat,
	getCombatManaGrantMap,
	getCombatManaGrantTotalForInitiative,
	primeActorCombatManaSourceRules,
} from '../../utils/combatManaRules.js';
import { MigrationBase } from '../MigrationBase.js';

const SPELLBLADE_RULE_ID = 'spellblade-combat-mana';
const SPELLBLADE_SOURCE_SUFFIX = '.item.lbvh28xjvxihffst';

interface RuleLike {
	id?: string;
	type?: string;
	resource?: string;
	trigger?: string;
	clearOn?: string;
}

interface SpellbladeItemLike {
	type?: string;
	name?: string;
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
	system?: {
		identifier?: string;
		parentClass?: string;
		rules?: unknown;
	};
}

function createSpellbladeCombatManaRule(): Record<string, unknown> {
	return {
		type: 'combatMana',
		disabled: false,
		id: SPELLBLADE_RULE_ID,
		identifier: '',
		label: 'Arcane Command - Combat Mana',
		predicate: {},
		priority: 1,
		formula: 'max(@intelligence, 0)',
		resource: 'mana',
		trigger: 'initiativeRoll',
		clearOn: 'combatEnd',
	};
}

function isSpellbladeSubclass(item: SpellbladeItemLike): boolean {
	if (item?.type !== 'subclass') return false;

	const name = String(item?.name ?? '')
		.trim()
		.toLowerCase();
	if (name === 'spellblade') return true;

	const identifier = String(item?.system?.identifier ?? '')
		.trim()
		.toLowerCase();
	if (identifier === 'spellblade') return true;

	const sourceId = String(
		item?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.core?.source ?? '',
	)
		.trim()
		.toLowerCase();
	if (sourceId.endsWith(SPELLBLADE_SOURCE_SUFFIX)) return true;

	const parentClass = String(item?.system?.parentClass ?? '')
		.trim()
		.toLowerCase();
	return parentClass === 'commander' && name.includes('spellblade');
}

function isSpellbladeCombatManaRule(rule: RuleLike): boolean {
	if (!rule || typeof rule !== 'object') return false;
	if (rule.id === SPELLBLADE_RULE_ID) return true;
	return (
		rule.type === 'combatMana' &&
		(rule.resource ?? 'mana') === 'mana' &&
		(rule.trigger ?? 'initiativeRoll') === 'initiativeRoll' &&
		(rule.clearOn ?? 'combatEnd') === 'combatEnd'
	);
}

function ensureSpellbladeCombatManaRule(rulesValue: unknown): {
	changed: boolean;
	rules: Record<string, unknown>[];
} {
	const rules = Array.isArray(rulesValue)
		? foundry.utils.deepClone(rulesValue as Record<string, unknown>[])
		: [];

	const canonicalRule = createSpellbladeCombatManaRule();
	const ruleIndex = rules.findIndex((rule) => isSpellbladeCombatManaRule(rule as RuleLike));

	if (ruleIndex < 0) {
		rules.push(canonicalRule);
		return { changed: true, rules };
	}

	const currentRule = rules[ruleIndex] as Record<string, unknown>;
	const isSameRule = JSON.stringify(currentRule) === JSON.stringify(canonicalRule);
	if (isSameRule) return { changed: false, rules };

	rules[ruleIndex] = canonicalRule;
	return { changed: true, rules };
}

/**
 * Migration to add combat mana rules to Spellblade subclass items.
 *
 * The Spellblade subclass grants combat mana equal to Intelligence modifier
 * when rolling initiative. This migration ensures the combatMana rule exists
 * on all Spellblade subclass items and backfills mana for actors currently
 * in active combats.
 */
class Migration004SpellbladeCombatMana extends MigrationBase {
	static override readonly version = 4;

	override readonly version = Migration004SpellbladeCombatMana.version;

	override async updateItem(source: any): Promise<void> {
		if (!isSpellbladeSubclass(source)) return;

		const { changed, rules } = ensureSpellbladeCombatManaRule(source.system?.rules);
		if (changed) {
			source.system.rules = rules;
			console.log(`Nimble Migration | ${source.name}: added Spellblade combat mana rule`);
		}
	}

	override async migrate(): Promise<void> {
		await this.backfillActiveCombatMana();
	}

	private async backfillActiveCombatMana(): Promise<void> {
		for (const actor of game.actors.contents) {
			if (actor.type !== 'character') continue;
			if (!this.actorHasSpellbladeSubclass(actor)) continue;
			if (!actor.id) continue;

			const activeCombatIds = (game.combats?.contents ?? []).reduce<string[]>((acc, combat) => {
				if (!combat?.started || !combat.id) return acc;

				const combatant = combat.combatants.find((entry) => entry.actorId === actor.id);
				if (!combatant || combatant.initiative === null) return acc;

				acc.push(combat.id);
				return acc;
			}, []);

			if (activeCombatIds.length === 0) continue;

			await primeActorCombatManaSourceRules(actor);

			const combatMana = getCombatManaGrantTotalForInitiative(actor);
			if (combatMana <= 0) continue;

			const grants = getCombatManaGrantMap(actor);
			let changed = false;

			for (const combatId of activeCombatIds) {
				if (getCombatManaGrantForCombat(actor, combatId) > 0) continue;
				grants[combatId] = { mana: combatMana };
				changed = true;
			}

			if (!changed) continue;

			await actor.update({
				'system.resources.mana.baseMax': combatMana,
				'system.resources.mana.current': combatMana,
				'flags.nimble.combatManaGrants': grants,
			} as Record<string, unknown>);
		}
	}

	private actorHasSpellbladeSubclass(actor: Actor): boolean {
		if (actor.type !== 'character') return false;
		return actor.items.some((item) => isSpellbladeSubclass(item as unknown as SpellbladeItemLike));
	}
}

export { Migration004SpellbladeCombatMana };
