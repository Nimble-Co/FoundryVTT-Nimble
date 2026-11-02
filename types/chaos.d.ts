/** One roll on the table. The name and text are empty when the GM alone reads them. */
export interface ChaosRoll {
	value: number;
	/** The other die of a roll with advantage. */
	dropped: number | null;
	name: string;
	text: string;
}

export type ChaosRollChoice = 'once' | 'both' | 'choose';

export interface ChaosCardSystem {
	actorUuid: string;
	status: 'choosing' | 'picking' | 'done';
	advantage: boolean;
	rolls: ChaosRoll[];
	/** With a choice: the roll that stays. */
	kept: number | null;
	/** The charges of the pool for Roll twice, choose one. */
	chooseUses: number;
}

export interface ChaosCardDoc {
	system: ChaosCardSystem;
	update(changes: Record<string, unknown>): Promise<unknown>;
}
