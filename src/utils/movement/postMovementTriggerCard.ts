export interface MovementTriggerCardInput {
	actor: Actor;
	item: { uuid: string | null; name: string | null; img?: string | null };
	/** Speaker token. When undefined, the actor's first active token speaks. */
	token?: TokenDocument | null;
	/** 'use' shows a button to use the item; 'reminder' only states the message. */
	payload: 'use' | 'reminder';
	/** Already resolved, plain text. */
	message: string;
	/** Token uuids the trigger found. */
	targets: string[];
	moverName: string;
	spaces: number;
	spacesThisTurn: number | null;
}

function firstActiveToken(actor: Actor): TokenDocument | null {
	const token = actor.getActiveTokens()[0] as { document?: TokenDocument } | undefined;
	return token?.document ?? null;
}

/** Posts a card that lets the owner use an item after a Movement, or reminds the table of it. */
export async function postMovementTriggerCard(
	input: MovementTriggerCardInput,
): Promise<ChatMessage | null> {
	const { actor, item } = input;
	const token = input.token === undefined ? firstActiveToken(actor) : input.token;

	const chatData = {
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor, token }),
		type: 'movementTrigger',
		system: {
			actorName: actor.name ?? '',
			actorType: actor.type ?? '',
			image: item.img || 'icons/svg/item-bag.svg',
			permissions: actor.permission ?? 0,
			rollMode: 0,
			name: item.name ?? '',
			itemUuid: item.uuid ?? '',
			payload: input.payload,
			message: input.message,
			targets: [...input.targets],
			moverName: input.moverName,
			spaces: input.spaces,
			spacesThisTurn: input.spacesThisTurn,
		},
	};

	return (await ChatMessage.create(chatData as unknown as ChatMessage.CreateData)) ?? null;
}
