import { isTieredSpell } from '#utils/spell/isTieredSpell.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.spellManaCost';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'spellManaCost' }),
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '-1',
				label: `${WORDS}.value.label`,
				hint: `${WORDS}.value.hint`,
				widget: 'formula',
			}),
		),
		itemIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: `${WORDS}.itemIdentifier.label`,
				hint: `${WORDS}.itemIdentifier.hint`,
			}),
		),
	};
}

declare namespace SpellManaCostRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ManaCostedSpell {
	type?: string;
	system?: { identifier?: string; tier?: number };
}

/**
 * Changes the mana a tiered spell costs by `value`, down to 0. The activation reads it through
 * `spellManaCostChange`; on an effect, the effect's Lasts Until ends it.
 */
class SpellManaCostRule extends NimbleBaseRule<SpellManaCostRule.Schema> {
	static override group = 'resource';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-wand-sparkles';

	declare value: string;

	declare itemIdentifier: string;

	static override defineSchema(): SpellManaCostRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['itemIdentifier', 'string'],
			]),
		);
	}

	/** True for a tiered spell this rule names, or any tiered spell when no identifier is set. */
	matchesSpell(spell: ManaCostedSpell | null | undefined): boolean {
		if (!isTieredSpell(spell)) return false;
		const identifier = this.itemIdentifier?.trim() ?? '';
		return identifier === '' || identifier === (spell.system?.identifier ?? '');
	}

	resolveValue(): number | null {
		return this.resolveFormula(this.value);
	}
}

export { SpellManaCostRule };
