import { isCompendiumId, toPackSourceId, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface SaveChange {
	nodeId: string;
	field: 'saveDC' | 'saveType';
	from: string;
	to: string;
}

interface PackItemSpec {
	sourceId: string;
	type: 'ancestryBonus' | 'background' | 'boon' | 'feature';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** Empty for an item with no class: the type and the name match it. */
	classIdentifier: string;
	/** Rules the pack shipped before, so these do not count as the GM's own. */
	shippedRuleIds?: string[];
	rules?: RuleSource[];
	/** Written only while the rule still holds every value of `old`. */
	ruleChange?: { old: RuleSource; field: string; to: unknown };
	/** Removed when the rule that replaces the note is on the copy. */
	retiredNotes?: { id: string; text: string; ruleId: string }[];
	saveChange?: SaveChange;
}

const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';
const BACKGROUND_PREFIX = 'Compendium.nimble.nimble-backgrounds.Item.';
const BOON_PREFIX = 'Compendium.nimble.nimble-boons.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}Z2TN2RVAcb53Oysu`,
		type: 'ancestryBonus',
		name: 'elusive',
		classIdentifier: '',
		shippedRuleIds: ['8tjF62d2Ji6suGUb'],
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'cti52sWpqyVNkx1l',
				identifier: 'elusive',
				label: 'Elusive (1/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'changeResult',
				disabled: false,
				id: 'syVcXxThj6BXk6o0',
				identifier: '',
				label: 'Elusive',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'succeed',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: 'elusive',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${BACKGROUND_PREFIX}f0NwBPv4wuUA8FlA`,
		type: 'background',
		name: 'accidental acrobat',
		classIdentifier: '',
		rules: [
			{
				type: 'reroll',
				disabled: false,
				id: 'NupzJP9M1RKKqnHk',
				identifier: '',
				label: 'Accidental Acrobat',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack', 'save', 'skillCheck'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: 'dexterity',
				die: 'wholeRoll',
				keep: 'new',
				useAnotherStat: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				oncePerRoll: true,
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
				automatic: false,
				discardedCritTriggers: false,
				cardHint: 'If you still fail, the consequences are BAD. The GM decides them.',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${BACKGROUND_PREFIX}rETdxlnIl3FsKSPf`,
		type: 'background',
		name: 'bumblewise',
		classIdentifier: '',
		rules: [
			{
				type: 'changeResult',
				disabled: false,
				id: 'cSMaPn3InzEqIPCr',
				identifier: '',
				label: 'Bumblewise',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save', 'skillCheck'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: 'will',
				change: 'countsAsNat20',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${BACKGROUND_PREFIX}MR20iV8aWQi8qGsp`,
		type: 'background',
		name: 'wily underdog',
		classIdentifier: '',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'iqcMj0xQDJkaXAuK',
				identifier: 'wily-underdog',
				label: 'Wily Underdog (1/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'reroll',
				disabled: false,
				id: 'nPT6RmDpSm2VYzRF',
				identifier: '',
				label: 'Wily Underdog',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack', 'save', 'skillCheck'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: 'strength',
				die: 'wholeRoll',
				keep: 'new',
				useAnotherStat: true,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: 'wily-underdog',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				oncePerRoll: false,
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
				automatic: false,
				discardedCritTriggers: false,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${BOON_PREFIX}S3KeMZGvvaXymN7U`,
		type: 'boon',
		name: 'epic resistance',
		classIdentifier: '',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'CO1rhY2LhawIMRf5',
				identifier: 'epic-resistance',
				label: 'Epic Resistance (1/encounter)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'encounterStart',
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
				type: 'changeResult',
				disabled: false,
				id: 'BS32rk4U5NJvGJlm',
				identifier: '',
				label: 'Epic Resistance',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'succeed',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: 'epic-resistance',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
			{
				type: 'changeResult',
				disabled: false,
				id: 'MMf8pIZFk0RjPEYa',
				identifier: '',
				label: 'Epic Resistance',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'target',
				reach: 0,
				relatedStat: '',
				change: 'noDamage',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: 'epic-resistance',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}u7UhIHOiXrAv6DEY`,
		type: 'feature',
		name: 'steel will',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'zTiDDLUsYbobOvbi',
				identifier: 'steel-will',
				label: 'Steel Will (1/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'changeResult',
				disabled: false,
				id: 'cHqRdj1yLggWXMPL',
				identifier: '',
				label: 'Steel Will',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'succeed',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: 'steel-will',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}xt1o11GO5M3TTNqs`,
		type: 'feature',
		name: 'knowledge from beyond',
		classIdentifier: 'shadowmancer',
		rules: [
			{
				type: 'changeResult',
				disabled: false,
				id: 'vYi8Br93KP1oNgm1',
				identifier: '',
				label: 'Knowledge from Beyond',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['skillCheck'],
				saves: [],
				skills: ['insight', 'arcana'],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'succeed',
				formula: '',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 1,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}idoDoUQuz13FFyJS`,
		type: 'feature',
		name: "i'm so famous!",
		classIdentifier: 'songweaver',
		rules: [
			{
				type: 'modifyReroll',
				disabled: false,
				id: '5fElW6xNozwt69SJ',
				identifier: '',
				label: "I'm So Famous!: Songweaver's Inspiration cannot fail",
				predicate: {},
				priority: 1,
				suppressActivationCard: 'auto',
				rerollIdentifier: 'songweavers-inspiration',
				rollModeChange: 0,
				extraDamage: '',
				cannotFail: true,
				actionsForRoller: 0,
				tempHp: '',
				tempHpWithin: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}edxgmJvF5XT66UPL`,
		type: 'feature',
		name: 'mighty soul',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'changeResult',
				disabled: false,
				id: 'ySP1fwHfTNcx5yzg',
				identifier: '',
				label: 'Mighty Soul',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'add',
				formula: '@strength',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'failed',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 1,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}6hqJxGuTsQnL21zP`,
		type: 'feature',
		name: 'cheat!',
		classIdentifier: 'the-cheat',
		shippedRuleIds: [
			'IcKe27NHzAsdT0T0',
			'3dT1X6L8FsDqVgdo',
			'kjeK5TE6b0P8jjup',
			'zEpqjsJl49AcfRyH',
		],
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'mih21mwjz6ehjN61',
				identifier: 'cheat-skill-check',
				label: 'Cheat!: 10+INT skill check (1/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'changeResult',
				disabled: false,
				id: 'hpY3i8MUHqyyXeef',
				identifier: '',
				label: 'Cheat!',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['skillCheck'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'setTotal',
				formula: '10+@intelligence',
				onlyIfLower: false,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: 'cheat-skill-check',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
			{
				type: 'changeResult',
				disabled: false,
				id: 'Bl3K1BHzBF6U2uJf',
				identifier: '',
				label: 'Cheat!',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['initiative'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				change: 'setTotal',
				formula: '10',
				onlyIfLower: true,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
		retiredNotes: [
			{
				id: 'q7VbN2kLwXp4RsTe',
				text: '1/day: you may change any skill check to 10+INT.',
				ruleId: 'hpY3i8MUHqyyXeef',
			},
			{
				id: 'Xm3kQp9vLt2RwHn7',
				text: 'If you roll under 10 on Initiative, you may change it to 10.',
				ruleId: 'Bl3K1BHzBF6U2uJf',
			},
		],
	},
	{
		sourceId: `${BACKGROUND_PREFIX}BYLPmm5MwufOYWac`,
		type: 'background',
		name: "so dumb i'm smart sometimes",
		classIdentifier: '',
		ruleChange: {
			old: {
				type: 'reroll',
				disabled: false,
				id: 'UA5HzpDBf66eZgmc',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['save'],
				saves: ['intelligence'],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: 'so-dumb-im-smart-sometimes-save',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				rollModeChange: 1,
				primaryDieBonus: 0,
				extraDamage: '',
				automatic: false,
				discardedCritTriggers: false,
				oncePerRoll: false,
			},
			field: 'outcome',
			to: 'failed',
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}jKWdnAj0kXxd2aN0`,
		type: 'feature',
		name: 'cunning strike',
		classIdentifier: 'the-cheat',
		saveChange: { nodeId: 'ePNURkryI1sqKPP8', field: 'saveDC', from: '10', to: '10+@intelligence' },
	},
];

const DRAVOK = {
	sourceId: 'Compendium.nimble.nimble-legendary-monsters.Actor.7n4NFalMBVr8hKaP',
	name: 'dravok, all-seeing tyrant',
};

const DEATH_RAY_SAVE: SaveChange = {
	nodeId: 'NtuaFaXDaxQrKEmP',
	field: 'saveType',
	from: 'will',
	to: 'strength',
};

function deepEquals(left: unknown, right: unknown): boolean {
	if (left === right) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		return left.length === right.length && left.every((entry, i) => deepEquals(entry, right[i]));
	}

	if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
		return false;
	}

	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) =>
		deepEquals((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
	);
}

function findNode(nodes: unknown, id: string): Record<string, unknown> | undefined {
	if (!Array.isArray(nodes)) return undefined;
	for (const node of nodes) {
		if (node?.id === id) return node;
		for (const children of Object.values(node?.on ?? {})) {
			const found = findNode(children, id);
			if (found) return found;
		}
	}
	return undefined;
}

/**
 * Gives copies of the items that now use check outcomes what the pack now
 * ships: Change a Result and Reroll rules with their charge pools, the Modify
 * Reroll rule of I'm So Famous!, and corrected save nodes.
 *
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the added rules use, so a feature
 * never works twice. A rule with a pack id is never overwritten. Each other
 * write needs the old pack value: the So Dumb save rule moves to `failed` only
 * while the whole rule is as shipped, a save node changes only while it holds
 * the old value, and a Cheat! note goes only while its text is as shipped and
 * its replacement rule is on the copy.
 *
 * Matched on compendium source id, falling back to the type, the class and the
 * name for a copy stripped of one. Dravok's Death Ray is matched by its actor
 * and its node id. On every item, a rule's `oncePerAttack` becomes
 * `oncePerRoll`. A second run changes nothing.
 */
class Migration074CheckOutcomes extends MigrationBase {
	static override readonly version = 74;

	override readonly version = Migration074CheckOutcomes.version;

	override async updateItem(source: any, parent?: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		if (this.#renameOncePerAttack(system)) {
			console.log(`Nimble Migration | ${source.name}: renamed oncePerAttack to oncePerRoll`);
		}

		if (source.type === 'monsterFeature') {
			if (!this.#isDravok(parent) || !this.#changeSave(system, DEATH_RAY_SAVE)) return;
			console.log(`Nimble Migration | ${parent.name} > ${source.name}: corrected the save`);
			return;
		}

		const spec = this.#match(source);
		if (!spec) return;

		if (spec.rules && system.rules == null) system.rules = [];
		const rules = Array.isArray(system.rules) ? system.rules : null;

		const rulesAdded = !!spec.rules && !!rules && this.#addRules(rules, spec);
		const ruleChanged = !!rules && this.#changeRule(rules, spec);
		const notesRemoved = !!rules && this.#removeNotes(system, rules, spec);
		const saveChanged = !!spec.saveChange && this.#changeSave(system, spec.saveChange);

		if (!rulesAdded && !ruleChanged && !notesRemoved && !saveChanged) return;
		console.log(`Nimble Migration | ${source.name}: updated for check outcomes`);
	}

	/** The once-per-roll limit of a rule was named `oncePerAttack`. */
	#renameOncePerAttack(system: any): boolean {
		if (!Array.isArray(system.rules)) return false;
		let changed = false;
		for (const rule of system.rules as RuleSource[]) {
			if (!rule || typeof rule !== 'object' || !('oncePerAttack' in rule)) continue;
			rule.oncePerRoll ??= rule.oncePerAttack;
			delete rule.oncePerAttack;
			changed = true;
		}
		return changed;
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				(!spec.classIdentifier || spec.classIdentifier === source.system.class),
		);
	}

	#isDravok(actor: any): boolean {
		if (!actor) return false;
		const sourceId = toSnapshotId(this.getSourceId(actor));
		if (isCompendiumId(sourceId)) return sourceId === DRAVOK.sourceId;
		return (
			String(actor.name ?? '')
				.trim()
				.toLowerCase() === DRAVOK.name
		);
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const wantedRules = spec.rules ?? [];
		const packIds = new Set<unknown>([
			...(spec.shippedRuleIds ?? []),
			...wantedRules.map((rule) => rule.id),
		]);
		const packTypes = new Set(wantedRules.map((rule) => rule.type));
		const hasOwn = rules.some((rule) => packTypes.has(rule?.type) && !packIds.has(rule.id));
		if (hasOwn) return false;

		let changed = false;
		for (const wanted of wantedRules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	#changeRule(rules: RuleSource[], spec: PackItemSpec): boolean {
		if (!spec.ruleChange) return false;
		const { old, field, to } = spec.ruleChange;
		const rule = rules.find((candidate) => candidate?.id === old.id);
		if (!rule || !Object.entries(old).every(([key, value]) => deepEquals(rule[key], value))) {
			return false;
		}
		rule[field] = to;
		return true;
	}

	#removeNotes(system: any, rules: RuleSource[], spec: PackItemSpec): boolean {
		const effects = system.activation?.effects;
		if (!spec.retiredNotes || !Array.isArray(effects)) return false;

		const kept = effects.filter(
			(effect) =>
				!spec.retiredNotes?.some(
					(note) =>
						note.id === effect?.id &&
						note.text === effect?.text &&
						rules.some((rule) => rule?.id === note.ruleId),
				),
		);
		if (kept.length === effects.length) return false;
		system.activation.effects = kept;
		return true;
	}

	#changeSave(system: any, change: SaveChange): boolean {
		const node = findNode(system.activation?.effects, change.nodeId);
		if (node?.[change.field] !== change.from) return false;
		node[change.field] = change.to;
		return true;
	}
}

export { Migration074CheckOutcomes };
