import { SYSTEM_ID } from '#system';
import { MigrationBase, type MigrationContext, type MigrationKind } from '../MigrationBase.js';

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

	override readonly title = 'Spellblade Combat Mana';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		if (!isSpellbladeSubclass(source)) return;

		const { changed, rules } = ensureSpellbladeCombatManaRule(source.system?.rules);
		if (changed) {
			source.system.rules = rules;
			console.log(`Nimble Migration | ${source.name}: added Spellblade combat mana rule`);
		}
	}

	/** Gives the mana now to a Spellblade who already rolled Initiative in a started combat. */
	override async updateActor(source: any, context?: MigrationContext): Promise<void> {
		if (source?.type !== 'character' || !source._id) return;
		const items: SpellbladeItemLike[] = Array.isArray(source.items) ? source.items : [];
		if (!items.some(isSpellbladeSubclass)) return;

		const activeCombatIds = (game.combats?.contents ?? []).reduce<string[]>((acc, combat) => {
			if (!combat?.started || !combat.id) return acc;
			const combatant = combat.combatants.find((entry) => entry.actorId === source._id);
			if (!combatant || combatant.initiative === null) return acc;
			acc.push(combat.id);
			return acc;
		}, []);
		if (activeCombatIds.length === 0) return;

		// The rule's formula is max(@intelligence, 0), read from the live actor's roll data.
		const actor = context?.uuid ? (fromUuidSync(context.uuid) as Actor | null) : null;
		const combatMana = Math.max(0, Number(actor?.getRollData?.()?.intelligence ?? 0));
		if (combatMana <= 0) return;

		const stored = source.flags?.[SYSTEM_ID]?.combatManaGrants;
		const grants: Record<string, { mana: number }> =
			stored && typeof stored === 'object' && !Array.isArray(stored)
				? foundry.utils.deepClone(stored)
				: {};
		let changed = false;
		for (const combatId of activeCombatIds) {
			if (Number(grants[combatId]?.mana ?? 0) > 0) continue;
			grants[combatId] = { mana: combatMana };
			changed = true;
		}
		if (!changed) return;

		foundry.utils.setProperty(source, 'system.resources.mana.baseMax', combatMana);
		foundry.utils.setProperty(source, 'system.resources.mana.current', combatMana);
		foundry.utils.setProperty(source, `flags.${SYSTEM_ID}.combatManaGrants`, grants);
	}
}

export { Migration004SpellbladeCombatMana };
