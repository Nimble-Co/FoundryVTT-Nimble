import type { CardEvent, EventSink } from '#types/cardEvent.d.ts';

/**
 * How long after its card is made an item use still takes lines. A rule that reacts to the use
 * (a pool gain, a move) can finish after the card exists; its line still goes on that card.
 */
const AFTER_CARD_MS = 3000;

interface ActorKey {
	uuid?: string | null;
	id?: string | null;
}

function keyOf(actor: ActorKey | null | undefined): string | null {
	return actor?.uuid || actor?.id || null;
}

/** The open uses of each actor, oldest first. A use made during another use is on top. */
const open = new Map<string, ActivationEvents[]>();

/** The uses of the actor that can still take a line; the others leave the stack. */
function liveStack(key: string): ActivationEvents[] {
	const stack = (open.get(key) ?? []).filter((events) => events.live);
	if (stack.length > 0) open.set(key, stack);
	else open.delete(key);
	return stack;
}

/**
 * The lines of one item use, from before its card exists: they go in the card's create data, so
 * the card is born with them and no other card is posted. Once the card exists, a line goes on it.
 */
export class ActivationEvents {
	readonly #key: string;
	#collected: CardEvent[] = [];
	#taken = false;
	#sink: EventSink | null = null;
	#postedAt: number | null = null;
	#closed = false;

	constructor(key: string) {
		this.#key = key;
	}

	/** Lines are still collected for the card's create data. */
	get collecting(): boolean {
		return !this.#taken && !this.#closed;
	}

	/** Whether a line can still go on the card of this use. */
	get live(): boolean {
		if (this.#closed) return false;
		if (!this.#taken) return true;
		if (!this.#sink || this.#postedAt === null) return false;
		return Date.now() - this.#postedAt <= AFTER_CARD_MS;
	}

	/** Add lines to the use. False when no card of the use can hold them. */
	async add(events: CardEvent[]): Promise<boolean> {
		if (events.length < 1) return true;
		if (this.collecting) {
			this.#collected.push(...events);
			return true;
		}
		if (!this.live || !this.#sink) return false;
		return this.#sink(events);
	}

	/** The lines collected so far, for the card's create data. Later lines go to the sink. */
	take(): CardEvent[] {
		this.#taken = true;
		const events = [...this.#collected].sort((a, b) => a.at - b.at);
		this.#collected = [];
		return events;
	}

	/** The card of the use exists, or the use went on another card as one line. */
	posted(sink: EventSink | null): void {
		this.#taken = true;
		this.#sink = sink;
		this.#postedAt = Date.now();
	}

	/** The use stopped before it had a card; its lines are dropped. */
	close(): void {
		this.#closed = true;
		liveStack(this.#key);
	}
}

/**
 * Start the lines of an item use by this actor. While it is live it takes the lines of the actor;
 * after it, the use it was made in takes them again.
 */
export function openActivationEvents(actor: ActorKey | null | undefined): ActivationEvents | null {
	const key = keyOf(actor);
	if (!key) return null;
	const events = new ActivationEvents(key);
	open.set(key, [...liveStack(key), events]);
	return events;
}

/** The newest item use of this actor that can still take a line, if there is one. */
export function activationEventsOf(actor: ActorKey | null | undefined): ActivationEvents | null {
	const key = keyOf(actor);
	if (!key) return null;
	return liveStack(key).at(-1) ?? null;
}

/** A unique id for a line. */
export function cardEventId(kind: string): string {
	return `${kind}.${foundry.utils.randomID()}`;
}
