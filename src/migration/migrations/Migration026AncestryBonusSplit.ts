import { MigrationBase } from '../MigrationBase.js';

/**
 * Generate a Foundry-compatible 16-character random ID.
 */
function generateId(): string {
	if (typeof foundry !== 'undefined' && foundry?.utils?.randomID) {
		return foundry.utils.randomID();
	}
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 16; i += 1) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Splits an existing actor's ancestry trait into a separate `ancestryBonus` item.
 *
 * Ancestries used to bake their bonus trait directly into the ancestry item's
 * `system.rules` and the part of `system.description` after the `<hr>` separator.
 * Those now live on a dedicated `ancestryBonus` item so the bonus can be swapped
 * independently of the ancestry.
 *
 * For each character with an ancestry but no ancestry bonus, this migration:
 * 1. Creates an `ancestryBonus` item carrying the trait's rules and description.
 * 2. Strips the trait out of the ancestry (flavor-only description, no rules).
 */
class Migration026AncestryBonusSplit extends MigrationBase {
	static override readonly version = 26;

	override readonly version = Migration026AncestryBonusSplit.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];

		const ancestry = items.find((item) => item?.type === 'ancestry');
		if (!ancestry) return;

		// Already migrated if a bonus exists.
		if (items.some((item) => item?.type === 'ancestryBonus')) return;

		const rules: any[] = Array.isArray(ancestry.system?.rules) ? ancestry.system.rules : [];
		const description: string = ancestry.system?.description ?? '';
		const hrMatch = description.match(/<hr\s*\/?>/i);
		const hrIndex = hrMatch?.index ?? -1;

		// Nothing to extract — the ancestry is already trait-free (post-redesign content).
		if (hrIndex < 0 && rules.length === 0) return;

		const flavor = hrIndex >= 0 ? description.slice(0, hrIndex).trim() : description;
		const traitHtml =
			hrIndex >= 0 ? description.slice(hrIndex + (hrMatch?.[0].length ?? 0)).trim() : '';

		const strongMatch = traitHtml.match(/<strong>(.*?)<\/strong>/i);
		const traitName = strongMatch ? strongMatch[1].trim() : `${ancestry.name} Trait`;

		const bonus = {
			_id: generateId(),
			name: traitName,
			type: 'ancestryBonus',
			img: ancestry.img,
			system: {
				macro: '',
				identifier: '',
				rules,
				description: traitHtml,
			},
			effects: [],
			folder: null,
			flags: {},
		};

		items.push(bonus);

		ancestry.system.description = flavor;
		ancestry.system.rules = [];

		console.log(`Nimble Migration | ${source.name}: extracted ancestry bonus "${traitName}"`);
	}
}

export { Migration026AncestryBonusSplit };
