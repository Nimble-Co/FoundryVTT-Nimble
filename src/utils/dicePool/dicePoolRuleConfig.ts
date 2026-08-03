import { SYSTEM_ID } from '#system';

const DicePoolRuleConfig = {
	scopes: ['item', 'actor'],
	dieSizes: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'],
	initialModes: ['max', 'zero'],
	refillTriggers: [
		'safeRest',
		'fieldRest',
		'onHit',
		'onCriticalHit',
		'encounterStart',
		'encounterEnd',
		'onWound',
		'onTurnStart',
		'onTurnEnd',
		'onKill',
		'onBloodied',
		'onAttacked',
		'onCritReceived',
	],
	refillModes: ['add', 'set', 'refresh', 'setIfEmpty', 'clear'],
	restTypes: ['safe', 'field'],
	encounterTriggerTypes: ['encounterStart', 'encounterEnd'] as const,
	// How dice are spent: 'manual' = player opts in per roll, dice consumed.
	// 'autoBonus' = every face is added to qualifying rolls automatically and
	// the pool does NOT decrement. Used for snowballing damage pools like
	// Berserker Fury Dice.
	consumptionModes: ['manual', 'autoBonus'] as const,
	// What a manual spend's effect roll produces. 'generic' just posts the total
	// to chat; 'damageReduction' additionally banks the total as a one-shot
	// reduction applied to the next damage the actor takes (e.g. Berserker's
	// "That all you got?!").
	effectTypes: ['generic', 'damageReduction'] as const,
	// What happens to the dice the player picks in the spend panel. 'consume'
	// removes them from the pool; 'maximize' leaves them in place and raises
	// each to the die's highest face. Selection for 'maximize' is capped at the
	// consumer's cost, so a "change 1 die" feature offers a single pick.
	selectionOutcomes: ['consume', 'maximize'] as const,
	// Optional delivery filter. When set, an autoBonus pool's faces auto-add
	// only to attacks of the matching delivery, and a card offer is only made
	// on them.
	attackDeliveryFilters: ['melee', 'ranged', 'any'] as const,
	// Optional outcome gate for offering a manual spend on the attack card the
	// spend would modify, instead of only through the sheet's pool panel. When
	// set, the owner gets a button on their own cards whose outcome matches,
	// and the spend folds into that card's damage total rather than posting a
	// standalone roll the GM has to apply by hand.
	cardOfferTriggers: ['hit', 'criticalHit'] as const,
	flagScope: SYSTEM_ID,
	flagKey: 'dicePools',
	flagPath: `flags.${SYSTEM_ID}.dicePools`,
} as const;

export { DicePoolRuleConfig };
