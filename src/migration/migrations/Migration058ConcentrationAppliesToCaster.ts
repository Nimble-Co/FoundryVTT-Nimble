import { MigrationBase } from '../MigrationBase.js';

const CONCENTRATION = 'concentration';

/**
 * Drop the `condition: concentration` activation nodes eight core spells shipped
 * with, now that the property applies the condition on its own (issue #23).
 *
 * Matched on the property rather than on source ids, so homebrew copies and
 * inscribed scrolls are cleared too. An item without the property keeps its node:
 * nothing else applies the condition there.
 */
class Migration058ConcentrationAppliesToCaster extends MigrationBase {
	static override readonly version = 58;

	override readonly version = Migration058ConcentrationAppliesToCaster.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell' && source.type !== 'object') return;
		if (!source.system?.properties?.selected?.includes(CONCENTRATION)) return;

		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;

		const remaining = effects.filter(
			(effect: any) => !(effect?.type === 'condition' && effect?.condition === CONCENTRATION),
		);
		if (remaining.length === effects.length) return;

		source.system.activation.effects = remaining;

		console.log(`Nimble Migration | ${source.name}: removed its concentration condition node`);
	}
}

export { Migration058ConcentrationAppliesToCaster };
