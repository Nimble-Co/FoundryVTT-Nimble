import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };
type NodeSource = Record<string, unknown> & { id?: unknown };

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	rules: RuleSource[];
	activationNodes: NodeSource[];
}

// Canonical rules and activation-effect nodes the pack now ships for each
// feature, keyed by compendium source id. Rule and node ids match the pack so
// migrated copies are identical to freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.mYlWqEHXJ2Q13aSU',
		class: 'berserker',
		name: 'bloodlust',
		rules: [
			{
				type: 'diceConsumer',
				disabled: false,
				id: 'bloodlust-fury-consumer',
				identifier: '',
				label: 'Bloodlust: free movement',
				predicate: {},
				priority: 1,
				poolIdentifier: 'fury',
				poolScope: 'item',
				mode: 'manual',
				cost: '1',
				bonusOnAttackDelivery: null,
				effectFormula: '@dexterity * @n',
				effectType: 'generic',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Dh6d5Ck3AAiRwQLB',
		class: 'berserker',
		name: 'death blow',
		rules: [
			{
				type: 'diceConsumer',
				disabled: false,
				id: 'death-blow-fury-consumer',
				identifier: '',
				label: 'Death Blow: bonus damage',
				predicate: {},
				priority: 1,
				poolIdentifier: 'fury',
				poolScope: 'item',
				mode: 'manual',
				cost: '1',
				bonusOnAttackDelivery: null,
				effectFormula: '2 * @sum',
				effectType: 'generic',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.NKUQB3ClydYakqvG',
		class: 'berserker',
		name: 'onslaught',
		rules: [
			{
				type: 'speedBonus',
				disabled: false,
				id: 'onslaught-raging-speed',
				identifier: '',
				label: 'Onslaught (+2 speed while Raging)',
				predicate: {
					self: 'raging',
				},
				priority: 2,
				value: '2',
				movementType: 'walk',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.nApqsHzgRQJ7vTgb',
		class: 'berserker',
		name: 'savage awareness',
		rules: [
			{
				type: 'skillRollMode',
				disabled: false,
				id: 'savage-awareness-perception',
				identifier: '',
				label: 'Savage Awareness (Perception, blood only)',
				predicate: {},
				priority: 1,
				value: 1,
				skills: ['perception'],
				mode: 'adjust',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Ymmp3NQ0ZiVEscta',
		class: 'berserker',
		name: 'one with the ancients',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'owta-charge-pool',
				identifier: 'ancestralGuidance',
				label: 'One with the Ancients',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'owta-charge-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier: 'ancestralGuidance',
				poolScope: 'item',
				cost: '1',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.eedQA69WSnBTEC2y',
		class: 'berserker',
		name: 'intensifying fury',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'intensifying-fury-turn-refill',
				identifier: '',
				label: 'Intensifying Fury: free Fury Die at turn start',
				predicate: {},
				priority: 1,
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize: null,
				maxDelta: null,
				addRefills: [
					{
						trigger: 'onTurnStart',
						mode: 'add',
						value: '1',
						predicate: {
							self: 'raging',
						},
					},
				],
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.yUO65iWvr1NuJoQH',
		class: 'berserker',
		name: 'more blood!',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'more-blood-crit-refill',
				identifier: '',
				label: 'MORE BLOOD! (gain a Fury Die when crit)',
				predicate: {},
				priority: 1,
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize: null,
				maxDelta: null,
				addRefills: [
					{
						trigger: 'onCritReceived',
						mode: 'add',
						value: '1',
						predicate: {},
					},
				],
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.j9PQ4IkM5NgPW67m',
		class: 'berserker',
		name: "stone's resilience",
		rules: [
			{
				type: 'modifyConsumer',
				disabled: false,
				id: 'stones-resilience-dr-boost',
				identifier: '',
				label: "Stone's Resilience: add die value to reduction",
				predicate: {},
				priority: 1,
				poolIdentifier: 'fury',
				effectTypeFilter: 'damageReduction',
				appendFormula: '@sum',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.A6kBal1K8wU3o7jP',
		class: 'berserker',
		name: 'boundless rage',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'boundless-rage-fury-floor',
				identifier: '',
				label: 'Boundless Rage: Fury Dice floor of 6',
				predicate: {},
				priority: 6,
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize: null,
				maxDelta: null,
				minFace: 6,
				addRefills: [],
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Gf9B97Ch6gn0CeU0',
		class: 'berserker',
		name: 'enduring rage',
		rules: [
			{
				type: 'modifyToggle',
				disabled: false,
				id: 'enduring-rage-auto-rage',
				identifier: '',
				label: 'Enduring Rage: auto-Rage while Dying',
				predicate: {
					self: 'dying',
				},
				priority: 1,
				toggleIdentifier: 'rage',
				suppressTurnOff: [],
				turnOn: ['onTurnStart'],
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.8LFqi9XLldluX3ro',
		class: 'berserker',
		name: "titan's fury",
		rules: [
			{
				type: 'modifyToggle',
				disabled: false,
				id: 'titans-fury-auto-rage',
				identifier: '',
				label: "Titan's Fury: Rage for free when crit",
				predicate: {},
				priority: 1,
				toggleIdentifier: 'rage',
				suppressTurnOff: [],
				turnOn: ['onCritReceived'],
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.m2UtBsxfiXhKRLYD',
		class: 'berserker',
		name: 'blood frenzy',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'blood-frenzy-use-pool',
				identifier: 'bloodFrenzyUse',
				label: 'Blood Frenzy use',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				recoveries: [
					{
						trigger: 'onTurnStart',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'blood-frenzy-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier: 'bloodFrenzyUse',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'diceConsumer',
				disabled: false,
				id: 'blood-frenzy-fury-maximize',
				identifier: '',
				label: 'Blood Frenzy: change a Fury Die to its maximum',
				predicate: {},
				priority: 1,
				poolIdentifier: 'fury',
				poolScope: 'item',
				mode: 'manual',
				cost: '1',
				bonusOnAttackDelivery: null,
				effectFormula: null,
				effectType: 'generic',
				selectionOutcome: 'maximize',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.TlypDcFgcmWK8Vpu',
		class: 'berserker',
		name: 'deathless rage',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'deathless-rage-use-pool',
				identifier: 'deathlessRageUse',
				label: 'Deathless Rage use',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				recoveries: [
					{
						trigger: 'onTurnStart',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'deathless-rage-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier: 'deathlessRageUse',
				poolScope: 'item',
				cost: '1',
			},
		],
		activationNodes: [
			{
				id: 'dlReminderNote0001',
				type: 'note',
				noteType: 'reminder',
				text: 'While Dying: mark 1 Wound on your sheet and gain 1 action.',
				parentContext: null,
				parentNode: null,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.8LMk8Ke1m1AXR0ij',
		class: 'berserker',
		name: 'unbreakable',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'unbreakable-use-pool',
				identifier: 'unbreakableUse',
				label: 'Unbreakable use',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				recoveries: [
					{
						trigger: 'encounterStart',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'unbreakable-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier: 'unbreakableUse',
				poolScope: 'item',
				cost: '1',
			},
		],
		activationNodes: [
			{
				id: 'ubkReminderNote001',
				type: 'note',
				noteType: 'reminder',
				text: 'While Raging: negate the Wound or negative condition you would have suffered.',
				parentContext: null,
				parentNode: null,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.0mqEGhkAP8NlDPzg',
		class: 'berserker',
		name: 'swift fury',
		rules: [
			{
				type: 'poolGainMessage',
				disabled: false,
				id: 'swift-fury-gain-message',
				identifier: '',
				label: 'Swift Fury',
				predicate: {},
				priority: 1,
				poolIdentifier: 'fury',
				formula: '@dexterity',
				message: 'Swift Fury: move up to {value} spaces for free, ignoring difficult terrain.',
			},
		],
		activationNodes: [],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.kzVOQCSwuKKZuVCM',
		class: 'berserker',
		name: 'whirlwind',
		rules: [],
		activationNodes: [
			{
				id: 'wwReminderNote001',
				type: 'note',
				noteType: 'reminder',
				text: "Attack ALL targets within your melee weapon's reach.",
				parentContext: null,
				parentNode: null,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.BwBEwpLxb8sUfbw4',
		class: 'berserker',
		name: "you're next!",
		rules: [],
		activationNodes: [
			{
				id: 'ynReminderNote001',
				type: 'note',
				noteType: 'reminder',
				text: "While Raging: make a Might check, DC = the target's current HP. On a success, the enemy immediately flees the battle.",
				parentContext: null,
				parentNode: null,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.1y4RJSu2xmimR26x',
		class: 'berserker',
		name: 'unstoppable brutality',
		rules: [],
		activationNodes: [
			{
				id: 'ubReminderNote001',
				type: 'note',
				noteType: 'reminder',
				text: 'Gain 1 Wound (mark it on your sheet), then reroll the attack or save.',
				parentContext: null,
				parentNode: null,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Ecmnf0pXwd511FKP',
		class: 'berserker',
		name: 'thunderous steps',
		rules: [],
		activationNodes: [
			{
				id: 'tsReminderNote001',
				type: 'note',
				noteType: 'reminder',
				text: 'Requires: you moved at least 4 spaces while Raging. Damage applies to all adjacent creatures where you stop.',
				parentContext: null,
				parentNode: null,
			},
		],
	},
];

/**
 * Signature identifying a rule for dedupe. Keyed on the rule's canonical pack
 * id when present, falling back to type plus its primary target field so
 * hand-added equivalents are not duplicated.
 */
function ruleSignature(rule: RuleSource): string {
	if (typeof rule.id === 'string' && rule.id.length > 0) return `id:${rule.id}`;
	const target =
		(rule as { poolIdentifier?: unknown }).poolIdentifier ??
		(rule as { toggleIdentifier?: unknown }).toggleIdentifier ??
		(rule as { identifier?: unknown }).identifier ??
		'';
	return `${String(rule.type)}:${String(target)}`;
}

/**
 * Backfills embedded copies of the Berserker features automated in the
 * Berserker automation batch (#683) with the rules and activation-effect
 * nodes the pack now ships. Existing actor copies predate the rules and would
 * otherwise need a manual re-drag from the compendium.
 *
 * Matches on compendium source id, falling back to class + item name for
 * copies without one. Idempotent: rules are appended only when no rule with
 * the same signature is present, and nodes only when no node with the same id
 * is present.
 */
class Migration033BerserkerAutomation extends MigrationBase {
	static override readonly version = 33;

	override readonly version = Migration033BerserkerAutomation.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		let changed = false;
		if (spec.rules.length > 0) changed = this.#appendRules(source, spec) || changed;
		if (spec.activationNodes.length > 0) changed = this.#appendNodes(source, spec) || changed;

		if (changed) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: added berserker automation rules`,
			);
		}
	}

	#appendRules(source: any, spec: FeatureSpec): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);
		const present = new Set(rules.map((rule) => ruleSignature(rule)));

		let changed = false;
		for (const rule of spec.rules) {
			if (present.has(ruleSignature(rule))) continue;
			rules.push(foundry.utils.deepClone(rule));
			present.add(ruleSignature(rule));
			changed = true;
		}
		return changed;
	}

	#appendNodes(source: any, spec: FeatureSpec): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const activation = (system.activation ??= {} as Record<string, unknown>);
		if (!Array.isArray(activation.effects)) activation.effects = [];
		const effects = activation.effects as NodeSource[];

		const existingIds = new Set(
			effects.map((node) => (typeof node?.id === 'string' ? node.id : null)).filter(Boolean),
		);

		let changed = false;
		for (const node of spec.activationNodes) {
			if (typeof node.id === 'string' && existingIds.has(node.id)) continue;
			effects.push(foundry.utils.deepClone(node));
			changed = true;
		}
		return changed;
	}

	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = this.getSourceId(source);
		const byId = FEATURES.find((f) => f.sourceId === sourceId);
		if (byId) return byId;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const cls = source.system?.class;
		return FEATURES.find((f) => f.class === cls && f.name === name);
	}
}

export { Migration033BerserkerAutomation };
