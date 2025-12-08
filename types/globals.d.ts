import type { NIMBLE } from '../src/config.js';
import type { SystemActorTypes } from '../src/documents/actor/actorInterfaces.js';
import type { SystemItemTypes } from '../src/documents/item/itemInterfaces.js';
import type { NIMBLE_GAME } from '../src/game.js';

/** Nimble system flags for actors */
declare interface NimbleActorFlags {
	includeCurrencyBulk?: boolean;
	automaticallyExecuteAvailableMacros?: boolean;
}

/** Nimble system flags for items */
interface NimbleItemFlags {
	[key: string]: unknown;
}

declare global {
	/** Alias for foundry.data.fields.DataSchema used in TypeDataModel schema declarations */
	type DataSchema = foundry.data.fields.DataSchema;

	/** Base system data that all actor types share */
	interface NimbleActorSystemData {
		attributes: {
			hp: {
				value: number;
				max: number;
				temp: number;
			};
			sizeCategory?: string;
			initiative?: {
				mod: number;
			};
		};
		abilities?: Record<string, { mod: number; defaultRollMode?: number }>;
		savingThrows?: Record<string, { mod: number; defaultRollMode?: number }>;
		skills?: Record<
			string,
			{ mod: number; points: number; bonus: number; defaultRollMode?: number }
		>;
	}

	/** Interface for Nimble base actor with common methods */
	interface NimbleBaseActor extends Actor {
		initialized?: boolean;
		getDomain(): Set<string>;
		getRollData(item?: unknown): Record<string, unknown>;
		rules?: NimbleBaseRule[];
		tags?: Set<string>;
		isType<TypeName extends SystemActorTypes>(type: TypeName): boolean;
	}

	/** Interface for Nimble base item with common methods */
	interface NimbleBaseItem extends Item {
		identifier: string;
		hasMacro?: boolean;
		rules?: RulesManagerInterface;
		tags?: Set<string>;
		activate?(options?: Record<string, unknown>): Promise<ChatMessage | null>;
		prepareActorData?(): void;
		isType<TypeName extends SystemItemTypes>(
			type: TypeName,
		): this is NimbleBaseItem & {
			type: TypeName;
			system: TypeName extends keyof DataModelConfig['Item']
				? DataModelConfig['Item'][TypeName]
				: object;
		};
	}

	/** ConfiguredInstance type alias for backwards compatibility */
	namespace Actor {
		type ConfiguredInstance = Actor.Implementation;
	}

	namespace Item {
		type ConfiguredInstance = Item.Implementation;
	}

	namespace ChatMessage {
		type ConfiguredInstance = ChatMessage.Implementation;
	}

	interface AssumeHookRan {
		init: never;
	}

	interface AssumeHookRan {
		setup: never;
	}

	interface AssumeHookRan {
		ready: never;
	}

	interface CONFIG {
		NIMBLE: typeof NIMBLE;
	}

	interface Game {
		nimble: typeof NIMBLE_GAME;
	}

	interface FlagConfig {
		Actor: {
			nimble: NimbleActorFlags;
		};
		Item: {
			nimble: NimbleItemFlags;
		};
	}
}

export default (something = {});
