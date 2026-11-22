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

const ZEPHYR = 'classFeatures/core/zephyr';

describe('Burst of Speed', () => {
	const path = `${ZEPHYR}/zephyr-progression/burst-of-speed.json`;
	const feature = packFeature(path, 'Actor.zephyr');
	const source = JSON.parse(readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8'));
	const rulesOfType = (type: string) =>
		(source.system.rules as PackRule[]).filter((rule) => rule.type === type);

	it('gives only the Zephyr a free Swiftstrike line that ignores Rushed Attacks', () => {
		const lines = collectGrantedActionOffers(feature, [{ actor: { uuid: 'Actor.goblin' } }]);

		expect(lines).toEqual([
			expect.objectContaining({
				targetActorUuid: 'Actor.zephyr',
				label: 'Swiftstrike',
				free: true,
				ignoresRushed: true,
				weaponKind: 'any',
				allowsCantrips: false,
				spendsReaction: false,
			}),
		]);
	});

	it('is made through the item with the identifier the Way of Pain features name', () => {
		expect(source.system.identifier).toBe('burst-of-speed');
	});

	it('spends 1 Burst of Speed, once each turn', () => {
		const consumers = rulesOfType('chargeConsumer');
		const turnPool = rulesOfType('chargePool').find((rule) => rule.hidden === true);

		expect(turnPool).toMatchObject({
			max: '1',
			initial: 'max',
			recoveries: expect.arrayContaining([
				{ trigger: 'onAnyTurnStart', mode: 'refresh', value: '1' },
			]),
		});
		expect(consumers.map((rule) => [rule.poolIdentifier, rule.cost])).toEqual([
			['burst-of-speed', '1'],
			[turnPool?.identifier, '1'],
		]);
	});

	it('keeps Slipstream and Whirling Defense as they are', () => {
		expect(rulesOfType('defendOption').map((rule) => rule.label)).toEqual([
			'Slipstream',
			'Whirling Defense',
		]);
	});
});

describe.each([
	['Share My Pain', 'share-my-pain', 2],
	['Echoed Agony', 'echoed-agony', 4],
])('%s', (_name, file, reach) => {
	const source = JSON.parse(
		readFileSync(
			resolve(
				__dirname,
				'../../../../packs',
				`${ZEPHYR}/zephyr-subclasses/way-of-pain/${file}.json`,
			),
			'utf8',
		),
	);

	it(`gives Swiftstrike 1 more target within Reach ${reach}`, () => {
		expect(source.system.rules).toEqual([
			expect.objectContaining({
				type: 'extraTargets',
				disabled: false,
				predicate: {},
				attackOrigin: 'burst-of-speed',
				count: 1,
				reach,
			}),
		]);
	});
});
