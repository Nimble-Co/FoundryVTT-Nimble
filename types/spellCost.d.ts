/** What exceeding a declared spell cost does to the caster. */
export type OverdraftConsequence = '' | 'halfMaxHpDamage';

/** A class's declaration of what its tiered spells cost and how they resolve. */
export interface ClassSpellcastingDeclaration {
	castAtHighestTier?: boolean;
	cost?: {
		poolIdentifier?: string;
		amount?: string;
		overdraftConsequence?: OverdraftConsequence;
		overdraftMaxLevel?: number | null;
	};
}

/**
 * The structural slice of an actor the spell cost functions read and write.
 * Kept separate from `CharacterActorLike` so callers with a partial actor (and
 * tests) can satisfy it without a full document.
 */
export interface SpellCostActorLike {
	type?: string;
	levels?: { character?: number };
	items?: { contents?: Array<{ type?: string; system?: unknown }> };
	system?: {
		resources?: {
			mana?: { current?: number; max?: number; baseMax?: number };
			highestUnlockedSpellTier?: number | null;
		};
		attributes?: { hp?: { max?: number } };
	};
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
	applyDamage?: (damage: number) => Promise<void>;
}

/** The structural slice of a spell the cost functions read. */
export interface SpellLike {
	system?: { tier?: number; scaling?: { mode?: string } | null; classes?: string[] };
}

/** The upcast selection a dialog would have returned. */
export interface UpcastSelection {
	manaToSpend: number;
	choiceIndex?: number;
}

/** What a single cast costs the caster. */
export type ResolvedSpellCost =
	| { type: 'none' }
	| { type: 'mana'; amount: number }
	| {
			type: 'pool';
			poolIdentifier: string;
			poolLabel: string;
			amount: number;
			overdraftConsequence: OverdraftConsequence;
			/**
			 * True when the caster is past the level at which the declared
			 * consequence applies automatically. The overdraw is still permitted;
			 * nothing is applied for it, because the rule that replaces it is not
			 * automated.
			 */
			overdraftResolvedAtTable: boolean;
	  };

export interface SpellCostFailure {
	code: 'poolMissing' | 'insufficientCharges';
	poolIdentifier: string;
	poolLabel: string;
	required: number;
	available: number;
}

export interface SpellCostValidation {
	ok: boolean;
	overdrawn: boolean;
	/** The pool's current value when the cast would overdraw it. */
	available?: number;
	failure?: SpellCostFailure;
}
