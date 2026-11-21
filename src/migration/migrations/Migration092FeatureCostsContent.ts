import {
	isCompendiumId,
	SNAPSHOT_PREFIX,
	toInstalledId,
	toPackSourceId,
} from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type Json = Record<string, unknown>;

interface PackFeature {
	id: string;
	name: string;
	classIdentifier: string;
	/** Each changed field, by path, with the value the pack had before the change. */
	old: Record<string, unknown>;
}

const FEATURES = `${SNAPSHOT_PREFIX}nimble-class-features.Item.`;

const FIREBRAND_ID = 'k8CKWZXbSRAa0yO4';

/** The spell the Firebrand grant adds. */
const ENCHANT_WEAPON = `${SNAPSHOT_PREFIX}nimble-spells.Item.ZPGz8EiVxGobHTA0`;

const PACK_FEATURES: PackFeature[] = [
	{
		id: 'k8CKWZXbSRAa0yO4',
		name: 'firebrand',
		classIdentifier: 'commander',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'BTDicAEAllu2bkVj',
		name: 'archmage',
		classIdentifier: 'mage',
		old: {
			effects: [],
			'system.activation.effects': [],
			'system.rules': [],
		},
	},
	{
		id: 'l0Mia2jNotcVWVv7',
		name: 'spell shaper',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: '4o3t1gvfS7xZSotv',
		name: 'dimensional compression',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'GG1Y3gliH3DQ9UZS',
		name: 'echo casting',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'RwYoKWa0TQYzh7X1',
		name: 'elemental destruction',
		classIdentifier: 'mage',
		old: {
			'system.rules': [
				{
					type: 'reroll',
					disabled: false,
					id: 'elementalDestroy',
					identifier: '',
					label: 'Elemental Destruction',
					predicate: {},
					priority: 1,
					rolls: ['attack'],
					saves: [],
					skills: [],
					abilities: [],
					usedBy: 'roller',
					reach: 0,
					relatedStat: '',
					die: 'pickedDie',
					maxDice: '@will',
					perDie: true,
					keep: 'new',
					useAnotherStat: false,
					automatic: false,
					discardedCritTriggers: false,
					rollModeChange: 0,
					primaryDieBonus: 0,
					extraDamage: '',
					outcome: 'hit',
					attackDelivery: 'any',
					attackSource: 'spell',
					thisItemOnly: false,
					otherCreature: {},
					chargePoolIdentifier: '',
					chargeCost: 1,
					manaCost: 1,
					woundCost: 0,
					heroicReaction: '',
					actionCost: 0,
					actionReportOnly: false,
					oncePerTurn: false,
					oncePerRoll: true,
					cardHint: '',
					cardHintWhen: {},
				},
			],
		},
	},
	{
		id: 'bXbjMCnoGhSaJpE1',
		name: 'elemental transmutation',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'gFqa2eLUqBMSzXXL',
		name: 'extra-dimensional vision',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'NN0GDc6W6Ho3HeaM',
		name: 'methodical spellweaver',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'FZyrE1I92zoHBbuU',
		name: 'precise casting',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'dMwDq07sogyaZnBd',
		name: 'stretch time',
		classIdentifier: 'mage',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'LWMKXWTmnX3uHNol',
		name: 'zealot',
		classIdentifier: 'oathsworn',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'vrsiSOvF2Bdq6WcV',
		name: "cryomancer's reprisal",
		classIdentifier: 'shadowmancer',
		old: {
			effects: [],
			'system.rules': [],
		},
	},
	{
		id: 'qihi3i4aGFMlvg00',
		name: 'shadowfrost',
		classIdentifier: 'shadowmancer',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'DV7ZXRiXNA6VHEGw',
		name: 'enveloped by the master',
		classIdentifier: 'shadowmancer',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'bQW0Iy4BSeXNRD2x',
		name: 'beast of the pack',
		classIdentifier: 'stormshifter',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'zkVpSIg1YMBM8yWN',
		name: 'storm wake',
		classIdentifier: 'stormshifter',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'CM5up52Yg2TLDZKa',
		name: 'swiftshift',
		classIdentifier: 'stormshifter',
		old: {
			'system.activation.cost.details': '',
			'system.activation.cost.isReaction': false,
			'system.activation.cost.type': 'none',
			'system.rules': [],
		},
	},
	{
		id: 'xcmchy0Pn48UJoph',
		name: 'venomous gaze',
		classIdentifier: 'stormshifter',
		old: {
			'system.rules': [],
		},
	},
	{
		id: '8gTUauVQdm1Se1X6',
		name: 'master of storm',
		classIdentifier: 'stormshifter',
		old: {
			'system.rules': [
				{
					type: 'concentrationTrack',
					disabled: false,
					id: 'master-of-storm-concentration-tracks',
					identifier: '',
					label: 'Master of Storm: lightning and wind concentrate separately',
					predicate: {},
					priority: 1,
					schools: ['lightning', 'wind'],
				},
			],
		},
	},
];

const BY_ID = new Map(PACK_FEATURES.map((feature) => [feature.id, feature]));

function isRecord(value: unknown): value is Json {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** The value with its object keys in order, so two values compare by content. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical(value[key])]),
		);
	}
	return value;
}

function sameContent(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Gives a copy of a changed pack feature the new pack value of each changed field (rules, item
 * effects, activation steps and activation cost). The copy changes only when every changed field
 * still has the old pack value; a copy with a hand edit in one of them stays as it is.
 *
 * A copy is matched by its compendium id; a copy with no compendium id by its name and class.
 * A Firebrand owner with no Enchant Weapon gets the spell its new grant adds only at a level up.
 * A pack item that cannot be read throws, so the Migration Report lists the document.
 */
class Migration092FeatureCostsContent extends MigrationBase {
	static override readonly version = 92;

	override readonly version = Migration092FeatureCostsContent.version;

	override readonly title = 'Feature costs and options content';

	override readonly kind: MigrationKind = 'content';

	#packSources = new Map<string, Promise<Json>>();

	override async updateActor(source: any): Promise<void> {
		if (!isRecord(source) || !Array.isArray(source.items)) return;
		const items = source.items.filter(isRecord);
		const ownsFirebrand = items.some(
			(item) =>
				item.type === 'feature' && isRecord(item.system) && this.#match(item)?.id === FIREBRAND_ID,
		);
		if (!ownsFirebrand || items.some((item) => this.#isEnchantWeapon(item))) return;

		const spell = await this.#packSource(ENCHANT_WEAPON);
		if (spell.type !== 'spell') return;
		const granted = foundry.utils.deepClone(spell);
		granted._id = foundry.utils.randomID();
		granted._stats = {
			...(isRecord(granted._stats) ? granted._stats : {}),
			compendiumSource: toInstalledId(ENCHANT_WEAPON),
		};
		source.items.push(granted);
		console.log(`Nimble Migration | ${source.name}: Enchant Weapon from Firebrand`);
	}

	#isEnchantWeapon(item: Json): boolean {
		if (toPackSourceId(this.getSourceId(item)) === ENCHANT_WEAPON) return true;
		if (item.type !== 'spell') return false;
		const identifier = isRecord(item.system) ? item.system.identifier : '';
		const name = typeof item.name === 'string' ? item.name.trim().toLowerCase() : '';
		return identifier === 'enchant-weapon' || name === 'enchant weapon';
	}

	override async updateItem(source: any): Promise<void> {
		if (!isRecord(source) || source.type !== 'feature' || !isRecord(source.system)) return;
		const feature = this.#match(source);
		if (!feature) return;
		const paths = Object.keys(feature.old);
		const stillOld = (path: string) =>
			sameContent(foundry.utils.getProperty(source, path), feature.old[path]);
		if (!paths.every(stillOld)) return;

		const pack = await this.#packSource(`${FEATURES}${feature.id}`);
		if (pack.type !== source.type) return;
		const values = paths.map((path) => foundry.utils.getProperty(pack, path));
		if (values.some((value) => value === undefined)) return;
		paths.forEach((path, index) => {
			foundry.utils.setProperty(source, path, foundry.utils.deepClone(values[index]));
		});
		console.log(`Nimble Migration | ${source.name}: new pack ${paths.join(', ')}`);
	}

	#match(source: Json): PackFeature | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) {
			return sourceId?.startsWith(FEATURES)
				? BY_ID.get(sourceId.slice(FEATURES.length))
				: undefined;
		}
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const classIdentifier = (source.system as Json).class;
		return PACK_FEATURES.find(
			(feature) => feature.name === name && feature.classIdentifier === classIdentifier,
		);
	}

	/** The pack item's data. Throws when it cannot be read. */
	#packSource(uuid: string): Promise<Json> {
		let found = this.#packSources.get(uuid);
		if (!found) {
			found = (async () => {
				const doc = (await fromUuid(toInstalledId(uuid) as never)) as {
					toObject?: () => unknown;
				} | null;
				const data = typeof doc?.toObject === 'function' ? doc.toObject() : null;
				if (!isRecord(data)) throw new Error(`092 could not read ${uuid}`);
				return data;
			})();
			this.#packSources.set(uuid, found);
		}
		return found;
	}
}

export { Migration092FeatureCostsContent };
