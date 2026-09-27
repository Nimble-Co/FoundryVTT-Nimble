import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const CONCENTRATION = 'concentration';

interface Duration {
	quantity: number;
	type: string;
}

interface ConcentrationPackFix {
	/** For logs and for the pack test, which matches files by the id in the key. */
	name: string;
	/**
	 * The duration the rulebook gives it, when what shipped was wrong, alongside
	 * the wrong value it shipped with. A stored duration that is neither is a
	 * GM's own edit and is left alone.
	 */
	duration?: { shipped: Duration; corrected: Duration };
	/** Set when the printed text says Concentration but the property was never ticked. */
	addsProperty?: boolean;
}

const SHIPPED_ONE_MINUTE: Duration = { quantity: 1, type: 'minute' };
const TEN_MINUTES: Duration = { quantity: 10, type: 'minute' };

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
		duration: { shipped: SHIPPED_ONE_MINUTE, corrected: TEN_MINUTES },
	},
	'Compendium.nimble.nimble-secret-spells.Item.21OMcsYYwn5C7CLR': {
		name: 'Greater Windform',
		duration: { shipped: SHIPPED_ONE_MINUTE, corrected: TEN_MINUTES },
	},
	'Compendium.nimble.nimble-secret-spells.Item.eX8CJssX3F2vqFi1': {
		name: 'Lesser Windform',
		duration: { shipped: SHIPPED_ONE_MINUTE, corrected: TEN_MINUTES },
	},
	'Compendium.nimble.nimble-secret-spells.Item.pGCVd6N7Ed0AeEBE': {
		name: 'Radiant Bond',
		duration: { shipped: SHIPPED_ONE_MINUTE, corrected: TEN_MINUTES },
	},
	'Compendium.nimble.nimble-magic-items.Item.xk3YG0WdGuzb432h': {
		name: 'Wand of Fly',
		duration: { shipped: SHIPPED_ONE_MINUTE, corrected: TEN_MINUTES },
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
 * another and would otherwise apply the condition a second time. Children are
 * stored per outcome under `on.<context>[]`, so every array there is walked.
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

			if (node?.on && typeof node.on === 'object') {
				for (const [context, children] of Object.entries(node.on)) {
					if (Array.isArray(children)) node.on[context] = prune(children);
				}
			}

			return true;
		});

	const remaining = prune(effects);

	return removedAny ? remaining : null;
}

/**
 * Drop the `condition: concentration` activation nodes the core spells shipped
 * with, now that the property applies the condition on its own.
 *
 * Node removal is matched on the property rather than on source ids, so homebrew
 * copies and inscribed scrolls are cleared too. An item without the property
 * keeps its node: nothing else applies the condition there.
 *
 * The named items are corrected whatever their property says, because a copy
 * already on a character is never re-imported from the pack. A duration is only
 * rewritten when it still holds the wrong value that shipped, so a GM's own
 * edit survives.
 */
class Migration062ConcentrationAppliesToCaster extends MigrationBase {
	static override readonly version = 62;

	override readonly version = Migration062ConcentrationAppliesToCaster.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell' && source.type !== 'object') return;

		const fix = CONCENTRATION_PACK_FIXES[toSnapshotId(this.getSourceId(source)) ?? ''];

		if (fix?.addsProperty) this.#addConcentrationProperty(source);
		if (fix?.duration) this.#correctDuration(source, fix);
		if (!source.system?.properties?.selected?.includes(CONCENTRATION)) return;

		const remaining = withoutConcentrationNodes(source.system?.activation?.effects);
		if (!remaining) return;

		source.system.activation.effects = remaining;
		console.log(`Nimble Migration | ${source.name}: removed its concentration condition node`);
	}

	#correctDuration(source: any, fix: ConcentrationPackFix): void {
		const current = source.system?.activation?.duration;
		if (!current || !fix.duration) return;

		const { shipped, corrected } = fix.duration;
		if (current.quantity !== shipped.quantity || current.type !== shipped.type) return;

		current.quantity = corrected.quantity;
		current.type = corrected.type;

		console.log(
			`Nimble Migration | ${source.name}: corrected its concentration duration to ${corrected.quantity} ${corrected.type}`,
		);
	}

	/** Creates `selected` when the source never had one, which is how an old object reads. */
	#addConcentrationProperty(source: any): void {
		const properties = source.system?.properties;
		if (!properties || typeof properties !== 'object') return;
		if (!Array.isArray(properties.selected)) properties.selected = [];
		if (properties.selected.includes(CONCENTRATION)) return;

		properties.selected.push(CONCENTRATION);
		console.log(`Nimble Migration | ${source.name}: ticked its concentration property`);
	}
}

export { Migration062ConcentrationAppliesToCaster };
