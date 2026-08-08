import { describe, expect, it } from 'vitest';
import { NimbleActiveEffect } from './activeEffect.js';

const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;

function effectWithShowIcon(showIcon: number | undefined): NimbleActiveEffect {
	return new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)({
		showIcon,
	});
}

describe('NimbleActiveEffect.prepareBaseData', () => {
	it('promotes the CONDITIONAL default to ALWAYS so non-temporary effects keep their icon', () => {
		const effect = effectWithShowIcon(SHOW_ICON.CONDITIONAL);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});

	it('leaves an explicit NEVER alone so hiding an icon stays possible', () => {
		const effect = effectWithShowIcon(SHOW_ICON.NEVER);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.NEVER);
	});

	it('leaves ALWAYS alone', () => {
		const effect = effectWithShowIcon(SHOW_ICON.ALWAYS);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});

	// Effects stored before the V14 upgrade have no showIcon in their source, so
	// the schema initializes them to CONDITIONAL — the case that would otherwise
	// make an existing toggle or banked reduction go invisible on the token.
	it('promotes an effect that initialized to the schema default', () => {
		const effect = effectWithShowIcon(undefined);
		(effect as { showIcon: number }).showIcon = SHOW_ICON.CONDITIONAL;

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});
});
