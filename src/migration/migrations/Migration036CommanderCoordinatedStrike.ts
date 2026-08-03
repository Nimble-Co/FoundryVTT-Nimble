import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };
type NodeSource = Record<string, unknown> & { id?: unknown };
type TemplateSource = { length: number; radius: number; shape: string; width: number };

interface ActivationCostSpec {
	/** Cost the pack now ships. */
	cost: { type: string; quantity: number };
	/** Cost the pack shipped before, and the only one we are allowed to replace. */
	supersededCost: { type: string; quantity: number };
}

interface ActivationTemplateSpec {
	/** Template and targeting flag the pack now ships. */
	template: TemplateSource;
	acquireTargetsFromTemplate: boolean;
	/**
	 * Template the pack shipped before, and the only one we are allowed to
	 * replace. The targeting flag is not part of the guard: nothing on a feature
	 * card reads it, so it is metadata that follows the template rather than a
	 * decision worth preserving on its own.
	 */
	supersededTemplate: TemplateSource;
}

interface ActivationNodeReplacement {
	/** Node the pack now ships in the superseded node's place. */
	node: NodeSource;
	/** The node it replaces, matched in full so a GM's edit aborts the swap. */
	supersededNode: NodeSource;
}

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	rules: RuleSource[];
	activationCost?: ActivationCostSpec;
	activationTemplate?: ActivationTemplateSpec;
	activationNodeReplacements?: ActivationNodeReplacement[];
}

// Canonical rules and activation data the pack now ships for each feature,
// keyed by compendium source id. Rule and node ids match the pack so migrated
// copies are identical to freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.6xpILHYt5KTSnTtd',
		class: 'commander',
		name: 'coordinated strike!',
		activationCost: {
			cost: { type: 'action', quantity: 0 },
			supersededCost: { type: 'none', quantity: 1 },
		},
		activationTemplate: {
			template: { length: 1, radius: 1, shape: '', width: 1 },
			acquireTargetsFromTemplate: false,
			supersededTemplate: { length: 1, radius: 1, shape: 'square', width: 6 },
		},
		activationNodeReplacements: [
			{
				node: {
					id: '0gbDXjqJDZcUxjNB',
					type: 'note',
					noteType: 'reminder',
					text: 'You and the targeted ally each attack for free. The ally may cast a cantrip instead; only the weapon attack is offered on this card.',
					parentContext: null,
					parentNode: null,
				},
				supersededNode: {
					id: 'YnNEXga2R6LAEvlb',
					type: 'damage',
					damageType: 'acid',
					formula: '0',
					parentContext: null,
					parentNode: null,
					canCrit: false,
					canMiss: false,
					on: {
						hit: [
							{
								id: '0gbDXjqJDZcUxjNB',
								type: 'note',
								noteType: 'reminder',
								text: 'You can do this INT times/Safe Rest.',
								parentContext: 'hit',
								parentNode: 'YnNEXga2R6LAEvlb',
							},
						],
					},
				},
			},
		],
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'coordinated-strike-uses-pool',
				identifier: 'coordinated-strike-uses',
				label: 'Coordinated Strike uses',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: 'max(@intelligence, 0)',
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
				type: 'chargePool',
				disabled: false,
				id: 'coordinated-strike-round-pool',
				identifier: 'coordinated-strike-round',
				label: 'Coordinated Strike (1/round)',
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
					{
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'coordinated-strike-uses-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'coordinated-strike-uses',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'coordinated-strike-round-consumer',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'coordinated-strike-round',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'grantActivation',
				disabled: false,
				id: 'coordinated-strike-ally-attack',
				identifier: '',
				label: 'Coordinated Strike',
				predicate: {},
				priority: 3,
				activationType: 'weaponAttack',
			},
			{
				type: 'actionDelta',
				disabled: false,
				id: 'coordinated-strike-self-free-attack',
				identifier: '',
				label: 'Coordinated Strike (your attack is free)',
				predicate: {},
				priority: 3,
				value: '1',
				timing: 'now',
				target: 'self',
				borrowFromNextTurn: false,
			},
			{
				type: 'actionDelta',
				disabled: false,
				id: 'coordinated-strike-ally-free-attack',
				identifier: '',
				label: 'Coordinated Strike (ally attack is free)',
				predicate: {},
				priority: 3,
				value: '1',
				timing: 'now',
				target: 'targeted',
				borrowFromNextTurn: false,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.qbrHOGpSY2thczfu',
		class: 'commander',
		name: 'master commander',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'master-commander-uses-l9',
				identifier: '',
				label: 'Master Commander (2): +1 use of Coordinated Strike',
				predicate: {
					level: {
						min: 9,
					},
				},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: '1',
			},
			{
				type: 'modifyPool',
				disabled: false,
				id: 'master-commander-uses-l13',
				identifier: '',
				label: 'Master Commander (3): +1 use of Coordinated Strike',
				predicate: {
					level: {
						min: 13,
					},
				},
				priority: 2,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: '1',
			},
			{
				type: 'modifyPool',
				disabled: false,
				id: 'master-commander-uses-l17',
				identifier: '',
				label: 'Master Commander (4): +1 use of Coordinated Strike',
				predicate: {
					level: {
						min: 17,
					},
				},
				priority: 3,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: '1',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.UOx9MGeTyXGK9iEh',
		class: 'commander',
		name: 'experienced commander.',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'experienced-commander-uses',
				identifier: '',
				label: 'Experienced Commander: +1 use of Coordinated Strike',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: '1',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.4Iu4tRnP8kBJd2ra',
		class: 'commander',
		name: 'survey the battlefield.',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'survey-the-battlefield-combat-dice',
				identifier: '',
				label: 'Survey the Battlefield: +1 max Combat Dice',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'combat-dice',
				dieSize: null,
				maxDelta: '1',
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
 * Backfills embedded copies of the Commander features automated alongside
 * Coordinated Strike with the rules the pack now ships, and re-stamps the
 * activation data that changed with them. Existing actor copies predate all of
 * it and would otherwise need a manual re-drag from the compendium.
 *
 * The activation carry-over is not cosmetic. Coordinated Strike shipped with a
 * placeholder `acid` / `0` damage node that existed only to hang a reminder off,
 * and since damage is applied in one pass per attack (#890) that node emits a
 * real zero-damage packet on every card. Every existing Commander has it. The
 * stray `square` / 6 template is the other half: any template shape puts the
 * item into AoE mode, which forces crit and miss off for damage nodes.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and deliberately conservative about overwriting:
 * rules are appended only when no rule with the same signature is present, and
 * each activation value is rewritten only while it still holds exactly what the
 * pack shipped before. A GM who reworded the reminder, changed the damage
 * formula, reshaped the template, or picked a different action cost keeps their
 * version, and nodes they added alongside ours survive in place.
 */
class Migration036CommanderCoordinatedStrike extends MigrationBase {
	static override readonly version = 36;

	override readonly version = Migration036CommanderCoordinatedStrike.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		let changed = false;
		if (spec.rules.length > 0) changed = this.#appendRules(source, spec) || changed;
		if (spec.activationCost) {
			changed = this.#applyActivationCost(source, spec.activationCost) || changed;
		}
		if (spec.activationTemplate) {
			changed = this.#applyActivationTemplate(source, spec.activationTemplate) || changed;
		}
		if (spec.activationNodeReplacements) {
			changed = this.#replaceActivationNodes(source, spec.activationNodeReplacements) || changed;
		}

		if (changed) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: added commander automation rules`,
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

	#applyActivationTemplate(source: any, spec: ActivationTemplateSpec): boolean {
		const activation = source.system?.activation as Record<string, unknown> | undefined;
		if (!activation || typeof activation !== 'object') return false;

		if (!isSameJson(activation.template, spec.supersededTemplate)) return false;

		activation.template = foundry.utils.deepClone(spec.template);
		activation.acquireTargetsFromTemplate = spec.acquireTargetsFromTemplate;
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

	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = this.getSourceId(source);
		const byId = FEATURES.find((f) => f.sourceId === sourceId);
		if (byId) return byId;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const cls = source.system?.class;
		return FEATURES.find((f) => f.class === cls && f.name === name);
	}
}

export { Migration036CommanderCoordinatedStrike };
