import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packRuleFailures, readItem } from '../../../../tests/fixtures/packContent.js';
import { Predicate } from '../../../etc/Predicate.js';
import { GrantTargetBonusRule } from '../../../models/rules/grantTargetBonus.js';
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
		system: { identifier: source.system.identifier as string },
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

	it('reaches 1 ally; with 2 targeted, both still get a line and the lines say so', () => {
		const lines = collectGrantedActionOffers(feature, [
			{ actor: { uuid: 'Actor.ally' } },
			{ actor: { uuid: 'Actor.other-ally' } },
		]);

		expect(lines.map((line) => line.targetActorUuid)).toEqual([
			'Actor.wren',
			'Actor.ally',
			'Actor.other-ally',
		]);
		for (const line of lines) expect(line).toMatchObject({ targetCount: 1, targetedCount: 2 });
	});

	it('reaches 1 more ally with Experienced Commander', () => {
		const experienced = JSON.parse(
			readFileSync(
				resolve(
					__dirname,
					'../../../../packs',
					'classFeatures/core/commander/commander-subclasses/champion-of-the-vanguard/experienced-commander.json',
				),
				'utf8',
			),
		);
		const [data, ...more] = (experienced.system.rules as PackRule[]).filter(
			(rule) => rule.type === 'grantTargetBonus',
		);
		expect(more).toEqual([]);
		const parent = {
			isEmbedded: true,
			actor: { uuid: 'Actor.wren', getDomain: () => new Set<string>() },
			getDomain: () => new Set<string>(),
		};
		const bonus = new GrantTargetBonusRule(data as never, { parent, strict: false } as never);
		Object.assign(bonus, { ...data, predicate: new Predicate({}) });
		Object.defineProperty(bonus, 'parent', { get: () => parent, configurable: true });

		const lines = collectGrantedActionOffers(
			{ ...feature, actor: { uuid: 'Actor.wren', rules: [bonus] } },
			[{ actor: { uuid: 'Actor.ally' } }, { actor: { uuid: 'Actor.other-ally' } }],
		);

		for (const line of lines) expect(line).toMatchObject({ targetCount: 2, targetedCount: 2 });
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

	it('has no limit of its own and posts no reminder card', () => {
		const item = readItem(
			'packs/classFeatures/core/zephyr/martial-arts-ability/quickstrike.json',
		) as { system: { rules: { type: string }[]; activation: { effects: unknown[] } } };

		expect(item.system.rules.map((rule) => rule.type)).toEqual(['grantActivation']);
		expect(item.system.activation.effects).toEqual([]);
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

	it('spends 1 Burst of Speed, with one 1/turn limit shared with its Defend options', () => {
		expect(rulesOfType('chargePool').map((rule) => rule.identifier)).toEqual(['burst-of-speed']);
		expect(
			rulesOfType('chargeConsumer').map((rule) => [
				rule.poolIdentifier,
				rule.cost,
				rule.oncePerTurn,
			]),
		).toEqual([['burst-of-speed', '1', true]]);
		expect(rulesOfType('defendOption').map((rule) => rule.oncePerTurn)).toEqual([true, true]);
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

function packActor(path: string) {
	return JSON.parse(readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8')) as {
		_id: string;
		items: { _id: string; name: string; system: Record<string, unknown> }[];
	};
}

describe("Ul'vek, Psionic Despot: Control", () => {
	const despot = packActor('legendaryMonsters/core/ulvek-psionic-despot.json');
	const source = despot.items.find((item) => item.name === 'Control.');
	const rules = ((source?.system.rules ?? []) as PackRule[]).map((rule) => ({
		...rule,
		appliesTo: () => true,
	}));
	const feature = {
		uuid: `Actor.ulvek.Item.${source?._id}`,
		name: source?.name ?? '',
		actor: { uuid: 'Actor.ulvek' },
		rules: new Map(rules.map((rule) => [rule.id, rule])),
	};

	it('gives only the target hero a line that spends one of their actions, with weapons and cantrips', () => {
		const lines = collectGrantedActionOffers(feature, [{ actor: { uuid: 'Actor.hero' } }]);

		expect(lines).toEqual([
			expect.objectContaining({
				targetActorUuid: 'Actor.hero',
				label: 'Control',
				free: false,
				spendsReaction: false,
				weaponKind: 'any',
				allowsCantrips: true,
				ignoresRushed: false,
				condition: 'If you passed the save, attack with disadvantage.',
			}),
		]);
	});

	it('keeps the DC 15 WIL save', () => {
		const activation = source?.system.activation as { effects: Record<string, unknown>[] };

		expect(activation.effects).toEqual([
			expect.objectContaining({ type: 'savingThrow', savingThrowType: 'will', saveDC: '15' }),
		]);
	});
});

describe('Kobolds: Nooooo!', () => {
	it.each([
		'kobold',
		'kobold-minion',
		'kobold-sneak',
		'kobold-trapper',
		'kobold-denwarden',
		'kobold-clanger',
	])('%s keeps Nooooo! as a note on its stat block', (file) => {
		const kobold = packActor(`monsters/core/kobolds/${file}.json`);
		const nooooo = kobold.items.find((item) => item.name === 'Nooooo!');

		expect(nooooo?.system.description).toContain(
			'When an ally within 2 spaces dies, attack once for free.',
		);
		expect(nooooo?.system.rules).toEqual([]);
	});
});

describe('the rules of the pack documents these lines change', () => {
	it.each([
		'classFeatures/core/commander/commander-progression/master-commander.json',
		'classFeatures/core/commander/commander-subclasses/champion-of-the-bulwark/juggernaut.json',
		'classFeatures/core/commander/commander-subclasses/champion-of-the-vanguard/experienced-commander.json',
		'classFeatures/core/commander/commander-subclasses/champion-of-the-vanguard/as-one.json',
		'classFeatures/core/commander/commander-subclasses/spellblade/withering-strike.json',
		'classFeatures/core/commander/commanders-order/coordinated-strike.json',
		`${ZEPHYR}/martial-arts-ability/quickstrike.json`,
		`${ZEPHYR}/zephyr-progression/burst-of-speed.json`,
		`${ZEPHYR}/zephyr-subclasses/way-of-pain/echoed-agony.json`,
		`${ZEPHYR}/zephyr-subclasses/way-of-pain/share-my-pain.json`,
		'legendaryMonsters/core/ulvek-psionic-despot.json',
		'monsters/core/kobolds/kobold-clanger.json',
	])('%s passes the schema of each rule type', async (path) => {
		expect(await packRuleFailures(readItem(`packs/${path}`))).toEqual([]);
	});
});

describe.each([
	{
		name: 'Roll & Strike',
		path: 'classFeatures/core/hunter/hunter-progression/roll-and-strike.json',
		distance: '@speed',
		line: {
			weaponKind: 'melee',
			afterMoveCheck: 'adjacentToQuarry',
			condition: 'If you end adjacent to your quarry, make a melee attack against them for free.',
		},
	},
	{
		name: 'Into the Fray',
		path: 'classFeatures/core/berserker/savage-arsenal/into-the-fray.json',
		distance: '2 * @dexterity',
		line: {
			weaponKind: 'any',
			afterMoveCheck: 'adjacentEnemies',
			afterMoveMinEnemies: 2,
			condition:
				'If you land adjacent to at least 2 enemies, make an attack against 1 of them for free.',
		},
	},
	{
		name: "How'd YOU get here?!",
		path: 'classFeatures/core/the-cheat/underhanded-abilities/how-you-get-here.json',
		distance: '4',
		line: {
			weaponKind: 'melee',
			afterMoveCheck: 'adjacentToCondition',
			afterMoveStatus: 'distracted',
			condition: 'Make a melee attack against the Distracted target you appear next to.',
		},
	},
])('$name', ({ path, distance, line }) => {
	const source = JSON.parse(readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8'));
	const feature = packFeature(path, 'Actor.hero');

	it('lets the user move for free, up to the distance', () => {
		expect(source.system.activation.effects).toEqual([
			expect.objectContaining({
				type: 'move',
				kind: 'free',
				recipient: 'self',
				distance,
				parentNode: null,
			}),
		]);
	});

	it('gives the user alone a free attack line once the move ends, with its check', () => {
		const lines = collectGrantedActionOffers(feature, [{ actor: { uuid: 'Actor.goblin' } }]);

		expect(lines).toEqual([
			expect.objectContaining({
				targetActorUuid: 'Actor.hero',
				free: true,
				afterMove: true,
				...line,
			}),
		]);
	});

	it('has no em-dash or middle dot in its text', () => {
		const text = readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8');
		expect(text).not.toMatch(/[—·]/);
	});
});

describe('Roll & Strike charges', () => {
	it('needs Thrill of the Hunt empty, and warns at use when it is not', () => {
		const feature = packFeature(
			'classFeatures/core/hunter/hunter-progression/roll-and-strike.json',
			'Actor.hunter',
		);
		const rule = [...feature.rules.values()].find((entry) => entry.type === 'grantActivation');

		expect(rule).toMatchObject({ emptyPoolIdentifier: 'thrill-of-the-hunt' });
	});
});

describe("How'd YOU get here?! crit", () => {
	it('lets the Cheat "teleport" again on the card of an attack made through it that crits', () => {
		const source = JSON.parse(
			readFileSync(
				resolve(
					__dirname,
					'../../../../packs',
					'classFeatures/core/the-cheat/underhanded-abilities/how-you-get-here.json',
				),
				'utf8',
			),
		);

		expect(source.system.rules).toContainEqual(
			expect.objectContaining({
				type: 'freeMove',
				trigger: 'onCritThrough',
				distance: '4',
				recipient: 'self',
			}),
		);
	});
});
