import type { MovementOfferRef } from '#types/movement.js';

export interface MovementOfferEntry {
	id: string;
	nodeId: string;
	tokenUuid: string;
	spaces: number;
	used: boolean;
	usedBy: string | null;
	movedSpaces: number | null;
	stopped: boolean;
}

export function buildMovementOfferId(ref: MovementOfferRef): string {
	const tokenId = ref.tokenUuid.split('.').at(-1) ?? '';
	return `${ref.messageId}.${ref.nodeId}.${tokenId}`;
}

/** Upserts one entry, keeping whatever an earlier stamp already recorded. */
export function mergeMovementOfferEntry(
	entries: readonly MovementOfferEntry[],
	patch: Partial<MovementOfferEntry> & { id: string },
): MovementOfferEntry[] {
	const existing = entries.find((entry) => entry.id === patch.id);
	const defined = Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	) as Partial<MovementOfferEntry> & { id: string };
	const merged: MovementOfferEntry = {
		nodeId: '',
		tokenUuid: '',
		spaces: 0,
		used: false,
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		...existing,
		...defined,
	};
	return existing
		? entries.map((entry) => (entry.id === patch.id ? merged : entry))
		: [...entries, merged];
}
