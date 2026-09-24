export interface MovementTriggerCardInput {
	actor: Actor;
	item: Item;
	/** 'offer' shows a button to use the item; 'reminder' only states the message. */
	payload: 'offer' | 'reminder';
	/** Already resolved, plain text. */
	message: string;
	/** Token uuids the trigger found. */
	targets: string[];
	moverName: string;
	spaces: number;
	spacesThisTurn: number;
}

/** Posts a card that says a Movement offers the use of an item, or reminds the table of it. */
export async function postMovementTriggerCard(
	input: MovementTriggerCardInput,
): Promise<ChatMessage | null> {
	const { actor, item } = input;
	const token = (actor.getActiveTokens()[0] as { document?: TokenDocument } | undefined)?.document;

	const chatData = {
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor, token: token ?? null }),
		type: 'movementTrigger',
		system: {
			actorName: actor.name ?? '',
			actorType: actor.type ?? '',
			image: item.img || 'icons/svg/item-bag.svg',
			permissions: actor.permission ?? 0,
			rollMode: 0,
			name: item.name ?? '',
			itemUuid: item.uuid,
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
