/**
 * Type declarations for Nimble actor types to prevent circular dependencies
 */

/** Modifier data with optional label */
declare interface NimbleModifierData {
	mod?: number;
}

/** Base actor system data with saving throws */
declare interface NimbleBaseActorSystemData {
	savingThrows: Record<string, NimbleModifierData>;
}

/** Character-specific system data */
declare interface NimbleCharacterSystemData extends NimbleBaseActorSystemData {
	abilities: Record<string, NimbleModifierData>;
	skills: Record<string, NimbleModifierData>;
	attributes: {
		hp: {
			max: number;
		};
		armor: {
			components: Array<{
				mode: string;
				priority: number;
				source: string;
				value: number;
			}>;
		};
		hitDice: Record<
			number,
			{
				bonus?: number;
				origin?: string[];
			}
		>;
	};
}

declare interface NimbleBaseActor extends Actor {
	type: string;
	getDomain(): Set<string>;
	getRollData(item?: Item): Record<string, unknown>;
	system: NimbleBaseActorSystemData;
}

declare interface NimbleCharacter extends NimbleBaseActor {
	type: 'character';
	classes: Record<string, NimbleClassItem>;
	update(changes: Record<string, unknown>): Promise<void>;
	applyHealing(healing: number, healingType?: string): Promise<void>;
	system: NimbleCharacterSystemData;
}
