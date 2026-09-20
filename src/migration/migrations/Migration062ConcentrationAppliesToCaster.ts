import { MigrationBase } from '../MigrationBase.js';

const CONCENTRATION = 'concentration';

/**
 * The durations the rulebook gives these spells, which shipped as one minute.
 * Exported so the pack data is asserted against the same table the migration
 * writes.
 */
export const RULEBOOK_CONCENTRATION_DURATIONS: Record<string, { quantity: number; type: string }> =
	{
		Fly: { quantity: 10, type: 'minute' },
		'Greater Windform': { quantity: 10, type: 'minute' },
		'Lesser Windform': { quantity: 10, type: 'minute' },
		'Radiant Bond': { quantity: 10, type: 'minute' },
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
 * The four spells whose printed duration is ten minutes are corrected here as
 * well, because a copy already on a character is never re-imported from the pack.
 */
class Migration062ConcentrationAppliesToCaster extends MigrationBase {
	static override readonly version = 62;

	override readonly version = Migration062ConcentrationAppliesToCaster.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell' && source.type !== 'object') return;
		if (!source.system?.properties?.selected?.includes(CONCENTRATION)) return;

		const remaining = withoutConcentrationNodes(source.system?.activation?.effects);
		if (remaining) {
			source.system.activation.effects = remaining;
			console.log(`Nimble Migration | ${source.name}: removed its concentration condition node`);
		}

		const duration = RULEBOOK_CONCENTRATION_DURATIONS[source.name];
		if (!duration || !source.system?.activation?.duration) return;

		const current = source.system.activation.duration;
		if (current.quantity === duration.quantity && current.type === duration.type) return;

		current.quantity = duration.quantity;
		current.type = duration.type;

		console.log(
			`Nimble Migration | ${source.name}: corrected its concentration duration to ${duration.quantity} ${duration.type}`,
		);
	}
}

export { Migration062ConcentrationAppliesToCaster };
