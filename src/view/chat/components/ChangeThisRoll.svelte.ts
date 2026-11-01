import { tick } from 'svelte';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { IncomingReactionPicking } from '#types/components/IncomingReactionPrompts.d.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import { checkResultOfCard } from '#utils/rolls/checkResult.ts';
import type { PickableDie } from '../../../dice/oneDieReroll.ts';
import { claimEscape } from './claimEscape.ts';

/** Each user's own open or close, by message id: a card renders again on every update. */
const openChoices = new Map<string, boolean>();

/** The row a click used, by message id, while its result can still take the focus away. */
const focusReturns = new Map<string, { entryId: string; until: number }>();
const FOCUS_RETURN_DURATION = 10_000;

interface ChangeThisRollInput {
	/** The rows this user can click. */
	count: number;
	picking: IncomingReactionPicking | null;
	useEntry: (entry: IncomingReactionEntry) => Promise<void>;
	pickDie: (die: PickableDie) => Promise<void>;
	pickValue: (value: number) => Promise<void>;
	pickStat: (stat: string) => Promise<void>;
	/** Closes the die picker. Returns the id of the entry it was open for. */
	cancelPick: () => string | null;
}

/**
 * A card that says Failed, an attack that misses and an Initiative card show the
 * rows with no click. Initiative has rows only when a change can help.
 */
function opensByItself(message: NimbleChatMessage | undefined): boolean {
	const card = message?.reactive;
	const system = card?.system as unknown as Record<string, unknown> | undefined;
	if (!card || !system) return false;
	if (system.isMiss === true && system.isCritical !== true) return true;
	if (card.type === 'initiative') return true;
	return checkResultOfCard(card.type, system, card.rolls?.[0]) === 'failed';
}

export function createChangeThisRollState(
	message: NimbleChatMessage | undefined,
	getInput: () => ChangeThisRollInput,
) {
	const messageKey = message?.id ?? '';
	const elements = $state<{ anchor?: HTMLElement; toggle?: HTMLElement; list?: HTMLElement }>({});
	let choice = $state(openChoices.get(messageKey));

	const count = $derived(getInput().count);
	const open = $derived(count > 0 && (choice ?? opensByItself(message)));

	function setOpen(next: boolean): void {
		choice = next;
		if (messageKey) openChoices.set(messageKey, next);
	}

	function rowButtons(): HTMLButtonElement[] {
		return [...(elements.list?.querySelectorAll<HTMLButtonElement>('[data-entry-id]') ?? [])];
	}

	function rowButton(entryId: string | null): HTMLButtonElement | undefined {
		return rowButtons().find((row) => row.dataset.entryId === entryId);
	}

	function cancelOpenPick(): void {
		const { picking, cancelPick } = getInput();
		if (picking && !picking.rolling) cancelPick();
	}

	async function toggle(): Promise<void> {
		if (open) cancelOpenPick();
		setOpen(!open);
		if (!open) return;
		await tick();
		elements.list?.scrollIntoView?.({ block: 'nearest' });
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!open) return;
		if (claimEscape(event)) {
			cancelOpenPick();
			setOpen(false);
			elements.toggle?.focus();
			return;
		}

		const rows = rowButtons();
		const current = rows.indexOf(event.target as HTMLButtonElement);
		if (current === -1 && event.target !== elements.toggle) return;
		const last = rows.length - 1;
		const next = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		rows[next]?.focus();
	}

	function expectFocusLoss(entryId: string): void {
		if (messageKey) {
			focusReturns.set(messageKey, { entryId, until: Date.now() + FOCUS_RETURN_DURATION });
		}
	}

	function cardElement(): HTMLElement | null {
		const card = elements.anchor?.closest<HTMLElement>('.nimble-chat-card') ?? null;
		if (card) card.tabIndex = -1;
		return card;
	}

	/**
	 * After a click whose result took the focused element away, also in a new
	 * draw of the card: the row if it came back, else the button, else the card.
	 * A focus the user moved elsewhere stays there.
	 */
	function restoreFocus(): void {
		const expected = focusReturns.get(messageKey);
		if (!expected) return;
		if (Date.now() > expected.until) {
			focusReturns.delete(messageKey);
			return;
		}
		if (document.activeElement && document.activeElement !== document.body) return;
		const { anchor } = elements;
		if (!anchor) return;
		// A new draw of the card runs this before core puts it in the page.
		if (!anchor.isConnected) {
			requestAnimationFrame(restoreFocus);
			return;
		}
		const target = rowButton(expected.entryId) ?? elements.toggle ?? cardElement();
		target?.focus({ preventScroll: true });
	}

	async function useEntry(entry: IncomingReactionEntry): Promise<void> {
		const { picking, cancelPick, useEntry: use } = getInput();
		if (picking && !picking.rolling) {
			cancelPick();
			if (picking.entry.id === entry.id) return;
		}
		expectFocusLoss(entry.id);
		await use(entry);
		await tick();
		restoreFocus();
	}

	function pickDie(die: PickableDie): void {
		const { picking, pickDie: pick } = getInput();
		if (picking) expectFocusLoss(picking.entry.id);
		void pick(die);
	}

	function pickValue(value: number): void {
		const { picking, pickValue: pick } = getInput();
		if (picking) expectFocusLoss(picking.entry.id);
		void pick(value);
	}

	function pickStat(stat: string): void {
		const { picking, pickStat: pick } = getInput();
		if (picking) expectFocusLoss(picking.entry.id);
		void pick(stat);
	}

	async function cancelPick(): Promise<void> {
		const entryId = getInput().cancelPick();
		await tick();
		rowButton(entryId)?.focus();
	}

	return {
		elements,
		get count() {
			return count;
		},
		get open() {
			return open;
		},
		toggle,
		onKeydown,
		expectFocusLoss,
		useEntry,
		pickDie,
		pickValue,
		pickStat,
		cancelPick,
		restoreFocus,
	};
}
