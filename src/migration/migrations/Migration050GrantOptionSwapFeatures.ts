import { toInstalledId, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

interface SwapFeature {
	uuid: string;
	level: number;
	name: string;
	img: string;
	folder: string;
	group: string;
	description: string;
	ruleLabel: string;
}

/**
 * The feature each class prints that lets a character re-pick their class options, mirroring
 * the pack JSON. Kept in sync with `packs/classFeatures/core/<class>/<class>-progression/`.
 */
const SWAP_FEATURE_BY_CLASS: Record<string, SwapFeature> = {
	berserker: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.Y2yXfJQzDKP5s3QK',
		level: 4,
		name: 'Wrath & Ruin',
		img: 'icons/skills/melee/strike-hammer-destructive-orange.webp',
		folder: 'd40bf36abe9f4b0a',
		group: 'berserker-progression',
		description:
			'<p>Whenever you perform a notable act of destruction or feat of strength during a Safe Rest, you may choose different Berserker options available to you.</p>',
		ruleLabel:
			'Whenever you perform a notable act of destruction or feat of strength during a Safe Rest',
	},
	commander: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.WIB9jRGrfsvph4ol',
		level: 4,
		name: 'Rigorous Training',
		img: 'icons/environment/people/infantry.webp',
		folder: '406c4e162069a4a8',
		group: 'commander-progression',
		description:
			'<p>Whenever you train with your party or other soldiers during a Safe Rest, you may choose different Commander options available to you.</p>',
		ruleLabel: 'Whenever you train with your party or other soldiers during a Safe Rest',
	},
	hunter: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.LrfTLGu5EgYUPoct',
		level: 2,
		name: 'Remember the Wild',
		img: 'icons/magic/nature/wolf-paw-glow-green.webp',
		folder: '2e9e32bf9e74e633',
		group: 'hunter-progression',
		description:
			'<p>Whenever you spend a day in the wilderness during a Safe Rest, you may choose different Hunter options available to you.</p>',
		ruleLabel: 'Whenever you spend a day in the wilderness during a Safe Rest',
	},
	mage: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.LkYnPv2Q7YLcgWz0',
		level: 3,
		name: 'Study!',
		img: 'icons/sundries/books/book-open-purple.webp',
		folder: 'a95d9a582c294f7c',
		group: 'mage-progression',
		description:
			'<p>Whenever you study arcane books or are tutored by a higher level Mage during a Safe Rest, you may choose different Mage options available to you.</p>',
		ruleLabel:
			'Whenever you study arcane books or are tutored by a higher level Mage during a Safe Rest',
	},
	oathsworn: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.UdlGmLJfrBJnGeco',
		level: 3,
		name: 'Serve Selflessly',
		img: 'icons/magic/holy/prayer-hands-glowing-yellow.webp',
		folder: 'c5f324248b31dabc',
		group: 'oathsworn-progression',
		description:
			'<p>Whenever you perform a notable selfless act during a Safe Rest, you may choose different Oathsworn options available to you.</p>',
		ruleLabel: 'Whenever you perform a notable selfless act during a Safe Rest',
	},
	shadowmancer: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.P7THnH0G3rFkE1CM',
		level: 3,
		name: 'Supplicate',
		img: 'icons/magic/unholy/silhouette-robe-evil-glow.webp',
		folder: '81e685bc5c9127ce',
		group: 'shadowmancer-progression',
		description:
			'<p>Whenever you commune with your Patron on a Safe Rest, you may beg them to allow you to choose different Shadowmancer options (they may ask for something in return).</p>',
		ruleLabel: 'Whenever you commune with your Patron on a Safe Rest',
	},
	shepherd: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.bGXJKcENIlSwJ3jT',
		level: 5,
		name: 'Serve',
		img: 'icons/magic/life/heart-hand-gold-green-light.webp',
		folder: 'c1face1ec4d1249a',
		group: 'shepherd-progression',
		description:
			'<p>After spending a day tending to a sacred place or serving others during a Safe Rest, you may choose different Shepherd options available to you.</p>',
		ruleLabel:
			'After spending a day tending to a sacred place or serving others during a Safe Rest',
	},
	songweaver: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.1H6Nz6EQnaUhIYb4',
		level: 4,
		name: 'Perform!',
		img: 'icons/tools/instruments/lute-gold-brown.webp',
		folder: '910213b07f81138f',
		group: 'songweaver-progression',
		description:
			'<p>Whenever you perform in a place that inspires you, or exchange barbs with another competent wordsmith during a Safe Rest, you may choose different Songweaver options available to you.</p>',
		ruleLabel:
			'Whenever you perform in a place that inspires you, or exchange barbs with another competent wordsmith during a Safe Rest',
	},
	stormshifter: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.r2NhpyjKrjPFVVNB',
		level: 4,
		name: 'Be Wild',
		img: 'icons/creatures/mammals/deer-movement-leap-green.webp',
		folder: '0075e1e989d0552b',
		group: 'stormshifter-progression',
		description:
			'<p>Whenever you spend a day with wild animals during a Safe Rest, you may choose different Stormshifter options available to you.</p>',
		ruleLabel: 'Whenever you spend a day with wild animals during a Safe Rest',
	},
	'the-cheat': {
		uuid: 'Compendium.nimble.nimble-class-features.Item.d2Udf0bs96hhPI3t',
		level: 4,
		name: 'Trade Secrets',
		img: 'icons/sundries/gaming/playing-cards.webp',
		folder: '4915fea5a41fc733',
		group: 'the-cheat-progression',
		description:
			'<p>Whenever you spend a night talking shop with other roguish types during a Safe Rest, you may choose different Cheat options available to you.</p>',
		ruleLabel:
			'Whenever you spend a night talking shop with other roguish types during a Safe Rest',
	},
	zephyr: {
		uuid: 'Compendium.nimble.nimble-class-features.Item.WGjt3KNOMFWfRRzc',
		level: 4,
		name: 'Focus',
		img: 'icons/magic/holy/meditation-chi-focus-blue.webp',
		folder: 'a03073c1f33d5b34',
		group: 'zephyr-progression',
		description:
			'<p>Whenever you spend time meditating alone in a windy place during a Safe Rest, you may choose different Zephyr options available to you.</p>',
		ruleLabel: 'Whenever you spend time meditating alone in a windy place during a Safe Rest',
	},
};

/**
 * Grants the class option swap features to characters who are already past the level that
 * prints them.
 *
 * These features are new, and a class feature is only granted when a character levels through
 * the level that offers it. Without this every existing character would be at or past the
 * level and still never see the feature, so the whole mechanic would be unreachable except on
 * a character rolled up after the update.
 *
 * Nothing else about the character changes. The feature is not recorded in `levelUpHistory`,
 * because it was not granted by a level up and levelling down should not take it away.
 */
class Migration050GrantOptionSwapFeatures extends MigrationBase {
	static override readonly version = 50;

	override readonly version = Migration050GrantOptionSwapFeatures.version;

	override async updateActor(source: Record<string, unknown>): Promise<void> {
		if (source.type !== 'character') return;

		const items = source.items;
		if (!Array.isArray(items)) return;

		const classItem = items.find((item) => item?.type === 'class');
		const classSystem = classItem?.system as Record<string, unknown> | undefined;
		const identifier = classSystem?.identifier;
		if (typeof identifier !== 'string') return;

		const feature = SWAP_FEATURE_BY_CLASS[identifier];
		if (!feature) return;

		const classLevel = classSystem?.classLevel;
		if (typeof classLevel !== 'number' || classLevel < feature.level) return;

		const installedUuid = toInstalledId(feature.uuid);
		// Both sides are folded onto the snapshot namespace: an actor exported from the stable
		// install and imported into the dev one carries `Compendium.nimble.…` while the running
		// install writes `Compendium.nimble-dev.…`, and comparing raw would grant a second copy.
		const alreadyOwned = items.some(
			(item) => toSnapshotId(this.getSourceId(item)) === feature.uuid,
		);
		if (alreadyOwned) return;

		items.push({
			_id: foundry.utils.randomID(),
			name: feature.name,
			type: 'feature',
			img: feature.img,
			system: {
				macro: '',
				identifier: '',
				rules: [
					{
						id: foundry.utils.randomID(),
						type: 'optionSwap',
						label: feature.ruleLabel,
						disabled: false,
						predicate: {},
						priority: 1,
						selectionGroups: ['all'],
						trigger: 'safeRest',
					},
				],
				description: feature.description,
				featureType: 'class',
				class: identifier,
				group: feature.group,
				gainedAtLevel: feature.level,
				subclass: false,
				gainedAtLevels: [feature.level],
			},
			effects: [],
			folder: null,
			flags: {},
			_stats: { compendiumSource: installedUuid },
		});

		console.log(
			`Nimble Migration | ${source.name ?? 'Actor'}: granted "${feature.name}", which their class prints at level ${feature.level}`,
		);
	}
}

export { Migration050GrantOptionSwapFeatures };
