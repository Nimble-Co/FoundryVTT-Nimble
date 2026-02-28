type ActorCondition = {
	id: string;
	name: string;
	img: string;
	descriptionHtml: string;
	active: boolean;
	isOverlay: boolean;
};

type ActorWithConditionsMetadata = Actor.Implementation & {
	conditionsMetadata?: {
		active?: Set<string>;
		overlay?: Set<string>;
	};
};

export default function prepareActorConditions(
	actor: Actor.Implementation | null,
): ActorCondition[] {
	if (!actor) return [];

	const actorWithMetadata = actor as ActorWithConditionsMetadata;
	const activeConditions = actorWithMetadata.conditionsMetadata?.active ?? new Set<string>();
	const overlayConditions = actorWithMetadata.conditionsMetadata?.overlay ?? new Set<string>();
	const conditionDescriptions = CONFIG.NIMBLE.conditionDescriptions ?? {};

	const conditions = [...activeConditions].map((conditionId) => {
		const metadata = game.nimble.conditions.get(conditionId);
		const fallbackName = CONFIG.NIMBLE.conditions?.[conditionId] ?? conditionId;
		const fallbackImage = CONFIG.NIMBLE.conditionDefaultImages?.[conditionId] ?? '';

		return {
			id: conditionId,
			name: metadata?.name ?? fallbackName,
			img: metadata?.img ?? fallbackImage,
			descriptionHtml: conditionDescriptions[conditionId] ?? '',
			active: true,
			isOverlay: overlayConditions.has(conditionId),
		};
	});

	return conditions.sort((a, b) => a.name.localeCompare(b.name));
}
