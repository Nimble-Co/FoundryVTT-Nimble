import { MigrationBase } from '../MigrationBase.js';

/**
 * Each core ancestry's default bonus trait, keyed by the ancestry's compendium source id.
 *
 * A snapshot, deliberately: a migration has to describe the world as it was when the split
 * shipped. `dev-rebrand.mjs` rewrites these `Compendium.nimble.*` ids for the `nimble-dev`
 * build, so the literals are safe here (see AGENTS.md).
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
		const packSource = ancestry._stats?.compendiumSource ?? ancestry.flags?.core?.sourceId;
		const packDefault = packSource ? DEFAULT_BONUSES[packSource] : undefined;
		if (packDefault && !ancestry.system.defaultBonus) {
			ancestry.system.defaultBonus = packDefault.bonus;
		}

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

		// Nothing to extract — the ancestry is already trait-free (post-redesign content).
		if (hrIndex < 0 && bonusRules.length === 0) return;

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

		// The ancestry description with the trait section removed. Everything below writes
		// this same value; whether it is allowed to land differs per branch.
		const strippedDescription = `${flavor}${languageParagraphs.join('')}`;

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
					? { _stats: { compendiumSource: packDefault.bonus } }
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
}

export { Migration035AncestryBonusSplit };
