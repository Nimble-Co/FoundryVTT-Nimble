export function isValidDiceModifier(mod: string) {
	const regex = {
		reroll: /rr?([0-9]+)?([<>=]+)?([0-9]+)?/i,
		explode: /xo?([0-9]+)?([<>=]+)?([0-9]+)?/i,
		minimum: /(?:min)([0-9]+)/i,
		maximum: /(?:max)([0-9]+)/i,
		dropKeep: /[dk]([hl])?([0-9]+)?/i,
		count: /(?:c[sf])([<>=]+)?([0-9]+)?/i,
	};

	return Object.values(regex).some((rgx) => rgx.test(mod));
}
