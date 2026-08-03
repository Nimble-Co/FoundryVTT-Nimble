import { MigrationBase } from '../MigrationBase.js';

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

/**
 * Splits an existing actor's ancestry trait into a separate `ancestryBonus` item.
 *
 * Ancestries used to bake their bonus trait directly into the ancestry item's
 * `system.rules` and the part of `system.description` after the `<hr>` separator.
 * Those now live on a dedicated `ancestryBonus` item so the bonus can be swapped
 * independently of the ancestry.
 *
 * For each character with an ancestry, this migration:
 * 1. Creates an `ancestryBonus` item carrying the trait's (non-language) rules and description,
 *    unless the character already has one.
 * 2. Strips the trait out of the ancestry, but keeps any language-granting rules — and the
 *    "You know <Language>..." sentence that documents them — on the ancestry. Languages are
 *    inherent to the ancestry, not the swappable bonus trait.
 *
 * Step 2 runs even when a bonus already exists. An earlier pass could create the bonus without
 * the ancestry edit landing, which leaves both items carrying the trait's rules — a dwarf then
 * takes Stout's -1 Speed twice. Stripping unconditionally is idempotent: on an ancestry that is
 * already trait-free the guard above returns before any of this.
 */
class Migration035AncestryBonusSplit extends MigrationBase {
	static override readonly version = 35;

	override readonly version = Migration035AncestryBonusSplit.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];

		const ancestry = items.find((item) => item?.type === 'ancestry');
		if (!ancestry) return;

		// A bonus may already exist from an earlier pass that created it without stripping the
		// ancestry. Don't create a second one, but do clean up the duplicates below — leftover
		// trait rules apply a second time on top of the bonus's copies.
		const existingBonus = items.find((item) => item?.type === 'ancestryBonus');

		const rules: any[] = Array.isArray(ancestry.system?.rules) ? ancestry.system.rules : [];
		const description: string = ancestry.system?.description ?? '';
		const hrMatch = description.match(/<hr\s*\/?>/i);
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
			languages.some((language: string) => new RegExp(language, 'i').test(paragraph));

		const languageParagraphs = (rawTrait.match(/<p>[\s\S]*?<\/p>/gi) ?? []).filter(
			isLanguageParagraph,
		);
		const traitHtml = languageParagraphs
			.reduce((html, paragraph) => html.replace(paragraph, ''), rawTrait)
			.trim();

		const strongMatch = traitHtml.match(/<strong>(.*?)<\/strong>/i);
		const traitName = strongMatch ? strongMatch[1].trim() : `${ancestry.name} Trait`;

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
			});

			ancestry.system.description = `${flavor}${languageParagraphs.join('')}`;
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

		if (duplicated.length === 0) return;

		ancestry.system.rules = [...languageRules, ...orphaned];

		// The trait description only comes off the ancestry once the bonus covers all of it;
		// while rules remain, the text still describes what the ancestry itself applies.
		if (orphaned.length === 0) {
			ancestry.system.description = `${flavor}${languageParagraphs.join('')}`;
		}

		console.log(
			`Nimble Migration | ${source.name}: dropped ${duplicated.length} ancestry rule(s) already carried by "${existingBonus.name}"${
				orphaned.length > 0 ? `; kept ${orphaned.length} not found on it` : ''
			}`,
		);
	}
}

export { Migration035AncestryBonusSplit };
