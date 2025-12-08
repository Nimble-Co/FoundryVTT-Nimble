/**
 * Type declarations for Nimble actor types to prevent circular dependencies
 */

declare interface NimbleBaseActorInterface extends Actor {
	type: string;
	getDomain(): Set<string>;
	getRollData(item?: unknown): Record<string, unknown>;
}

/** Hit dice record entry type */
interface HitDiceEntry {
	current: number;
	origin: string[];
	bonus?: number;
}

/** Interface for character actors used by managers */
declare interface NimbleCharacterInterface extends NimbleBaseActorInterface {
	type: 'character';
	classes: Record<string, NimbleClassItem>;
	update(changes: Record<string, unknown>): Promise<NimbleCharacterInterface | undefined>;
	applyHealing(healing: number, healingType?: string): Promise<void>;
	system: {
		abilities: {
			strength: { mod: number };
			dexterity: { mod: number };
			intelligence: { mod: number };
			will: { mod: number };
		};
		attributes: {
			hp: {
				max: number;
				value: number;
				temp: number;
			};
			hitDice: Record<string, HitDiceEntry>;
			wounds: {
				value: number;
			};
		};
		resources: {
			mana: {
				current: number;
				max: number;
			};
		};
	};
}
