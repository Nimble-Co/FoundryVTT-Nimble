import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

interface TriggerSystem {
	name: string;
	image?: string;
	itemUuid: string;
	payload: 'use' | 'reminder';
	message: string;
	targets: string[];
}

interface TriggerItem {
	id: string;
	isOwner: boolean;
	actor?: { activateItem(id: string): Promise<unknown> } | null;
}

interface TargetTokenDocument {
	id: string;
	name: string;
	object?: unknown;
}

interface TriggerMessage {
	reactive: {
		system: unknown;
		author?: { color?: Parameters<typeof calculateHeaderTextColor>[0] } | null;
	};
}

function resolve<T>(uuid: string): T | null {
	if (!uuid) return null;
	return (fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }) ??
		null) as T | null;
}

export function createMovementTriggerCardState(getMessageDocument: () => TriggerMessage) {
	const system = $derived(getMessageDocument().reactive.system as TriggerSystem);
	const headerBackgroundColor = $derived(getMessageDocument().reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const targetTokens = $derived(
		(system.targets ?? [])
			.map((uuid) => resolve<TargetTokenDocument>(uuid))
			.filter((token): token is TargetTokenDocument => token !== null),
	);
	const targetNames = $derived(targetTokens.map((token) => token.name).join(', '));

	const item = $derived(resolve<TriggerItem>(system.itemUuid));
	const canUse = $derived(system.payload === 'use' && item?.isOwner === true);
	let using = $state(false);

	function targetCardTokens(): void {
		const layer = canvas?.tokens;
		if (!layer) return;
		// Only tokens drawn on the viewed scene can be targeted.
		const ids = targetTokens.filter((token) => token.object).map((token) => token.id);
		if (ids.length === 0) return;
		layer.setTargets(ids, { mode: 'replace' });
	}

	async function useItem(): Promise<void> {
		if (using || !item?.actor) return;
		using = true;
		try {
			targetCardTokens();
			await item.actor.activateItem(item.id);
		} catch (error) {
			console.error('Nimble | Failed to use the Movement trigger item:', error);
		} finally {
			using = false;
		}
	}

	return {
		get system() {
			return system;
		},
		get headerBackgroundColor() {
			return headerBackgroundColor;
		},
		get headerTextColor() {
			return headerTextColor;
		},
		get targetNames() {
			return targetNames;
		},
		get canUse() {
			return canUse;
		},
		get using() {
			return using;
		},
		useItem,
	};
}
