import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectGrantedActionOffers, collectInterposeOffers } from '../grantedActionOffers.js';

interface PackRule {
	id: string;
	type: string;
	[key: string]: unknown;
}

function packFeature(path: string, actorUuid: string) {
	const source = JSON.parse(readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8'));
	const rules = (source.system.rules as PackRule[]).map((rule) => ({
		...rule,
		appliesTo: () => true,
	}));
	return {
		uuid: `${actorUuid}.Item.${source._id}`,
		name: source.name as string,
		actor: { uuid: actorUuid },
		rules: new Map(rules.map((rule) => [rule.id, rule])),
		ruleTypes: rules.map((rule) => rule.type),
	};
}

describe('Coordinated Strike!', () => {
	const feature = packFeature(
		'classFeatures/core/commander/commanders-order/coordinated-strike.json',
		'Actor.wren',
	);

	it('gives the Commander and the targeted ally each a free attack line with cantrips', () => {
		const lines = collectGrantedActionOffers(feature, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(lines.map((line) => line.targetActorUuid)).toEqual(['Actor.wren', 'Actor.ally']);
		for (const line of lines) {
			expect(line).toMatchObject({
				label: 'Coordinated Strike',
				free: true,
				allowsCantrips: true,
				weaponKind: 'any',
				ignoresRushed: false,
			});
		}
	});

	it('gives no action back for the attacks', () => {
		const actionDeltas = [...feature.rules.values()].filter((rule) => rule.type === 'actionDelta');

		expect(actionDeltas.map((rule) => rule.id)).not.toContain(
			'coordinated-strike-self-free-attack',
		);
		expect(actionDeltas.map((rule) => rule.id)).not.toContain(
			'coordinated-strike-ally-free-attack',
		);
	});
});

describe('Quickstrike', () => {
	const feature = packFeature(
		'classFeatures/core/zephyr/martial-arts-ability/quickstrike.json',
		'Actor.zephyr',
	);

	it('gives the Zephyr a free Unarmed Strike line when they Interpose', () => {
		const lines = collectInterposeOffers({ uuid: 'Actor.zephyr', items: [feature] });

		expect(lines).toEqual([
			expect.objectContaining({
				targetActorUuid: 'Actor.zephyr',
				label: 'Quickstrike',
				free: true,
				weaponKind: 'unarmed',
			}),
		]);
	});

	it('gives no line and no action when the feature itself is used', () => {
		expect(collectGrantedActionOffers(feature, [{ actor: { uuid: 'Actor.ally' } }])).toEqual([]);
		expect(feature.ruleTypes).not.toContain('actionDelta');
	});
});
