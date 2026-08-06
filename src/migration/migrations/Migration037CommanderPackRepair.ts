import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };
type NodeSource = Record<string, unknown> & { id?: unknown };

interface ActivationCostSpec {
	/** Cost the pack now ships. */
	cost: { type: string; quantity: number };
	/** Cost the pack shipped before, and the only one we are allowed to replace. */
	supersededCost: { type: string; quantity: number };
}

interface ActivationNodeReplacement {
	/** Node the pack now ships in the superseded node's place. */
	node: NodeSource;
	/** The node it replaces, matched in full so a GM's edit aborts the swap. */
	supersededNode: NodeSource;
}

interface ActivationEffectsSpec {
	/** Effects the pack now ships. */
	effects: NodeSource[];
	/**
	 * The whole effect list the pack shipped before. Used where the pack grew a
	 * card from nothing, so there is no individual node to swap: if a GM has put
	 * anything at all on the card we leave their version alone.
	 */
	supersededEffects: NodeSource[];
}

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	/** Rules the pack now ships, appended when an equivalent is not present. */
	rules?: RuleSource[];
	/** Rules the pack dropped, removed only while they still match ours exactly. */
	removedRules?: RuleSource[];
	activationCost?: ActivationCostSpec;
	activationNodeReplacements?: ActivationNodeReplacement[];
	activationEffects?: ActivationEffectsSpec;
}

interface NoteSpec {
	id: string;
	noteType: string;
	text: string;
}

const COMBAT_TACTICS_TEXT =
	'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.';

/** A top-level note node, the shape every repaired card now carries. */
function noteNode({ id, noteType, text }: NoteSpec): NodeSource {
	return {
		id,
		type: 'note',
		noteType,
		text,
		parentContext: null,
		parentNode: null,
	};
}

/**
 * Describes lifting a note out of the placeholder damage node it used to hang
 * off. Eight of these features shipped the same construction: an `acid` / `0`
 * damage node whose only purpose was to carry one reminder under `on.hit`.
 * Since damage is applied in one pass per attack (#890), that placeholder emits
 * a real zero-damage packet on every card, so the pack now ships the note on its
 * own. The note keeps its id, type and text across the lift, which is why both
 * halves of the replacement can be derived from a single description.
 */
function liftedNote(spec: {
	damageId: string;
	canCrit: boolean;
	canMiss: boolean;
	note: NoteSpec;
}): ActivationNodeReplacement {
	return {
		node: noteNode(spec.note),
		supersededNode: {
			id: spec.damageId,
			type: 'damage',
			damageType: 'acid',
			formula: '0',
			parentContext: null,
			parentNode: null,
			canCrit: spec.canCrit,
			canMiss: spec.canMiss,
			on: {
				hit: [
					{
						id: spec.note.id,
						type: 'note',
						noteType: spec.note.noteType,
						text: spec.note.text,
						parentContext: 'hit',
						parentNode: spec.damageId,
					},
				],
			},
		},
	};
}

// Canonical rules and activation data the pack now ships for each feature,
// keyed by compendium source id. Rule and node ids match the pack so migrated
// copies are identical to freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.cmrCy26QPZrZ0eFN',
		class: 'commander',
		name: 'commanding presence',
		activationNodeReplacements: [
			liftedNote({
				damageId: '7JvhPSrNy39dL4jM',
				canCrit: true,
				canMiss: true,
				note: { id: 'IsAy46e12s3J0Ao1', noteType: 'flavor', text: COMBAT_TACTICS_TEXT },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.FrPigc4J5msonEaJ',
		class: 'commander',
		name: 'heavy strike',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'KYlDzNtEw6GU7F18',
				canCrit: false,
				canMiss: false,
				note: { id: 'vvvjnGkqOAmif27A', noteType: 'flavor', text: COMBAT_TACTICS_TEXT },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Wh8QAe0TSjpgEJFr',
		class: 'commander',
		name: 'inerrant strike.',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'QAVgiQieJEa3Z9kM',
				canCrit: false,
				canMiss: false,
				note: { id: 'tlIdRtb6mhnZuJG2', noteType: 'flavor', text: COMBAT_TACTICS_TEXT },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.5I3ulG74pLtLRBut',
		class: 'commander',
		name: 'lunging strike',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'XBG95BPpRB6MAyw8',
				canCrit: false,
				canMiss: false,
				note: { id: 'NXsbvppkgMQJxeDe', noteType: 'flavor', text: COMBAT_TACTICS_TEXT },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.a4y6d9VDchbMKrJn',
		class: 'commander',
		name: 'sweeping strike',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'RxCoShYLT1TasXls',
				canCrit: false,
				canMiss: false,
				note: { id: 'Prn094f0MIvEpsDS', noteType: 'flavor', text: COMBAT_TACTICS_TEXT },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.KyQivlTfzYYudgsT',
		class: 'commander',
		name: 'field medic',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'nf3Bq7Mu65OWbwuG',
				canCrit: false,
				canMiss: false,
				note: { id: 'A0krnEBgerU3KhXA', noteType: 'reminder', text: 'Examination bonus' },
			}),
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.9BEzKcYWuIcKtmie',
		class: 'commander',
		name: 'hold the line!',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'XH1nYBQmTOcSGSOD',
				canCrit: false,
				canMiss: false,
				note: { id: 'uC0AteQ0SifbYMh7', noteType: 'warning', text: 'Set their HP to 3× your LVL.' },
			}),
		],
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'hold-the-line-use-pool',
				identifier: 'hold-the-line-use',
				label: 'Hold the Line! use',
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
				id: 'hold-the-line-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'hold-the-line-use',
				poolScope: 'item',
				cost: '1',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.sYJ4IREnwdrhzp8E',
		class: 'commander',
		name: 'i can do this all day!',
		activationNodeReplacements: [
			liftedNote({
				damageId: 'KhEc8kQgCffaPLYS',
				canCrit: false,
				canMiss: true,
				note: {
					id: 'O0SxGYEXguqDORKt',
					noteType: 'reminder',
					text: 'set HP = sum rolled Hit dice',
				},
			}),
		],
		// A half-configured rule from the original authoring pass. It carries no
		// value and no predicate, so it caps nothing and only clutters the sheet.
		removedRules: [
			{
				type: 'maxHitDice',
				name: 'New Rule 1',
				id: '75GQq1kNmfQR1JzG',
			},
		],
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'i-can-do-this-all-day-use-pool',
				identifier: 'i-can-do-this-all-day-use',
				label: 'I Can Do This ALL DAY! use',
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
				id: 'i-can-do-this-all-day-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'i-can-do-this-all-day-use',
				poolScope: 'item',
				cost: '1',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.x9VscDoB05eIwoL0',
		class: 'commander',
		name: 'move it! move it!',
		// The only card of the batch whose placeholder rolled real dice: an
		// initiative roll dressed up as thunder damage, which applied itself as
		// damage to whatever was targeted. Initiative is rolled by the combat
		// tracker, so the card now only reminds the player what the order does.
		activationNodeReplacements: [
			{
				node: noteNode({
					id: 'JyS0bPpvH6ttPAoG',
					noteType: 'reminder',
					text: 'Roll Initiative with advantage, and give one ally advantage on theirs. Both of you gain +3 speed for 1 round.',
				}),
				supersededNode: {
					id: 'Wyn3mgAxSL4q7pMp',
					type: 'damage',
					damageType: 'thunder',
					formula: '1d20+@attributes.initiative.mod',
					parentContext: null,
					parentNode: null,
					canCrit: false,
					canMiss: false,
					on: {
						hit: [
							{
								id: '2MD4a4v9xBkLj9Ra',
								type: 'damageOutcome',
								outcome: 'fullDamage',
								parentContext: 'hit',
								parentNode: 'Wyn3mgAxSL4q7pMp',
							},
							{
								id: 'JyS0bPpvH6ttPAoG',
								type: 'note',
								noteType: 'flavor',
								text: 'You can use this value as an advantage in your initiative. ',
								parentContext: 'hit',
								parentNode: 'Wyn3mgAxSL4q7pMp',
							},
						],
					},
				},
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.uvP5qvxMonL4ZOw2',
		class: 'commander',
		name: 'taunting strike',
		activationCost: {
			cost: { type: 'action', quantity: 0 },
			supersededCost: { type: 'none', quantity: 1 },
		},
		activationEffects: {
			effects: [
				{
					id: 'TsTauntCond01x9',
					type: 'condition',
					condition: 'taunted',
					parentContext: null,
					parentNode: null,
				},
				noteNode({
					id: 'TsTauntNote01x9',
					noteType: 'reminder',
					text: 'Use after you hit a creature. It is Taunted by you until the end of its next turn.',
				}),
			],
			supersededEffects: [],
		},
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'taunting-strike-use-pool',
				identifier: 'taunting-strike-use',
				label: 'Taunting Strike use',
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
				id: 'taunting-strike-use-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'taunting-strike-use',
				poolScope: 'item',
				cost: '1',
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
		(rule as { identifier?: unknown }).identifier ??
		'';
	return `${String(rule.type)}:${String(target)}`;
}

/**
 * Structural equality for plain JSON data.
 *
 * Activation effects are stored as raw objects (`ArrayField(ObjectField)`), and
 * the activation pipeline works off a `deepClone`, so an untouched embedded copy
 * still holds the node exactly as the pack authored it. That makes full equality
 * a usable fingerprint: any difference at all means someone edited the node, and
 * the safe response is to leave it alone.
 */
function isSameJson(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((entry, index) => isSameJson(entry, b[index]));
	}
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) => key in right && isSameJson(left[key], right[key]));
}

/**
 * Repairs the ten Commander features the pack fixed after the Coordinated
 * Strike pass. Existing actor copies still carry the broken versions and would
 * otherwise need a manual re-drag from the compendium.
 *
 * Most of the batch shares one defect: a placeholder `acid` / `0` damage node
 * that existed only to hang a reminder off, which since #890 emits a real
 * zero-damage packet on every card. Move it! Move it! is the loud version of the
 * same mistake, rolling initiative as thunder damage against the target. The
 * rest is automation the pack gained afterwards: once-per-encounter pools for
 * Hold the Line! and I Can Do This ALL DAY!, a once-per-turn pool plus the
 * Taunted condition for Taunting Strike, and the removal of a half-configured
 * `maxHitDice` rule that never did anything.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and deliberately conservative about overwriting:
 * rules are appended only when no rule with the same signature is present, and
 * every value we replace or remove is touched only while it still holds exactly
 * what the pack shipped before. A GM who reworded a reminder, gave the
 * placeholder a real formula, edited the stale rule, or built their own card for
 * Taunting Strike keeps their version, and nodes they added alongside ours
 * survive in place.
 */
class Migration037CommanderPackRepair extends MigrationBase {
	static override readonly version = 37;

	override readonly version = Migration037CommanderPackRepair.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		let changed = false;
		if (spec.removedRules) changed = this.#removeRules(source, spec.removedRules) || changed;
		if (spec.rules) changed = this.#appendRules(source, spec.rules) || changed;
		if (spec.activationCost) {
			changed = this.#applyActivationCost(source, spec.activationCost) || changed;
		}
		if (spec.activationNodeReplacements) {
			changed = this.#replaceActivationNodes(source, spec.activationNodeReplacements) || changed;
		}
		if (spec.activationEffects) {
			changed = this.#applyActivationEffects(source, spec.activationEffects) || changed;
		}

		if (changed) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: repaired commander feature card`,
			);
		}
	}

	#appendRules(source: any, specRules: RuleSource[]): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);
		const present = new Set(rules.map((rule) => ruleSignature(rule)));

		let changed = false;
		for (const rule of specRules) {
			if (present.has(ruleSignature(rule))) continue;
			rules.push(foundry.utils.deepClone(rule));
			present.add(ruleSignature(rule));
			changed = true;
		}
		return changed;
	}

	#removeRules(source: any, removedRules: RuleSource[]): boolean {
		const rules = source.system?.rules as RuleSource[] | undefined;
		if (!Array.isArray(rules)) return false;

		const kept = rules.filter((rule) => !removedRules.some((removed) => isSameJson(rule, removed)));
		if (kept.length === rules.length) return false;

		source.system.rules = kept;
		return true;
	}

	#applyActivationCost(source: any, { cost, supersededCost }: ActivationCostSpec): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const activation = (system.activation ??= {} as Record<string, unknown>);
		const current = activation.cost as Record<string, unknown> | undefined;
		if (!current || typeof current !== 'object') return false;

		const isSuperseded =
			current.type === supersededCost.type && current.quantity === supersededCost.quantity;
		if (!isSuperseded) return false;

		current.type = cost.type;
		current.quantity = cost.quantity;
		return true;
	}

	#replaceActivationNodes(source: any, replacements: ActivationNodeReplacement[]): boolean {
		const effects = source.system?.activation?.effects as NodeSource[] | undefined;
		if (!Array.isArray(effects)) return false;

		let changed = false;
		for (const { node, supersededNode } of replacements) {
			// Swap in place so any nodes a GM added around ours keep their order.
			const index = effects.findIndex((candidate) => isSameJson(candidate, supersededNode));
			if (index === -1) continue;
			effects[index] = foundry.utils.deepClone(node);
			changed = true;
		}
		return changed;
	}

	#applyActivationEffects(source: any, spec: ActivationEffectsSpec): boolean {
		const activation = source.system?.activation as Record<string, unknown> | undefined;
		if (!activation || typeof activation !== 'object') return false;

		if (!isSameJson(activation.effects, spec.supersededEffects)) return false;

		activation.effects = foundry.utils.deepClone(spec.effects);
		return true;
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

export { Migration037CommanderPackRepair };
