import {
	getCombatManaGrantForCombat,
	getCombatManaGrantMap,
	getCombatManaGrantTotalForInitiative,
	primeActorCombatManaSourceRules,
} from '../utils/combatManaRules.js';

const MIGRATION_SETTING_KEY = 'spellbladeCombatManaMigrationVersion';
const MIGRATION_VERSION = 1;
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

function actorHasSpellbladeSubclass(actor: Actor): boolean {
	if (actor.type !== 'character') return false;
	return actor.items.some((item) => isSpellbladeSubclass(item as unknown as SpellbladeItemLike));
}

async function migrateActorSpellbladeSubclassRules(actor: Actor): Promise<number> {
	if (!actorHasSpellbladeSubclass(actor)) return 0;

	const updates = actor.items.reduce<Record<string, unknown>[]>((acc, item) => {
		if (!isSpellbladeSubclass(item as unknown as SpellbladeItemLike)) return acc;

		const itemSystem = (item as unknown as { system?: { rules?: unknown } }).system;
		const { changed, rules } = ensureSpellbladeCombatManaRule(itemSystem?.rules);
		if (!changed) return acc;
		if (!item.id) return acc;

		acc.push({
			_id: item.id,
			'system.rules': rules,
		});
		return acc;
	}, []);

	if (updates.length === 0) return 0;
	await actor.updateEmbeddedDocuments('Item', updates as Item.UpdateData[]);
	return updates.length;
}

async function backfillActiveCombatMana(actor: Actor): Promise<void> {
	if (!actorHasSpellbladeSubclass(actor) || !actor.id) return;

	const activeCombatIds = (game.combats?.contents ?? []).reduce<string[]>((acc, combat) => {
		if (!combat?.started || !combat.id) return acc;

		const combatant = combat.combatants.find((entry) => entry.actorId === actor.id);
		if (!combatant || combatant.initiative === null) return acc;

		acc.push(combat.id);
		return acc;
	}, []);

	if (activeCombatIds.length === 0) return;

	await primeActorCombatManaSourceRules(actor);

	const combatMana = getCombatManaGrantTotalForInitiative(actor);
	if (combatMana <= 0) return;

	const grants = getCombatManaGrantMap(actor);
	let changed = false;

	for (const combatId of activeCombatIds) {
		if (getCombatManaGrantForCombat(actor, combatId) > 0) continue;
		grants[combatId] = { mana: combatMana };
		changed = true;
	}

	if (!changed) return;

	await actor.update({
		'system.resources.mana.baseMax': combatMana,
		'system.resources.mana.current': combatMana,
		'flags.nimble.combatManaGrants': grants,
	} as Record<string, unknown>);
}

export default async function runSpellbladeCombatManaMigration(): Promise<void> {
	if (!game.user?.isGM) return;

	const currentVersion =
		Number(game.settings.get('nimble' as 'core', MIGRATION_SETTING_KEY as 'rollMode')) || 0;
	if (currentVersion >= MIGRATION_VERSION) return;

	let updatedActorCount = 0;
	let updatedItemCount = 0;

	try {
		for (const actor of game.actors.contents) {
			if (actor.type !== 'character') continue;

			const updatedItems = await migrateActorSpellbladeSubclassRules(actor);
			if (updatedItems > 0) {
				updatedActorCount += 1;
				updatedItemCount += updatedItems;
			}

			await backfillActiveCombatMana(actor);
		}

		await game.settings.set(
			'nimble' as 'core',
			MIGRATION_SETTING_KEY as 'rollMode',
			MIGRATION_VERSION as unknown as foundry.CONST.DICE_ROLL_MODES,
		);

		console.info(
			`Nimble | Spellblade combat mana migration complete: ${updatedItemCount} subclass item(s) across ${updatedActorCount} actor(s).`,
		);
	} catch (error) {
		console.error('Nimble | Spellblade combat mana migration failed.', error);
		ui.notifications?.error(
			'Nimble | Spellblade combat mana migration failed. Check console for details.',
		);
	}
}
