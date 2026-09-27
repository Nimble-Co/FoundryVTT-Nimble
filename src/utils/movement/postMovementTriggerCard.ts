export interface MovementTriggerCardInput {
	actor: Actor;
	item: { uuid: string | null; name: string | null; img?: string | null };
	/** The speaker. */
	token: TokenDocument;
	/** Already resolved, plain text. */
	message: string;
	/** Token uuids the trigger found. */
	targets: string[];
	moverName: string;
	spaces: number;
	spacesThisTurn: number | null;
}

/** Posts a card that lets the owner use an item after a Movement. */
export async function postMovementTriggerCard(
	input: MovementTriggerCardInput,
): Promise<ChatMessage | null> {
	const { actor, item, token } = input;

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
			message: input.message,
			targets: [...input.targets],
			moverName: input.moverName,
			spaces: input.spaces,
			spacesThisTurn: input.spacesThisTurn,
		},
	};

	return (await ChatMessage.create(chatData as unknown as ChatMessage.CreateData)) ?? null;
}
