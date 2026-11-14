import {
	isCompendiumId,
	SNAPSHOT_PREFIX,
	toInstalledId,
	toPackSourceId,
} from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type Json = Record<string, unknown>;

interface PackItem {
	id: string;
	name: string;
	type: string;
}

interface PackActor {
	id: string;
	name: string;
	items: PackItem[];
}

interface SelfNodes extends PackItem {
	nodeIds: string[];
}

interface LiveEffect {
	id: string | null;
	statuses?: Iterable<string>;
	system?: { rules?: unknown };
}

interface LiveItem {
	id: string | null;
	name?: string;
	type?: string;
	_stats?: unknown;
	flags?: unknown;
	effects?: Iterable<{ id: string | null; transfer?: boolean }>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[], options: object): Promise<unknown>;
}

interface EffectHolder {
	uuid?: string | null;
	name?: string;
	_stats?: unknown;
	flags?: unknown;
	items?: Iterable<LiveItem>;
	effects?: Iterable<LiveEffect>;
	updateEmbeddedDocuments(
		type: 'ActiveEffect',
		updates: object[],
		options: object,
	): Promise<unknown>;
}

/** The Apply Effect nodes that go to the user, not to the targets. */
const SELF_NODES: SelfNodes[] = [
	{ id: '3I0ZyYA1IphjlLOO', name: 'Alacrity', type: 'spell', nodeIds: ['9490msZtn2ek0CHQ'] },
	{
		id: 'e0gtFwx7E4LpFUUs',
		name: "I'm Outta Here!",
		type: 'feature',
		nodeIds: ['r0SdddFiFFB0FHbH'],
	},
	{
		id: '4GgSy03jxaOj56oY',
		name: 'Amidst All This Commotion',
		type: 'feature',
		nodeIds: ['bNmwqFNEEda9aqJT'],
	},
	{ id: 'KoXl36kUXwhsa87p', name: 'Escape Plan', type: 'feature', nodeIds: ['5eSopLu5pAtjC1eH'] },
	{
		id: 'eX8CJssX3F2vqFi1',
		name: 'Lesser Windform',
		type: 'spell',
		nodeIds: ['zZYtdX6Z0KjLKpK3', 'z7U64ITrBXdEXOo5'],
	},
	{
		id: '21OMcsYYwn5C7CLR',
		name: 'Greater Windform',
		type: 'spell',
		nodeIds: ['z7U64ITrBXdEXOo5'],
	},
	{ id: 'r434oYTu9Y2MoMXg', name: 'Zap', type: 'spell', nodeIds: ['b4uLkFLDWt2uKTUP'] },
	{ id: 'pLUyI3NQBJ6FV1mq', name: 'Arc Lightning', type: 'spell', nodeIds: ['jQIcokXHNNnWh5vd'] },
];

/** A copy of `CONFIG.NIMBLE.conditionRules` as it was when this migration was written. */
const STATUS_RULES: Record<string, Json[]> = {
	concentration: [
		{
			id: 'concentrationSave',
			type: 'saveOnEvent',
			event: 'critReceived',
			saveType: 'strength',
			saveDC: '10',
		},
	],
	swallowed: [
		{
			id: 'swallowedDamage',
			type: 'turnDamage',
			at: 'turnStart',
			who: 'holder',
			reach: 1,
			formula: '20',
			damageType: '',
			wounds: 0,
		},
	],
};

/** The pack items whose activation, rules, scaling or item effects changed for timed effects, by pack. */
const PACK_ITEMS: Record<string, PackItem[]> = {
	'nimble-boons': [{ id: 'QdL25uJIZYoMUPJs', name: 'Unflinching', type: 'boon' }],
	'nimble-class-features': [
		{ id: 'uvP5qvxMonL4ZOw2', name: 'Taunting Strike', type: 'feature' },
		{ id: 'cVeLhWCWwgHOhWn8', name: 'Borne Upon the Wind', type: 'feature' },
		{ id: 'jvphGUvKuj3AyZJ8', name: 'Crystalline Armor', type: 'feature' },
		{ id: 'yQCt2lFzah1OcAng', name: 'Glimmering Decree', type: 'feature' },
		{ id: 'tBBwkxBjmHarCgPU', name: 'Withering Strike', type: 'feature' },
		{ id: 'iNq4GHvFeLz45fl1', name: 'Face Me!', type: 'feature' },
		{ id: 'x9VscDoB05eIwoL0', name: 'Move it! Move it!', type: 'feature' },
		{ id: 'iDYdYYMzgculnANa', name: "Hunter's Mark", type: 'feature' },
		{ id: 'krKkYldIiY2pnLVe', name: 'Apex Predator', type: 'feature' },
		{ id: 'hnMDDmfEhSrI5vDz', name: 'Primal Predator', type: 'feature' },
		{ id: 'cVCXTSAnBBFSmVnS', name: 'Come Get Some!', type: 'feature' },
		{ id: '4xJDeF5FpN828c4N', name: 'Hail of Arrows', type: 'feature' },
		{ id: 'b1ONYT54cxhN5G0T', name: 'Pinning Shot', type: 'feature' },
		{ id: 'rt2O6NhLTipHYDs0', name: 'Snare Trap', type: 'feature' },
		{ id: '1fgREjbwEJkpcJMs', name: 'Face Me, Foul Creature!', type: 'feature' },
		{ id: 'AXTdfgvqYVsGwpVS', name: 'Blinding Aura', type: 'feature' },
		{ id: 'Wu73NvD9E7YKqAGG', name: 'One with Shadows', type: 'feature' },
		{ id: 'bzuYkv6C3G5thfC0', name: 'Glacial Resilience', type: 'feature' },
		{ id: 'oGxqGWjCnjmf0mLw', name: 'Assist Me, My Friend!', type: 'feature' },
		{ id: 'NIoQPFIuwn11R3qG', name: 'Illuminate Soul', type: 'feature' },
		{ id: 'u495mBotHkjWrgXB', name: 'Rhapsody of the Normal', type: 'feature' },
		{ id: '5mrzrxva3pgBMguc', name: 'Song of Domination', type: 'feature' },
		{ id: 'tW3RuzQKPncYXwqh', name: 'Fight Picker', type: 'feature' },
		{ id: 'qFGSdrw0ZItRK00x', name: 'Beast of Nightmares', type: 'feature' },
		{ id: 'lerWY2A6JkebdDFf', name: 'Beastshift', type: 'feature' },
		{ id: 'bjcXn5Lgr6FNoyuR', name: 'Primordial Force', type: 'feature' },
		{ id: 'KoXl36kUXwhsa87p', name: 'Escape Plan', type: 'feature' },
		{ id: 'b2rb39bzuYTi3kj6', name: 'Low Blow', type: 'feature' },
		{ id: '4GgSy03jxaOj56oY', name: 'Amidst All This Commotion', type: 'feature' },
		{ id: 'e0gtFwx7E4LpFUUs', name: "I'm Outta Here!", type: 'feature' },
		{ id: 'TrR4gkjE1SStGF4G', name: 'Sunder Armor (Medium)', type: 'feature' },
	],
	'nimble-magic-items': [
		{ id: 'tegF7lnwbUYVImL7', name: 'Resolute Fangs, Golden Bastion', type: 'object' },
		{ id: 'wav5q8mcXBFyNvD6', name: 'Manglemaul', type: 'object' },
	],
	'nimble-secret-spells': [
		{ id: 'gDg4NlUQHWqbu9tV', name: 'Cryotomb', type: 'spell' },
		{ id: 'PeLuUpKawDLOPHhv', name: 'Memory Veil', type: 'spell' },
		{ id: '21OMcsYYwn5C7CLR', name: 'Greater Windform', type: 'spell' },
		{ id: 'eX8CJssX3F2vqFi1', name: 'Lesser Windform', type: 'spell' },
	],
	'nimble-spells': [
		{ id: 'Iz0S3otichUrGSfH', name: 'Dragonform', type: 'spell' },
		{ id: 'ZPGz8EiVxGobHTA0', name: 'Enchant Weapon', type: 'spell' },
		{ id: 'Ue4K4FcSM43UiwvO', name: 'Fiery Embrace', type: 'spell' },
		{ id: 'QHRQ64MP6g21jB6D', name: 'Flame Barrier', type: 'spell' },
		{ id: '1JKFzgOBWjaF9jKz', name: 'Living Inferno', type: 'spell' },
		{ id: 'VLIazApgexmgcL6o', name: 'Arctic Annihilation', type: 'spell' },
		{ id: 'ndZMXifo0h3H4lUU', name: 'Arctic Blast', type: 'spell' },
		{ id: 'IXTKhehuF0IH2Zr6', name: 'Cryosleep', type: 'spell' },
		{ id: 'ISzKsGL3SwlppROJ', name: 'Frost Shield', type: 'spell' },
		{ id: 'NtKDIbOngvctYnv6', name: 'Snowblind', type: 'spell' },
		{ id: 'pLUyI3NQBJ6FV1mq', name: 'Arc Lightning', type: 'spell' },
		{ id: 'MwkUXnY5tySoeSgz', name: 'Electrocharge', type: 'spell' },
		{ id: 'OXPmekuZjcR10E7i', name: 'Ride the Lightning', type: 'spell' },
		{ id: '96VXY2ogu8nW39GI', name: 'Seething Storm', type: 'spell' },
		{ id: 'r434oYTu9Y2MoMXg', name: 'Zap', type: 'spell' },
		{ id: 'mdPEulO0vYNyuGIx', name: 'Dread Visage', type: 'spell' },
		{ id: 'aoCnJhoJji5s5Etf', name: 'Shadow Trap', type: 'spell' },
		{ id: 'ntXSUrRq4vttsbYj', name: 'Withering Touch', type: 'spell' },
		{ id: 'iL26UVOBVgarmeFH', name: 'Warding Bond', type: 'spell' },
		{ id: 'TFGQ4Ulp8JoT4HpL', name: 'Barrier of Wind', type: 'spell' },
		{ id: 'VUAcS7huPbffPGMk', name: 'Boisterous Winds', type: 'spell' },
		{ id: 'DHEl4NDcNMu2ZAj0', name: 'Fly', type: 'spell' },
		{ id: 'kTJSEElZSzeOMXBO', name: 'Vicious Mockery', type: 'spell' },
	],
};

const PACK_ACTORS: Record<string, PackActor[]> = {
	'nimble-legendary-monsters': [
		{
			id: 'ZtvN9z6ZEolYZu1R',
			name: 'Azriel, Lord of Pain & Flame',
			items: [{ id: 'YjDDY4UdbPtstgDS', name: 'Crackling Whip.', type: 'monsterFeature' }],
		},
		{
			id: '7n4NFalMBVr8hKaP',
			name: 'Dravok, All-Seeing Tyrant',
			items: [
				{ id: 'ZPpqxHjuuxnqWUIc', name: 'Weakness', type: 'monsterFeature' },
				{ id: 'En4fdOj40xF7Q1mj', name: '2. Petrification Ray', type: 'monsterFeature' },
				{ id: 'x3uAQ8Y4Pog85I7f', name: '3. Terror Ray', type: 'monsterFeature' },
			],
		},
		{
			id: '91He6bIh0M7nRt2C',
			name: 'Florindris, Bane of the Forest',
			items: [{ id: '0f4hLLO0J9QHAWwI', name: 'Wither', type: 'monsterFeature' }],
		},
		{
			id: 'HIXIhUIG7S9vyF1B',
			name: 'Greenthumb, Lichling',
			items: [{ id: 'greenRootAction01', name: 'Root.', type: 'monsterFeature' }],
		},
		{
			id: 'UqXZgpT99YjVCVQj',
			name: 'Grimbeak, the Unyielding',
			items: [{ id: 'RJV5MKgumWqo5XIY', name: 'Savage Screech. (1 use)', type: 'monsterFeature' }],
		},
		{
			id: '4CLKneQXGJuCNoP7',
			name: 'Krogg, Goblin King',
			items: [{ id: 'kroggManglemaul', name: 'Manglemaul.', type: 'monsterFeature' }],
		},
		{
			id: 'tPiWzclr1ZSkyTAP',
			name: 'Lind Worm',
			items: [
				{ id: 'lindConstrict0001', name: 'Constrict.', type: 'monsterFeature' },
				{ id: 'lindSqueezeAcid1', name: 'Squeeze & Spit Acid.', type: 'monsterFeature' },
			],
		},
		{
			id: 'nHmhDIozM5iowqpT',
			name: 'Nalzar, Apex Predator',
			items: [
				{ id: 'WGWffq4kSNprRmwC', name: 'Tail Swipe.', type: 'monsterFeature' },
				{ id: 'engJrYwHNhUUoJ0h', name: 'Wing Buffet.', type: 'monsterFeature' },
			],
		},
		{
			id: 'tIt1UdE6d6jmughV',
			name: 'Poppy, Giant Stinkbug',
			items: [{ id: 'RUli8XgIZ3bynF7T', name: 'Stink Cloud.', type: 'monsterFeature' }],
		},
		{
			id: 'nAew89tkjzZNnnac',
			name: 'Pudge the Blunderer',
			items: [{ id: 'Egw0SfukBFY6ug6C', name: 'Move & Smack.', type: 'monsterFeature' }],
		},
		{
			id: 'm5BJajp8f7TGj3QU',
			name: 'Queen Aranya, Broodmother',
			items: [{ id: 'utgiuJ6UuR1fOOR0', name: 'Weave Web.', type: 'monsterFeature' }],
		},
		{
			id: 'zaM78FA829bAaDmR',
			name: 'Scorpion Queen',
			items: [{ id: 'scorpClaw0000001', name: 'Claw.', type: 'monsterFeature' }],
		},
		{
			id: 'lgul04YrKU0RjG0F',
			name: 'Thorn Quickblade',
			items: [
				{ id: '35HP1npCJHxMtbS1', name: 'Heart Piercer (Rapier).', type: 'monsterFeature' },
				{ id: '12a7c65e-fcbb-4040-8cc1-85b048e37714', name: 'Bloodied', type: 'monsterFeature' },
			],
		},
		{
			id: '9HMbDYuZ4iJusIrj',
			name: 'Titan of the Deep Woods',
			items: [{ id: 'ekNtNgYbJXn9Lv7b', name: 'Crushing Stomp.', type: 'monsterFeature' }],
		},
		{
			id: 'WnnjaFQVSMGeqIIT',
			name: "Ul'vek, Psionic Despot",
			items: [{ id: 'ahBtNfFFrLm9hITw', name: 'Consume.', type: 'monsterFeature' }],
		},
	],
	'nimble-monsters': [
		{
			id: '9WKy1tqSaiffgo3r',
			name: 'Bandit Assassin',
			items: [{ id: 'Juc4sTI1xRFF5fMD', name: 'Sneak.', type: 'monsterFeature' }],
		},
		{
			id: 'Ar9aCw1NbCbFC11U',
			name: 'Briarbane Acidpod',
			items: [{ id: 'h0qvQ7hA6kTuBPDI', name: 'Grab.', type: 'monsterFeature' }],
		},
		{
			id: 'zUR4X7UV37zHrDF2',
			name: 'Briarbane Tangler',
			items: [{ id: 'xagsCn01Ajm8lQ7S', name: 'Tangle (2×).', type: 'monsterFeature' }],
		},
		{
			id: 'lDTJWdkMFVOOQVwc',
			name: 'Briarbane Treant',
			items: [{ id: 'GHBtSPT1dK9s7nQ4', name: 'Slam.', type: 'monsterFeature' }],
		},
		{
			id: '2WAfywOh2jWhIlVy',
			name: 'Giant Venus Flytrap',
			items: [{ id: 'flytrapTangle001', name: 'Tangle (2x).', type: 'monsterFeature' }],
		},
		{
			id: 'YjKhjwiYoNrrhXfo',
			name: 'Cultist',
			items: [{ id: '2unpi58GaSgsT7x9', name: 'Fanatical Zeal.', type: 'monsterFeature' }],
		},
		{
			id: 'WJikH84pVBBYkwh0',
			name: 'Fanatic',
			items: [
				{ id: 'lZblcRbKy8gp6Bjf', name: 'Fanatical Zeal.', type: 'monsterFeature' },
				{ id: 'hiGWXOMmLSUL84RY', name: 'Whispers of Madness.', type: 'monsterFeature' },
			],
		},
		{
			id: 'vrqkmCllLRNFP3wk',
			name: 'Basilisk',
			items: [{ id: 'TWonhyB7gWas4zsh', name: 'Stone Gaze.', type: 'monsterFeature' }],
		},
		{
			id: 'WJ24grmX4bHyHcHc',
			name: 'Druid',
			items: [{ id: '79PyImNg7bNW6XFp', name: 'Beastshift.', type: 'monsterFeature' }],
		},
		{
			id: 'cQ2wucZ7mz1wXSRR',
			name: 'Duskprowler',
			items: [{ id: '2pr9fr6WZQbYRsk6', name: 'Illusory Aura.', type: 'monsterFeature' }],
		},
		{
			id: 'w464OFhPTQGwLFZp',
			name: 'Bulette',
			items: [
				{ id: 'RGJHZfPYg3wJm6Jm', name: 'Burst Forth!', type: 'monsterFeature' },
				{ id: 'oS2F3rcfuaVeHyHm', name: 'Leap & Bite.', type: 'monsterFeature' },
			],
		},
		{
			id: '7MDFdUO1qqBTbTsv',
			name: 'Griffon',
			items: [{ id: '9logES0uHQsgufv3', name: 'Talons.', type: 'monsterFeature' }],
		},
		{
			id: 'GyeeUOjzK5XBnBzl',
			name: 'Roc',
			items: [{ id: 'L1b44vWpUyZjAmhV', name: 'Pluck Up.', type: 'monsterFeature' }],
		},
		{
			id: 'CnjRxzi5UaRzrObt',
			name: 'Worg',
			items: [{ id: 'JcCc6HxV4C4k5jR5', name: 'Rip Apart (2×).', type: 'monsterFeature' }],
		},
		{
			id: 'nopp2DKrd9uK67B7',
			name: 'Glabrezu',
			items: [{ id: 'faCrvNI9LXhe7JFR', name: 'Doomclaw (2×).', type: 'monsterFeature' }],
		},
		{
			id: 'cr1zy94gxZjzh86o',
			name: 'Spiny Fiend',
			items: [{ id: 'zlJvsbtiOUgpIsl6', name: 'Spines.', type: 'monsterFeature' }],
		},
		{
			id: 'Di9DjWDN5qAm65sa',
			name: 'Kobold Trapper',
			items: [{ id: '32UcKER1GRaKPLcD', name: '[Trap] - HIDDEN NET!', type: 'monsterFeature' }],
		},
		{
			id: 'O4ATcECWPMYFbvbh',
			name: 'Medium Mimic',
			items: [{ id: 'GioUoGGdddQJJuC2', name: 'Pseudopod.', type: 'monsterFeature' }],
		},
		{
			id: 'f80SumsdADQlLRtY',
			name: 'Small Mimic',
			items: [{ id: 'bBQb7DA9kZJqF818', name: 'Pseudopod.', type: 'monsterFeature' }],
		},
		{
			id: 'S99BhlhkUDfuJrdj',
			name: 'Tiny Mimic',
			items: [{ id: '23FHpmDUgXKOMS5J', name: 'Pseudopod.', type: 'monsterFeature' }],
		},
		{
			id: 'WxQmp9B4w0OgYVm6',
			name: 'Gray Ooze',
			items: [{ id: 'wgRj9GjR4DMp4mQx', name: 'Acidic Touch (2×).', type: 'monsterFeature' }],
		},
		{
			id: 'BSiFuESoO19XNaBx',
			name: 'Cobra Captain',
			items: [{ id: 'uOG7P8qgm3DeZ8U6', name: 'Slash (2×).', type: 'monsterFeature' }],
		},
		{
			id: 'zZV7n6ewIvucTxpD',
			name: 'Giant Cobra',
			items: [{ id: 'Fh17GpWpLrxaPugM', name: 'Crush.', type: 'monsterFeature' }],
		},
		{
			id: 'vSrolkz0JjAqA1fw',
			name: 'Snakeman Minion',
			items: [{ id: 'hUxZRnXtiZ5dHmnE', name: 'Strike.', type: 'monsterFeature' }],
		},
		{
			id: '1z0344rf5edBa077',
			name: 'Snakeman',
			items: [{ id: 'iU1BAlui58lpH31U', name: 'Slash.', type: 'monsterFeature' }],
		},
		{
			id: 'uM5wkCvyEpfQ7DPU',
			name: 'Zombie',
			items: [{ id: 'wgiL9nmnsFME5ufI', name: 'Crunch.', type: 'monsterFeature' }],
		},
		{
			id: 'iee2AYLgQjRieoEI',
			name: 'Cloaker',
			items: [{ id: 'TRT44zWDEobdx3S9', name: 'Wrap.', type: 'monsterFeature' }],
		},
		{
			id: 'R24pjE8ntXNVd1Ah',
			name: 'Ettercap',
			items: [{ id: '5LBNwGAHn4Jw3c6U', name: 'Web Garrote.', type: 'monsterFeature' }],
		},
		{
			id: 'ML3WomiwkHKUfTnO',
			name: 'Giant Spider',
			items: [{ id: 'XYLGTfOSJIhnEFg6', name: 'Shoot Web.', type: 'monsterFeature' }],
		},
		{
			id: 'zDKPmCy5DbGdkJLU',
			name: 'Nestweaver',
			items: [{ id: 'j7fwFMyGdcMkc9nc', name: 'Shoot Web.', type: 'monsterFeature' }],
		},
		{
			id: 'UqUuKtAWlOrDkAFy',
			name: 'Umber Hulk',
			items: [{ id: 'RUZcSKNDMBOvWLXq', name: 'Confounding Pheromones.', type: 'monsterFeature' }],
		},
		{
			id: '7f3ZENlslRDMVcEf',
			name: 'Wax Golem',
			items: [{ id: 'waxGripAction001', name: 'Wax Grip.', type: 'monsterFeature' }],
		},
	],
};

const ITEM_PATTERN = /^Compendium\.nimble\.[^.]+\.Item\.([^.]+)$/;
const ACTOR_ITEM_PATTERN = /^Compendium\.nimble\.[^.]+\.Actor\.([^.]+)\.Item\.([^.]+)$/;
const ACTOR_PATTERN = /^Compendium\.nimble\.[^.]+\.Actor\.([^.]+)$/;

function nameKey(...parts: unknown[]): string {
	return parts.map((part) => (typeof part === 'string' ? part.trim().toLowerCase() : '')).join('|');
}

const ITEM_BY_ID = new Map<string, string>();
const ITEM_BY_NAME = new Map<string, string>();
for (const [pack, items] of Object.entries(PACK_ITEMS)) {
	for (const item of items) {
		const uuid = `${SNAPSHOT_PREFIX}${pack}.Item.${item.id}`;
		ITEM_BY_ID.set(item.id, uuid);
		ITEM_BY_NAME.set(nameKey(item.name, item.type), uuid);
	}
}

const ACTOR_ITEMS = new Map<string, Map<string, string>>();
const ACTOR_ITEM_BY_NAME = new Map<string, string>();
for (const [pack, actors] of Object.entries(PACK_ACTORS)) {
	for (const actor of actors) {
		const items = new Map<string, string>();
		for (const item of actor.items) {
			const uuid = `${SNAPSHOT_PREFIX}${pack}.Actor.${actor.id}.Item.${item.id}`;
			items.set(item.id, uuid);
			ACTOR_ITEM_BY_NAME.set(nameKey(actor.name, item.name, item.type), uuid);
		}
		ACTOR_ITEMS.set(actor.id, items);
	}
}

function isRecord(value: unknown): value is Json {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Every node of an activation tree, also the nodes in the branches of a node. */
function eachNode(tree: unknown, visit: (node: Json) => void): void {
	if (Array.isArray(tree)) {
		for (const entry of tree) eachNode(entry, visit);
		return;
	}
	if (!isRecord(tree)) return;
	if (typeof tree.type === 'string') visit(tree);
	for (const value of Object.values(tree)) {
		if (value && typeof value === 'object') eachNode(value, visit);
	}
}

function activationOf(source: Json): Json | undefined {
	const activation = (source.system as Json | undefined)?.activation;
	return isRecord(activation) ? activation : undefined;
}

/** The item sheet wrote the Activation Duration number to `duration.cost.quantity`. */
function moveDurationNumber(source: Json): void {
	const duration = activationOf(source)?.duration;
	if (!isRecord(duration) || !isRecord(duration.cost)) return;
	const quantity = duration.cost.quantity;
	if (typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1) {
		duration.quantity = quantity;
	}
	duration.cost = new foundry.data.operators.ForcedDeletion();
}

/** The card read `saveType` first, so it becomes the node's `savingThrowType`. */
function foldSaveTypes(source: Json): void {
	eachNode(activationOf(source)?.effects, (node) => {
		if (node.type !== 'savingThrow' || !('saveType' in node)) return;
		if (typeof node.saveType === 'string' && node.saveType !== '') {
			node.savingThrowType = node.saveType;
		}
		delete node.saveType;
	});
}

function storedPackUuid(sourceId: string | undefined): string | undefined {
	const id = toPackSourceId(sourceId);
	if (!id) return undefined;
	const item = ITEM_PATTERN.exec(id);
	if (item) return ITEM_BY_ID.get(item[1]);
	const actorItem = ACTOR_ITEM_PATTERN.exec(id);
	if (actorItem) return ACTOR_ITEMS.get(actorItem[1])?.get(actorItem[2]);
	return undefined;
}

function refreshedRules(packRules: unknown, copyRules: unknown, equipped: boolean | null): Json[] {
	const disabled = new Map<unknown, boolean>();
	for (const rule of Array.isArray(copyRules) ? copyRules : []) {
		if (isRecord(rule) && typeof rule.disabled === 'boolean') disabled.set(rule.id, rule.disabled);
	}
	return (Array.isArray(packRules) ? packRules : []).filter(isRecord).map((packRule) => {
		const rule = foundry.utils.deepClone(packRule);
		if (equipped !== null) rule.disabled = !equipped;
		else if (disabled.has(rule.id)) rule.disabled = disabled.get(rule.id);
		return rule;
	});
}

function refreshedEffects(packEffects: unknown, copyEffects: unknown): Json[] {
	const kept = (Array.isArray(copyEffects) ? copyEffects : []).filter(
		(effect): effect is Json => isRecord(effect) && effect.transfer !== false,
	);
	const keptIds = new Set(kept.map((effect) => effect._id));
	const fromPack = (Array.isArray(packEffects) ? packEffects : []).filter(
		(effect): effect is Json =>
			isRecord(effect) && effect.transfer === false && !keptIds.has(effect._id),
	);
	return [...kept, ...fromPack.map((effect) => foundry.utils.deepClone(effect))];
}

function hasStatus(effect: LiveEffect, status: string): boolean {
	for (const entry of effect.statuses ?? []) if (entry === status) return true;
	return false;
}

/** Adds the status rules of `concentration` and `swallowed` that an effect does not have. */
async function addStatusRules(holder: EffectHolder): Promise<void> {
	const updates: object[] = [];
	for (const effect of holder.effects ?? []) {
		const rules = effect.system?.rules;
		if (!effect.id || !Array.isArray(rules)) continue;
		const ids = new Set(rules.map((rule) => (isRecord(rule) ? rule.id : undefined)));
		const missing = Object.entries(STATUS_RULES)
			.filter(([status]) => hasStatus(effect, status))
			.flatMap(([, statusRules]) => statusRules)
			.filter((rule) => !ids.has(rule.id));
		if (missing.length === 0) continue;
		updates.push({
			_id: effect.id,
			'system.rules': [...rules, ...missing.map((rule) => foundry.utils.deepClone(rule))],
		});
	}
	if (updates.length === 0) return;
	try {
		await holder.updateEmbeddedDocuments('ActiveEffect', updates, { noHook: true });
	} catch (error) {
		console.error(`Nimble Migration | 089 failed for ${holder.uuid ?? 'an actor'}:`, error);
	}
}

/**
 * Brings world copies up to the timed effects pack content. The Activation Duration number moves to its
 * field; nine Apply Effect steps go to the user; the changed pack items copy their activation,
 * rules, upcast scaling and `transfer: false` effects from the pack (a copy keeps its
 * `transfer: true` effects, its flags with its pool values, and the on and off state of its
 * rules); the live Concentrating and Swallowed effects get their status rules; and a save step's
 * `saveType` becomes its `savingThrowType`.
 *
 * A copy is matched by its compendium id; an item of a pack actor by the actor's compendium id
 * and the item id; a copy with no compendium id by name and type (and the actor's name). A copy
 * whose pack document is not found does not change.
 */
class Migration089TimedEffectsContent extends MigrationBase {
	static override readonly version = 89;

	override readonly version = Migration089TimedEffectsContent.version;

	#packSources = new Map<string, Promise<Json | null>>();

	override async updateItem(source: any, parent?: any): Promise<void> {
		if (!isRecord(source) || !isRecord(source.system)) return;
		moveDurationNumber(source);
		this.#setSelfRecipients(source);
		await this.#refresh(source, parent);
		foldSaveTypes(source);
	}

	override async migrate(): Promise<void> {
		const holders: EffectHolder[] = [...(game.actors ?? [])] as unknown as EffectHolder[];
		for (const scene of game.scenes ?? []) {
			for (const token of scene.tokens) {
				if (token.actorLink || !token.actor) continue;
				holders.push(token.actor as unknown as EffectHolder);
			}
		}
		for (const holder of holders) {
			await addStatusRules(holder);
			await this.#deleteOrphanEffects(holder);
		}
	}

	/**
	 * The runner writes an actor's items with their effects, but deletes no effect of them. A
	 * `transfer: false` effect that the pack item does not have goes here.
	 */
	async #deleteOrphanEffects(actor: EffectHolder): Promise<void> {
		const parent = { name: actor.name, _stats: actor._stats, flags: actor.flags };
		for (const item of actor.items ?? []) {
			const source = {
				_id: item.id,
				name: item.name,
				type: item.type,
				_stats: item._stats,
				flags: item.flags,
			};
			const uuid = this.#packUuid(source, parent);
			if (!uuid) continue;
			const pack = await this.#packSource(uuid);
			if (!pack || pack.type !== item.type) continue;
			const packIds = new Set(
				(Array.isArray(pack.effects) ? pack.effects : []).map((effect) =>
					isRecord(effect) ? effect._id : undefined,
				),
			);
			const orphans = [...(item.effects ?? [])]
				.filter((effect) => effect.transfer === false && !!effect.id && !packIds.has(effect.id))
				.map((effect) => effect.id as string);
			if (orphans.length === 0) continue;
			try {
				await item.deleteEmbeddedDocuments('ActiveEffect', orphans, { noHook: true });
			} catch (error) {
				console.error(`Nimble Migration | 089 failed for ${actor.uuid ?? 'an actor'}:`, error);
			}
		}
	}

	#setSelfRecipients(source: Json): void {
		const sourceId = this.getSourceId(source);
		const documentId = ITEM_PATTERN.exec(toPackSourceId(sourceId) ?? '')?.[1];
		const spec = documentId
			? SELF_NODES.find((entry) => entry.id === documentId)
			: isCompendiumId(sourceId)
				? undefined
				: SELF_NODES.find(
						(entry) => nameKey(entry.name, entry.type) === nameKey(source.name, source.type),
					);
		if (!spec) return;
		const nodeIds = new Set(spec.nodeIds);
		eachNode(activationOf(source)?.effects, (node) => {
			if (typeof node.id === 'string' && nodeIds.has(node.id)) node.recipient = 'self';
		});
	}

	#packUuid(source: Json, parent: unknown): string | undefined {
		const sourceId = this.getSourceId(source);
		if (isCompendiumId(sourceId)) return storedPackUuid(sourceId);

		const parentId = isRecord(parent) ? this.getSourceId(parent) : undefined;
		const actorId = ACTOR_PATTERN.exec(toPackSourceId(parentId) ?? '')?.[1];
		const actorItems = actorId ? ACTOR_ITEMS.get(actorId) : undefined;
		if (actorItems) return actorItems.get(source._id as string);

		const byName = ITEM_BY_NAME.get(nameKey(source.name, source.type));
		if (byName || !isRecord(parent) || isCompendiumId(parentId)) return byName;
		return ACTOR_ITEM_BY_NAME.get(nameKey(parent.name, source.name, source.type));
	}

	#packSource(uuid: string): Promise<Json | null> {
		let found = this.#packSources.get(uuid);
		if (!found) {
			found = (async () => {
				try {
					const doc = (await fromUuid(toInstalledId(uuid) as never)) as {
						toObject?: () => unknown;
					} | null;
					const data = typeof doc?.toObject === 'function' ? doc.toObject() : null;
					return isRecord(data) ? data : null;
				} catch (error) {
					console.warn(`Nimble Migration | 089 could not read ${uuid}:`, error);
					return null;
				}
			})();
			this.#packSources.set(uuid, found);
		}
		return found;
	}

	/** Copies the activation, rules, upcast scaling and item effects of the pack item. */
	async #refresh(source: Json, parent: unknown): Promise<void> {
		const uuid = this.#packUuid(source, parent);
		if (!uuid) return;
		const pack = await this.#packSource(uuid);
		if (!pack || pack.type !== source.type || !isRecord(pack.system)) return;

		const system = source.system as Json;
		const equipped = source.type === 'object' && isRecord(parent) ? system.equipped === true : null;
		if ('activation' in pack.system) {
			system.activation = foundry.utils.deepClone(pack.system.activation);
		}
		system.rules = refreshedRules(pack.system.rules, system.rules, equipped);
		if (source.type === 'spell' && 'scaling' in pack.system) {
			system.scaling = foundry.utils.deepClone(pack.system.scaling);
		}
		source.effects = refreshedEffects(pack.effects, source.effects);
	}
}

export { Migration089TimedEffectsContent };
