import { tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { CardEvent, EndedEffectRow } from '#types/cardEvent.d.ts';
import { cardEventsOf } from '#utils/chat/cardEvents.js';
import { undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
import localize from '#utils/localize.js';

const EFFECT_HOOKS = ['createActiveEffect', 'deleteActiveEffect'] as const;

/** The Events strip of a chat card: its lines, and the Undo of an ended effect. */
export function createCardEventsState(getMessage: () => NimbleChatMessage) {
	// An effect made or deleted on any client changes whether "On <name>" shows.
	const subscribeEffects = createSubscriber((update) => {
		const ids = EFFECT_HOOKS.map((hook) => ({
			hook,
			id: Hooks.on(hook as never, update as never),
		}));
		return () => {
			for (const { hook, id } of ids) Hooks.off(hook as never, id);
		};
	});

	const events = $derived(cardEventsOf(getMessage().reactive));
	const busy = $state<Record<string, boolean>>({});
	let focusOnBack: string | null = null;

	function holderOf(row: EndedEffectRow): Actor | null {
		return fromUuidSync(row.holderUuid as never, { strict: false }) as Actor | null;
	}

	function isBack(row: EndedEffectRow): boolean {
		subscribeEffects();
		return !!holderOf(row)?.effects?.get(row.effectId);
	}

	function canUndo(row: EndedEffectRow): boolean {
		return !!game.user?.isGM || !!holderOf(row)?.isOwner;
	}

	async function undo(event: CardEvent, row: EndedEffectRow) {
		if (busy[event.id]) return;
		busy[event.id] = true;
		focusOnBack = event.id;
		try {
			const restored = await undoEndedEffect(row).catch((error) => {
				console.error('Nimble | Could not undo an ended effect.', error);
				return false;
			});
			if (!restored) {
				ui.notifications?.warn(
					localize('NIMBLE.lastsUntil.chat.undoFailed', {
						effect: row.name,
						name: row.holderName,
					}),
				);
			}
			await tick();
		} finally {
			busy[event.id] = false;
			focusOnBack = null;
		}
	}

	/** The "On <name>" line takes the focus from the Undo button it replaces. */
	function backStatus(eventId: string) {
		return (element: HTMLElement) => {
			if (focusOnBack !== eventId) return;
			focusOnBack = null;
			element.focus();
		};
	}

	return {
		get events() {
			return events;
		},
		isBusy: (eventId: string) => busy[eventId] ?? false,
		isBack,
		canUndo,
		undo,
		backStatus,
	};
}
