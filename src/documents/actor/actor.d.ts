/**
 * Type declarations for Nimble actor types to prevent circular dependencies
 */

declare interface NimbleBaseActor extends Actor {
	type: string;
	getDomain(): Set<string>;
	getRollData(item?: any): Record<string, any>;
}

declare interface NimbleCharacter extends NimbleBaseActor {
	type: 'character';
	classes: Record<string, NimbleClassItem>;
	update(changes: Record<string, any>): Promise<void>;
	applyHealing(healing: number, healingType?: string): Promise<void>;
	system: {
		attributes: {
			hp: {
				max: number;
			};
		};
	};
}
