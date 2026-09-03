import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import getSpellScrollTemplateTier from './getSpellScrollTemplateTier.js';

const CANTRIP_TEMPLATE_ID = '1UL6G7MDgUqtt4fN';
const TIER_3_TEMPLATE_ID = 'M893NOzlKaimRo0t';
const TIER_9_TEMPLATE_ID = '3YHEw1vfuHAFRJ2a';

describe('getSpellScrollTemplateTier', () => {
	it('resolves the tier from the item id', () => {
		expect(getSpellScrollTemplateTier({ type: 'object', _id: TIER_3_TEMPLATE_ID })).toBe(3);
	});

	it('resolves tier 0 rather than treating a falsy tier as a miss', () => {
		// The cantrip blank maps to 0, so a truthiness check would report it as no
		// blank at all.
		expect(getSpellScrollTemplateTier({ type: 'object', _id: CANTRIP_TEMPLATE_ID })).toBe(0);
	});

	it('resolves the tier from a compendium uuid', () => {
		const item = {
			type: 'object',
			uuid: `Compendium.nimble.magic-items.Item.${TIER_9_TEMPLATE_ID}`,
		};

		expect(getSpellScrollTemplateTier(item)).toBe(9);
	});

	it('resolves the tier from the compendium source of an imported copy', () => {
		const item = {
			type: 'object',
			_id: 'aLocalWorldItemId',
			_stats: { compendiumSource: `Compendium.nimble.magic-items.Item.${TIER_3_TEMPLATE_ID}` },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(3);
	});

	it('resolves the tier from the legacy sourceId location', () => {
		const item = {
			type: 'object',
			_id: 'aLocalWorldItemId',
			sourceId: `Compendium.nimble.magic-items.Item.${TIER_3_TEMPLATE_ID}`,
		};

		expect(getSpellScrollTemplateTier(item)).toBe(3);
	});

	it('resolves the tier from the legacy core source flag', () => {
		const item = {
			type: 'object',
			_id: 'aLocalWorldItemId',
			flags: { core: { source: `Compendium.nimble.magic-items.Item.${TIER_9_TEMPLATE_ID}` } },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(9);
	});

	// The key older Foundry versions actually wrote, and what `MigrationBase#getSourceId`
	// reads. A blank imported back then is migrated by id but has to resolve on drop too.
	it('resolves the tier from the legacy core sourceId flag', () => {
		const item = {
			type: 'object',
			_id: 'aLocalWorldItemId',
			flags: { core: { sourceId: `Compendium.nimble.magic-items.Item.${TIER_9_TEMPLATE_ID}` } },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(9);
	});

	it('prefers the modern compendium source over the legacy sourceId flag', () => {
		const item = {
			type: 'object',
			_id: 'aLocalWorldItemId',
			_stats: { compendiumSource: `Compendium.nimble.magic-items.Item.${TIER_3_TEMPLATE_ID}` },
			flags: { core: { sourceId: `Compendium.nimble.magic-items.Item.${TIER_9_TEMPLATE_ID}` } },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(3);
	});

	it('resolves the dev build the same way, since document ids do not change', () => {
		const item = {
			type: 'object',
			_stats: { compendiumSource: `Compendium.nimble-dev.magic-items.Item.${TIER_3_TEMPLATE_ID}` },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(3);
	});

	it('prefers the item id over a later candidate', () => {
		const item = {
			type: 'object',
			_id: CANTRIP_TEMPLATE_ID,
			_stats: { compendiumSource: `Compendium.nimble.magic-items.Item.${TIER_9_TEMPLATE_ID}` },
		};

		expect(getSpellScrollTemplateTier(item)).toBe(0);
	});

	it('returns null for an object that is not a template', () => {
		expect(getSpellScrollTemplateTier({ type: 'object', _id: 'someOtherItem' })).toBeNull();
	});

	it('returns null for a non-object item even when the id matches', () => {
		expect(getSpellScrollTemplateTier({ type: 'spell', _id: TIER_3_TEMPLATE_ID })).toBeNull();
	});

	it('returns null when no id is present at all', () => {
		expect(getSpellScrollTemplateTier({ type: 'object' })).toBeNull();
	});

	it('returns null for a null compendium source', () => {
		expect(
			getSpellScrollTemplateTier({ type: 'object', _stats: { compendiumSource: null } }),
		).toBeNull();
	});

	it('matches the ids and tiers of the shipped scroll blanks', () => {
		// Ten opaque ids: asserting the table against itself would pass even with a
		// mistyped id, so compare against the pack files. A drifted id stops being
		// recognised and silently falls through to the ordinary item path.
		const templateDir = join(process.cwd(), 'packs/magicItems/core/spellScrollTemplates');
		const files = readdirSync(templateDir).filter((file) => file.endsWith('.json'));

		expect(files).toHaveLength(10);

		for (const file of files) {
			const blank = JSON.parse(readFileSync(join(templateDir, file), 'utf8')) as {
				_id: string;
				name: string;
			};
			const expectedTier = /Tier (\d)/.exec(blank.name)?.[1];

			expect(getSpellScrollTemplateTier({ type: 'object', _id: blank._id })).toBe(
				expectedTier ? Number(expectedTier) : 0,
			);
		}
	});
});
