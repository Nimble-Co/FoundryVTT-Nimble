import { describe, expect, it } from 'vitest';
import smallProtectMe from '../../../packs/classFeatures/core/hunter/hunter-subclasses/beastmaster/small-protect-me.json';
import decoy from '../../../packs/classFeatures/core/hunter/thrill-of-the-hunt/decoy.json';
import { Migration095DefendOptionMove } from '../migrations/Migration095DefendOptionMove.js';

const DECOY = 'Compendium.nimble.nimble-class-features.Item.FW8O4gZtT9qpaV8E';
const SMALL = 'Compendium.nimble.nimble-class-features.Item.GGSs5oI7c578HH9x';

function migration(): Migration095DefendOptionMove {
	return new Migration095DefendOptionMove();
}

function feature(
	name: string,
	sourceId: string | undefined,
	rules: Record<string, unknown>[],
	className = 'hunter',
) {
	return {
		name,
		type: 'feature',
		_stats: sourceId ? { compendiumSource: sourceId } : undefined,
		system: { class: className, rules },
	};
}

function defend(id: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		type: 'defendOption',
		outcome: 'miss',
		reminder: 'Move up to half your speed away.',
		...extra,
	};
}

describe('Migration095DefendOptionMove', () => {
	it('gives a Decoy copy half speed away, and a second run changes nothing', async () => {
		const item = feature('Decoy', DECOY, [defend('3o31NiGWAprxPZLG')]);

		await migration().updateItem(item);
		await migration().updateItem(item);

		expect(item.system.rules[0]).toMatchObject({
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
			outcome: 'miss',
		});
	});

	it('gives a Small Protect Me! copy the same move and leaves its charge pool', async () => {
		const pool = { id: 'pool', type: 'chargePool', max: '1' };
		const item = feature('Small - Protect Me!', SMALL, [pool, defend('y6Yt3UfuhJSFwcqO')]);

		await migration().updateItem(item);

		expect(item.system.rules[0]).toEqual(pool);
		expect(item.system.rules[1]).toMatchObject({
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
		});
	});

	it('matches a copy with no source id by the hunter name', async () => {
		const item = feature('Decoy', undefined, [defend('3o31NiGWAprxPZLG')]);

		await migration().updateItem(item);

		expect(item.system.rules[0]).toMatchObject({ moveDistance: 'floor(@speed / 2)' });
	});

	it('leaves a distance a GM already wrote', async () => {
		const item = feature('Decoy', DECOY, [
			defend('3o31NiGWAprxPZLG', { moveDistance: '1', moveDirection: 'toward' }),
		]);

		await migration().updateItem(item);

		expect(item.system.rules[0]).toMatchObject({ moveDistance: '1', moveDirection: 'toward' });
	});

	it('leaves a feature that is not one of these two', async () => {
		const item = feature(
			'Medium - Protect Me!',
			'Compendium.nimble.nimble-class-features.Item.WpTBjJEqfLhiA37M',
			[defend('CLmYUbqdoPRDkIMw', { outcome: 'none' })],
		);

		await migration().updateItem(item);

		expect(item.system.rules[0]).not.toHaveProperty('moveDistance');
	});

	it('ships the move on Decoy and Small Protect Me! in the pack', () => {
		const decoyRule = decoy.system.rules.find((rule) => rule.type === 'defendOption');
		const smallRules = smallProtectMe.system.rules;
		const smallRule = smallRules.find((rule) => rule.type === 'defendOption');

		expect(decoyRule).toMatchObject({
			id: '3o31NiGWAprxPZLG',
			outcome: 'miss',
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
			chargePoolIdentifier: 'thrill-of-the-hunt',
		});
		expect(smallRule).toMatchObject({
			id: 'y6Yt3UfuhJSFwcqO',
			outcome: 'miss',
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
			chargePoolIdentifier: 'small-protect-me',
			chargeCost: 1,
		});
		expect(smallRules.filter((rule) => rule.type !== 'defendOption')).toEqual([
			expect.objectContaining({ type: 'chargePool', identifier: 'small-protect-me', max: '1' }),
			expect.objectContaining({
				type: 'modifyPool',
				poolIdentifier: 'small-protect-me',
				maxDelta: '1',
			}),
		]);
	});
});
