import { SYSTEM_ID } from '#system';

import { MigrationBase } from '../MigrationBase.js';

/**
 * Each core ancestry's default bonus trait, keyed by the ancestry's compendium source id.
 *
 * A snapshot, deliberately: a migration has to describe the world as it was when the split
 * shipped. `dev-rebrand.mjs` only rewrites `packs/**` — not `src/**` — so on the `nimble-dev`
 * build an actor's stored source id reads `Compendium.nimble-dev.…`. `normalizePackSource`
 * below folds it back onto these stable keys.
 */
const DEFAULT_BONUSES: Record<string, { bonus: string; trait: string }> = {
	// Birdfolk
	'Compendium.nimble.nimble-ancestries.Item.G7uhni6XZkQV5VQi': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.PTYU9MJcVsRo5eVT',
		trait: 'Hollow Bones',
	},
	// Bunbun
	'Compendium.nimble.nimble-ancestries.Item.H1B0wnT9GKexRhyG': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.1cSW678NQBiWN5m4',
		trait: 'Bunny Legs',
	},
	// Celestial
	'Compendium.nimble.nimble-ancestries.Item.puHj7KBjvyb5mVHA': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.QywcDHwdcVvogu2G',
		trait: 'Highborn',
	},
	// Changeling
	'Compendium.nimble.nimble-ancestries.Item.IaJujyjdf7HYDacv': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.QIR3oWX6wPzjRsTu',
		trait: 'New Place, New Face',
	},
	// Crystalborn
	'Compendium.nimble.nimble-ancestries.Item.CMhHBD7MLZgK8o2I': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.1YtCep32COT7uAYP',
		trait: 'Reflective Aura',
	},
	// Dragonborn
	'Compendium.nimble.nimble-ancestries.Item.JZYAZ7p2cumgRSyC': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.P5t4e28z4BHXAhAZ',
		trait: 'Draconic Heritage',
	},
	// Dryad/Shroomling
	'Compendium.nimble.nimble-ancestries.Item.IYDJe9IZi1VSUHPS': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.NKA98sDFntkqd4Im',
		trait: 'Danger Pollen/Spores',
	},
	// Dwarf
	'Compendium.nimble.nimble-ancestries.Item.hyVaEOLNSagYECwm': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.PwCzys1zJwz79alF',
		trait: 'Stout',
	},
	// Elf
	'Compendium.nimble.nimble-ancestries.Item.b7MDkSugU1E1TOhj': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.YJpImt9S1WiwdC8r',
		trait: 'Lithe',
	},
	// Fiendkin
	'Compendium.nimble.nimble-ancestries.Item.gn0l7830gS0VVQfb': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.enR5YZLbGlVPjIuu',
		trait: 'Flameborn',
	},
	// Gnome
	'Compendium.nimble.nimble-ancestries.Item.pOBaPdMcLBTCbLNw': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.bK2KkZ5MbXeKoriS',
		trait: 'Optimistic',
	},
	// Goblin
	'Compendium.nimble.nimble-ancestries.Item.IVgTJcGcBmH7xCB7': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.4CvyglRIWdfIJvdr',
		trait: 'Skedaddle',
	},
	// Half-Giant
	'Compendium.nimble.nimble-ancestries.Item.4mRJcQgWmQ1fnsys': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.BNt1EadnOGvzAHsC',
		trait: 'Strength of Stone',
	},
	// Halfling
	'Compendium.nimble.nimble-ancestries.Item.KYRRFekLA0Ipuxgt': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.Z2TN2RVAcb53Oysu',
		trait: 'Elusive',
	},
	// Human
	'Compendium.nimble.nimble-ancestries.Item.11SKfGVV3ZWHquUb': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.FzHdMlir2ftuHf4B',
		trait: 'Tenacious',
	},
	// Kobold
	'Compendium.nimble.nimble-ancestries.Item.oiEF0p8oGIFBtUf3': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.A33WjART8CQdkmeY',
		trait: 'Wily',
	},
	// Minotaur/Beastfolk
	'Compendium.nimble.nimble-ancestries.Item.jbcwVS5hxMgDSdUQ': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.zjUGAh5QLbCbI4V9',
		trait: 'Charge',
	},
	// Oozeling/Construct
	'Compendium.nimble.nimble-ancestries.Item.jYafwBbK4DVALpBf': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.K1sViOESSiQ6VEeV',
		trait: 'Odd Constitution',
	},
	// Orc
	'Compendium.nimble.nimble-ancestries.Item.5fC0JgKQhm8QSQoL': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.24eEwpL0nGbTRGlK',
		trait: 'Relentless',
	},
	// Planarbeing
	'Compendium.nimble.nimble-ancestries.Item.PEDssoxr48uRKcel': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.5Gf1lv0piL0PkYBF',
		trait: 'Planeshift',
	},
	// Ratfolk
	'Compendium.nimble.nimble-ancestries.Item.FbOJ9FMfpoAhDZll': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.Xv7uz6l6F8Z0sQ3O',
		trait: 'Scurry',
	},
	// Stoatling
	'Compendium.nimble.nimble-ancestries.Item.gM03JFi6joqcq7AI': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.eySxKgtWLbHJBK2W',
		trait: 'Small But Ferocious',
	},
	// Turtlefolk
	'Compendium.nimble.nimble-ancestries.Item.1XtBW6Qu8PlmZ1uD': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.YVtbIbWYzKD33sEA',
		trait: 'Slow & Steady',
	},
	// Wyrdling
	'Compendium.nimble.nimble-ancestries.Item.XpGSoVhViJkf66WP': {
		bonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.bp8h61eI7HaKUEPW',
		trait: 'Chaotic Surge',
	},
};

/** Matches the trait separator, including `<hr />` and an `<hr>` carrying attributes. */
const TRAIT_SEPARATOR = /<hr\b[^>]*>/i;

/** The compendium namespace `DEFAULT_BONUSES` was snapshotted under. */
const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** The namespace the running install stores and resolves uuids under. */
const INSTALLED_PREFIX = `Compendium.${SYSTEM_ID}.`;

/** Every namespace a stored id could have been written under — the stable id or the dev rebrand. */
const STORED_PREFIXES = [SNAPSHOT_PREFIX, 'Compendium.nimble-dev.'];

/**
 * Folds a stored source id onto the snapshot's namespace so `DEFAULT_BONUSES` resolves on the dev
 * build too, where an actor's ids read `Compendium.nimble-dev.…`. The document ids are identical
 * across the two installs — only the system id segment differs — so the fold is exact. Both forms
 * are folded rather than just the running install's, since actors get exported and imported
 * across the two.
 */
function toSnapshotId(packSource: string | undefined): string | undefined {
	if (!packSource) return packSource;
	const prefix = STORED_PREFIXES.find((candidate) => packSource.startsWith(candidate));
	return prefix ? `${SNAPSHOT_PREFIX}${packSource.slice(prefix.length)}` : packSource;
}

/**
 * The inverse: rebrands a snapshot id back to the running install, so every uuid this migration
 * writes is one `fromUuid` can actually resolve. Both are the identity on the stable install.
 */
function toInstalledId(snapshotId: string): string {
	return `${INSTALLED_PREFIX}${snapshotId.slice(SNAPSHOT_PREFIX.length)}`;
}

/**
 * Identities for "the bonus already carries this ancestry rule".
 *
 * The original split moved the rule objects across wholesale, so a shared `id` is the
 * strongest signal. The shape signature (id excluded, keys sorted) additionally catches a
 * bonus reauthored from the packs, where the equivalent rule was minted with a fresh id.
 * A rule counts as carried if either identity matches.
 */
function ruleSignatures(rule: any): string[] {
	const { id, ...shape } = rule ?? {};
	const sorted = Object.fromEntries(Object.entries(shape).sort(([a], [b]) => a.localeCompare(b)));
	const signatures = [`shape:${JSON.stringify(sorted)}`];
	if (id) signatures.push(`id:${id}`);
	return signatures;
}

/** A homebrew language name may contain regex metacharacters — `Sylvan (Fey` throws unescaped. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The pack bonus this ancestry came with, if it's a copy of one the split shipped. */
function findPackDefault(ancestry: any): { bonus: string; trait: string } | undefined {
	const packSource = toSnapshotId(
		ancestry._stats?.compendiumSource ?? ancestry.flags?.core?.sourceId,
	);
	return packSource ? DEFAULT_BONUSES[packSource] : undefined;
}

/** The baked trait pulled apart from the ancestry that still carries it. */
interface TraitSplit {
	/** Language grants, which stay on the ancestry. */
	languageRules: any[];
	/** Everything else, which belongs on the bonus. */
	bonusRules: any[];
	/** The trait's own description, language sentences removed. */
	traitHtml: string;
	traitName: string;
	/** The ancestry description with the trait section cut out. */
	strippedDescription: string;
	/** The description as found, so callers can tell whether stripping changes anything. */
	description: string;
}

/**
 * Pulls the baked trait apart from an ancestry source, or returns `null` when there is nothing
 * to pull — the ancestry is already trait-free (post-redesign content).
 */
function splitAncestryTrait(ancestry: any): TraitSplit | null {
	const rules: any[] = Array.isArray(ancestry.system.rules) ? ancestry.system.rules : [];
	const description: string = ancestry.system.description ?? '';
	const hrMatch = description.match(TRAIT_SEPARATOR);
	const hrIndex = hrMatch?.index ?? -1;

	// Languages are inherent to the ancestry, so those rules stay put. Only the rest of
	// the trait's rules move onto the swappable bonus item.
	const isLanguageRule = (rule: any) =>
		rule?.type === 'grantProficiency' && rule?.proficiencyType === 'languages';
	const languageRules = rules.filter(isLanguageRule);
	const bonusRules = rules.filter((rule) => !isLanguageRule(rule));

	if (hrIndex < 0 && bonusRules.length === 0) return null;

	const flavor = hrIndex >= 0 ? description.slice(0, hrIndex).trim() : description;
	const rawTrait =
		hrIndex >= 0 ? description.slice(hrIndex + (hrMatch?.[0].length ?? 0)).trim() : '';

	// The trait section also carries the "You know <Language>..." sentence. That belongs
	// with the ancestry alongside its language rule, not on the swappable bonus.
	const languages = languageRules.flatMap((rule: any) =>
		Array.isArray(rule?.values) ? rule.values : [],
	);
	const isLanguageParagraph = (paragraph: string) =>
		/you know/i.test(paragraph) &&
		languages.some((language: string) => new RegExp(escapeRegExp(language), 'i').test(paragraph));

	const languageParagraphs = (rawTrait.match(/<p>[\s\S]*?<\/p>/gi) ?? []).filter(
		isLanguageParagraph,
	);
	const traitHtml = languageParagraphs
		.reduce((html, paragraph) => html.replace(paragraph, ''), rawTrait)
		.trim();

	const strongMatch = traitHtml.match(/<strong>(.*?)<\/strong>/i);
	const traitName = strongMatch ? strongMatch[1].trim() : `${ancestry.name} Trait`;

	return {
		languageRules,
		bonusRules,
		traitHtml,
		traitName,
		strippedDescription: `${flavor}${languageParagraphs.join('')}`,
		description,
	};
}

/**
 * Splits an existing actor's ancestry trait into a separate `ancestryBonus` item.
 *
 * Ancestries used to bake their bonus trait directly into the ancestry item's
 * `system.rules` and the part of `system.description` after the `<hr>` separator.
 * Those now live on a dedicated `ancestryBonus` item so the bonus can be swapped
 * independently of the ancestry.
 *
 * For each character with an ancestry, this migration:
 * 1. Points the ancestry at its default bonus trait (`system.defaultBonus`), which only the
 *    pack copies carry — an embedded ancestry predates the field entirely.
 * 2. Creates an `ancestryBonus` item carrying the trait's (non-language) rules and description,
 *    unless the character already has one.
 * 3. Strips the trait out of the ancestry, but keeps any language-granting rules — and the
 *    "You know <Language>..." sentence that documents them — on the ancestry. Languages are
 *    inherent to the ancestry, not the swappable bonus trait.
 *
 * Step 3 runs even when a bonus already exists. An earlier pass could create the bonus without
 * the ancestry edit landing, which leaves both items carrying the trait's rules — a dwarf then
 * takes Stout's -1 Speed twice. It also covers the ancestries whose trait is text only: they
 * have no rules to deduplicate, but their description still needs the trait cut out of it.
 * Stripping is idempotent: on an ancestry that is already trait-free the guard above returns
 * before any of this.
 *
 * `updateItem` does steps 1 and 3 for world-level ancestry Items — no step 2, since an Item can't
 * own the extracted bonus. See the comment there for what that rules out.
 */
class Migration035AncestryBonusSplit extends MigrationBase {
	static override readonly version = 35;

	override readonly version = Migration035AncestryBonusSplit.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];

		const ancestry = items.find((item) => item?.type === 'ancestry');
		if (!ancestry?.system) return;

		// A bonus may already exist from an earlier pass that created it without stripping the
		// ancestry. Don't create a second one, but do clean up the duplicates below — leftover
		// trait rules apply a second time on top of the bonus's copies.
		const existingBonus = items.find((item) => item?.type === 'ancestryBonus');

		// `defaultBonus` was added with this split, so every embedded ancestry starts blank and
		// the sheet would show no default forever. Backfill before the trait-free guard below —
		// an ancestry can be post-redesign content and still be missing the pointer.
		const packDefault = findPackDefault(ancestry);
		if (packDefault && !ancestry.system.defaultBonus) {
			ancestry.system.defaultBonus = toInstalledId(packDefault.bonus);
		}

		const split = splitAncestryTrait(ancestry);
		if (!split) return;

		const { languageRules, bonusRules, traitHtml, traitName, strippedDescription, description } =
			split;

		if (!existingBonus) {
			items.push({
				_id: foundry.utils.randomID(),
				name: traitName,
				type: 'ancestryBonus',
				img: ancestry.img,
				system: {
					macro: '',
					identifier: '',
					rules: bonusRules,
					description: traitHtml,
				},
				effects: [],
				folder: null,
				flags: {},
				// Stamp the pack origin when this is demonstrably the ancestry's own trait, so a
				// later migration can recognise it by source id the way it can any dragged-in item.
				...(packDefault?.trait === traitName
					? { _stats: { compendiumSource: toInstalledId(packDefault.bonus) } }
					: {}),
			});

			ancestry.system.description = strippedDescription;
			ancestry.system.rules = languageRules;

			console.log(`Nimble Migration | ${source.name}: extracted ancestry bonus "${traitName}"`);
			return;
		}

		// A bonus already exists. Only drop the ancestry rules the bonus demonstrably carries —
		// anything it does not (a swapped bonus, a partial earlier pass) stays put rather than
		// being silently deleted.
		const carried = new Set<string>(
			(Array.isArray(existingBonus.system?.rules) ? existingBonus.system.rules : []).flatMap(
				ruleSignatures,
			),
		);
		const isCarried = (rule: any) => ruleSignatures(rule).some((sig) => carried.has(sig));
		const duplicated = bonusRules.filter(isCarried);
		const orphaned = bonusRules.filter((rule) => !isCarried(rule));

		// The trait description only comes off the ancestry once the bonus covers all of it;
		// while rules remain, the text still describes what the ancestry itself applies. A
		// text-only trait has no rules at all, so this is the only repair it ever needs.
		const descriptionIsStale = orphaned.length === 0 && strippedDescription !== description;

		if (duplicated.length === 0 && !descriptionIsStale) return;

		if (duplicated.length > 0) ancestry.system.rules = [...languageRules, ...orphaned];
		if (descriptionIsStale) ancestry.system.description = strippedDescription;

		console.log(
			`Nimble Migration | ${source.name}: repaired ancestry "${ancestry.name}" against existing bonus "${existingBonus.name}" — dropped ${duplicated.length} duplicated rule(s)${
				orphaned.length > 0 ? `, kept ${orphaned.length} not found on it` : ''
			}${descriptionIsStale ? ', stripped the trait description' : ''}`,
		);
	}

	/**
	 * Brings a world-level (sidebar or homebrew-pack) ancestry Item in line with the split, so
	 * dragging it onto a character behaves like dragging the pack copy.
	 */
	override async updateItem(source: any, parent?: any): Promise<void> {
		// An embedded ancestry is `updateActor`'s job: extracting its trait needs the actor's
		// item list to hold the new bonus, which an item source has no equivalent of.
		if (parent) return;
		if (source?.type !== 'ancestry' || !source.system) return;

		const packDefault = findPackDefault(source);
		if (packDefault && !source.system.defaultBonus) {
			source.system.defaultBonus = toInstalledId(packDefault.bonus);
		}

		const split = splitAncestryTrait(source);
		if (!split) return;

		// An Item can't own another Item, so there is nowhere to extract the trait *to*. That only
		// matters for content the packs don't already carry: when the trait matches the pack bonus
		// `defaultBonus` now points at, stripping it is lossless — the bonus carries it verbatim,
		// and leaving it would apply the trait twice once the bonus lands. Homebrew traits keep
		// theirs rather than being deleted with no replacement.
		if (!packDefault || packDefault.trait !== split.traitName) return;
		if (split.strippedDescription === split.description && split.bonusRules.length === 0) return;

		source.system.description = split.strippedDescription;
		source.system.rules = split.languageRules;

		console.log(
			`Nimble Migration | world ancestry "${source.name}": stripped trait "${split.traitName}", now carried by its default bonus`,
		);
	}
}

export { Migration035AncestryBonusSplit };
