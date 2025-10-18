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
	system: any;
}
