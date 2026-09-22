import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const CONCENTRATION = 'concentration';

interface ConcentrationPackFix {
	/** For logs and for the pack test, which matches files by the id in the key. */
	name: string;
	/** The duration the rulebook gives it, when what shipped was wrong. */
	duration?: { quantity: number; type: string };
	/** Set when the printed text says Concentration but the property was never ticked. */
	addsProperty?: boolean;
}

/**
 * The concentration items the rulebook disagrees with, keyed by compendium
 * source id. Keyed that way rather than by name so a GM's own spell called
 * `Fly` is left alone and a translated world still matches.
 *
 * Exported so the pack data is asserted against the same table the migration
 * writes.
 */
export const CONCENTRATION_PACK_FIXES: Record<string, ConcentrationPackFix> = {
	'Compendium.nimble.nimble-spells.Item.DHEl4NDcNMu2ZAj0': {
		name: 'Fly',
		duration: { quantity: 10, type: 'minute' },
	},
	'Compendium.nimble.nimble-secret-spells.Item.21OMcsYYwn5C7CLR': {
		name: 'Greater Windform',
		duration: { quantity: 10, type: 'minute' },
	},
	'Compendium.nimble.nimble-secret-spells.Item.eX8CJssX3F2vqFi1': {
		name: 'Lesser Windform',
		duration: { quantity: 10, type: 'minute' },
	},
	'Compendium.nimble.nimble-secret-spells.Item.pGCVd6N7Ed0AeEBE': {
		name: 'Radiant Bond',
		duration: { quantity: 10, type: 'minute' },
	},
	'Compendium.nimble.nimble-magic-items.Item.xk3YG0WdGuzb432h': {
		name: 'Wand of Fly',
		duration: { quantity: 10, type: 'minute' },
		addsProperty: true,
	},
	'Compendium.nimble.nimble-magic-items.Item.R8tUgZsxOMV9IQDT': {
		name: 'Cloak of Lesser Windform',
		addsProperty: true,
	},
};

function isConcentrationNode(effect: any): boolean {
	return effect?.type === 'condition' && effect?.condition === CONCENTRATION;
}

/**
 * Strips concentration nodes at every depth, since a node can nest under
 * another and would otherwise apply the condition a second time.
 *
 * @returns the pruned nodes, or `null` when nothing matched.
 */
function withoutConcentrationNodes(effects: unknown): unknown[] | null {
	if (!Array.isArray(effects)) return null;

	let removedAny = false;

	const prune = (nodes: any[]): any[] =>
		nodes.filter((node) => {
			if (isConcentrationNode(node)) {
				removedAny = true;
				return false;
			}

			if (Array.isArray(node?.children)) node.children = prune(node.children);

			return true;
		});

	const remaining = prune(effects);

	return removedAny ? remaining : null;
}

/**
 * Drop the `condition: concentration` activation nodes the core spells shipped
 * with, now that the property applies the condition on its own.
 *
 * Matched on the property rather than on source ids, so homebrew copies and
 * inscribed scrolls are cleared too. An item without the property keeps its node:
 * nothing else applies the condition there.
 *
 * The items whose printed duration or concentration property shipped wrong are
 * corrected here as well, because a copy already on a character is never
 * re-imported from the pack.
 */
class Migration062ConcentrationAppliesToCaster extends MigrationBase {
	static override readonly version = 62;

	override readonly version = Migration062ConcentrationAppliesToCaster.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell' && source.type !== 'object') return;

		const fix = CONCENTRATION_PACK_FIXES[toSnapshotId(this.getSourceId(source)) ?? ''];

		if (fix?.addsProperty) this.#addConcentrationProperty(source);
		if (!source.system?.properties?.selected?.includes(CONCENTRATION)) return;

		const remaining = withoutConcentrationNodes(source.system?.activation?.effects);
		if (remaining) {
			source.system.activation.effects = remaining;
			console.log(`Nimble Migration | ${source.name}: removed its concentration condition node`);
		}

		if (!fix?.duration || !source.system?.activation?.duration) return;

		const current = source.system.activation.duration;
		if (current.quantity === fix.duration.quantity && current.type === fix.duration.type) return;

		current.quantity = fix.duration.quantity;
		current.type = fix.duration.type;

		console.log(
			`Nimble Migration | ${source.name}: corrected its concentration duration to ${fix.duration.quantity} ${fix.duration.type}`,
		);
	}

	#addConcentrationProperty(source: any): void {
		const properties = source.system?.properties;
		if (!Array.isArray(properties?.selected)) return;
		if (properties.selected.includes(CONCENTRATION)) return;

		properties.selected.push(CONCENTRATION);
		console.log(`Nimble Migration | ${source.name}: ticked its concentration property`);
	}
}

export { Migration062ConcentrationAppliesToCaster };
