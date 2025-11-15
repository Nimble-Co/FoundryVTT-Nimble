import { NIMBLE } from '../../config.ts';

const base = {
	bar: ['attributes.hp'],
	value: [
		...Object.keys(NIMBLE.abilityScores).map((a) => `abilities.${a}.value`),
		'attributes.hp.temp',
	],
};

export const trackableAttributes = {
	base,
	character: {
		bar: [...base.bar, 'attributes.armor.value', 'attributes.wounds.value'],
		value: [...base.value, 'resources.mana'],
	},
};
