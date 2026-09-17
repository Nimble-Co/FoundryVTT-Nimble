import { MigrationBase } from '../MigrationBase.js';

const CONCENTRATION = 'concentration';

/**
 * Drop the `condition: concentration` activation nodes eight core spells shipped
 * with (issue #23).
 *
 * Casting an item that carries the `concentration` property now applies the
 * condition to the caster on its own, so those nodes are redundant. They were
 * also wrong: the card chip is GM-only, and it applies the condition to the
 * card's targets rather than to the caster.
 *
 * Matched on the property rather than on source ids, so a homebrew copy and an
 * inscribed scroll, which deep-clones the spell's activation, are cleared too.
 * An item without the property keeps whatever concentration node was authored on
 * it: nothing else applies the condition there, so the chip is still the only way.
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
