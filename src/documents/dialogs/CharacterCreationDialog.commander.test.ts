import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemGrantRule } from '../../models/rules/grantItem.js';
import CharacterCreationDialog from './CharacterCreationDialog.svelte.js';

/**
 * Integration test for the Commander's level-1 "Coordinated Strike!" grant.
 *
 * Rulebook: "LEVEL 1 — Coordinated Strike! Gain the Coordinated Strike!
 * Commander's Order." Mechanically this is a chain:
 *
 *   Commander (level 1)
 *     └─ auto-grants "Commander's Orders"           (commander-progression feature)
 *          └─ carries a `grantItem` rule            (grant-coordinated-strike)
 *               └─ grants "Coordinated Strike!"     (a commanders-orders feature)
 *
 * The class-progression suite (commander.test.ts) only proves the FIRST link —
 * that "Commander's Orders" is auto-granted at level 1. It never exercises the
 * `grantItem` rule that actually hands the character Coordinated Strike, because
 * that fires inside the item-creation pipeline, not the feature resolver.
 *
 * These tests cover the rest of the chain end-to-end using the REAL compendium
 * data on disk:
 *   1. the grant wiring in the pack JSON is intact;
 *   2. the REAL `ItemGrantRule.preCreate` produces Coordinated Strike from it;
 *   3. character creation delivers "Commander's Orders" (with its live grant
 *      rule) onto the actor, so the pipeline in (2) has something to fire on.
 */

const ROOT = process.cwd();

function readPackJson(relPath: string): Record<string, any> {
	return JSON.parse(readFileSync(join(ROOT, relPath), 'utf-8'));
}

const COMMANDER_CLASS = readPackJson('packs/classes/core/commander.json');
const COMMANDERS_ORDERS = readPackJson(
	'packs/classFeatures/core/commander/commander-progression/commanders-orders.json',
);
const COORDINATED_STRIKE = readPackJson(
	'packs/classFeatures/core/commander/commanders-order/coordinated-strike.json',
);

/** The `grantItem` rule that turns "Commander's Orders" into a Coordinated Strike grant. */
function coordinatedStrikeGrant(): Record<string, any> {
	const grant = (COMMANDERS_ORDERS.system.rules ?? []).find(
		(r: { type?: string }) => r.type === 'grantItem',
	);
	if (!grant) throw new Error("Commander's Orders has no grantItem rule");
	return grant;
}

/** Wraps a raw pack JSON as a Foundry-shaped document with a real `toObject()`. */
function makeDoc(raw: Record<string, any>) {
	return {
		uuid: `Item.${raw._id}`,
		_id: raw._id,
		name: raw.name,
		type: raw.type,
		system: raw.system,
		_stats: raw._stats ?? {},
		toObject: () => ({
			name: raw.name,
			type: raw.type,
			img: raw.img,
			system: foundry.utils.deepClone(raw.system),
			_stats: { ...(raw._stats ?? {}) },
		}),
	} as unknown as Item;
}

describe('Commander — Coordinated Strike grant wiring (pack data)', () => {
	it("auto-grants Commander's Orders at level 1 in the commander-progression group", () => {
		expect(COMMANDERS_ORDERS.name).toBe("Commander's Orders");
		expect(COMMANDERS_ORDERS.system.class).toBe('commander');
		expect(COMMANDERS_ORDERS.system.group).toBe('commander-progression');
		expect(COMMANDERS_ORDERS.system.gainedAtLevels).toContain(1);
	});

	it("Commander's Orders carries an enabled grantItem rule", () => {
		const grant = coordinatedStrikeGrant();
		expect(grant.disabled).toBe(false);
		expect(grant.uuid).toBeTruthy();
	});

	it('the granted UUID resolves to the Coordinated Strike! commander feature', () => {
		const grant = coordinatedStrikeGrant();
		// The rule points at Coordinated Strike by its compendium UUID.
		expect(grant.uuid.endsWith(COORDINATED_STRIKE._id)).toBe(true);
		expect(COORDINATED_STRIKE.name).toBe('Coordinated Strike!');
		expect(COORDINATED_STRIKE.system.class).toBe('commander');
	});
});

describe('Commander — grantItem.preCreate grants Coordinated Strike!', () => {
	it('pushes Coordinated Strike! into the items created alongside Commander’s Orders', async () => {
		const grantSource = coordinatedStrikeGrant();
		const coordinatedStrikeDoc = makeDoc(COORDINATED_STRIKE);

		// The grant target is a compendium UUID; resolve it to the real feature.
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => (uuid === grantSource.uuid ? coordinatedStrikeDoc : null)),
		);

		// A freshly-created commander with "Commander's Orders" being embedded.
		const actor = { items: [] as unknown[] };
		const commandersOrdersItem = {
			name: "Commander's Orders",
			sourceId: `Item.${COMMANDERS_ORDERS._id}`,
			actor,
		};

		// Drive the REAL rule. The test-env DataModel mock doesn't hydrate schema
		// fields from source (see RulesManager.test.ts's MockRuleDataModel), so we
		// populate them the way Foundry would before invoking production preCreate.
		const rule = new ItemGrantRule(grantSource as never, {
			parent: commandersOrdersItem as never,
		});
		Object.assign(rule, {
			...grantSource,
			quantity: grantSource.quantity ?? null,
			predicate: { size: 0 }, // empty predicate → rule always applies
			parent: commandersOrdersItem,
		});

		const pendingItems: Array<Record<string, any>> = [];
		const tempItems: unknown[] = [];
		await rule.preCreate({
			itemSource: {} as never,
			pendingItems: pendingItems as never,
			tempItems: tempItems as never,
			operation: {},
		});

		expect(pendingItems).toHaveLength(1);
		expect(pendingItems[0].name).toBe('Coordinated Strike!');
		expect(pendingItems[0]._stats.compendiumSource).toBe(grantSource.uuid);
		expect(tempItems).toHaveLength(1);
	});
});

describe('CharacterCreationDialog — creating a commander delivers the Coordinated Strike grant', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(
			foundry.applications.api.ApplicationV2.prototype as unknown as {
				close: ReturnType<typeof vi.fn>;
			}
		).close = vi.fn().mockResolvedValue(undefined);
	});

	it("hands Commander's Orders (with its live grantItem rule) to the actor at level 1", async () => {
		const actor = {
			items: [] as unknown[],
			createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			update: vi.fn().mockResolvedValue(undefined),
		};
		(Actor as unknown as { create: ReturnType<typeof vi.fn> }).create = vi
			.fn()
			.mockResolvedValue(actor);

		const classDoc = makeDoc(COMMANDER_CLASS);
		const commandersOrdersDoc = makeDoc(COMMANDERS_ORDERS);

		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => {
				if (uuid === (classDoc as unknown as { uuid: string }).uuid) return classDoc;
				if (uuid === (commandersOrdersDoc as unknown as { uuid: string }).uuid) {
					return commandersOrdersDoc;
				}
				return null;
			}),
		);

		const dialog = new CharacterCreationDialog();
		await dialog.submitCharacterCreation({
			name: 'Test Commander',
			origins: {
				characterClass: { uuid: (classDoc as unknown as { uuid: string }).uuid },
			},
			languages: [],
			classFeatures: {
				autoGrant: [(commandersOrdersDoc as unknown as { uuid: string }).uuid],
				selected: new Map(),
			},
			spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
		});

		// Commander's Orders should be among the sources handed to the actor.
		const createdSources = actor.createEmbeddedDocuments.mock.calls.flatMap(
			(call) => call[1] as Array<Record<string, any>>,
		);
		const commandersOrders = createdSources.find((s) => s.name === "Commander's Orders");
		expect(commandersOrders, "Commander's Orders was not created on the actor").toBeDefined();

		// ...still carrying the enabled grantItem rule that yields Coordinated Strike.
		const grant = (commandersOrders!.system.rules ?? []).find(
			(r: { type?: string }) => r.type === 'grantItem',
		);
		expect(grant, "Commander's Orders lost its grantItem rule during creation").toBeDefined();
		expect(grant.disabled).toBe(false);
		expect(grant.uuid.endsWith(COORDINATED_STRIKE._id)).toBe(true);
		expect(commandersOrders!._stats.compendiumSource).toBe(
			(commandersOrdersDoc as unknown as { uuid: string }).uuid,
		);
	});
});
