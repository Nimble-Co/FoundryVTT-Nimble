import { tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { CardEvent, EndedEffectRow, TurnDamageAction } from '#types/cardEvent.d.ts';
import { actOnStackGain, canActOnStackGain } from '#utils/actor/stackGainLine.js';
import { canChooseTempHp, chooseTempHp } from '#utils/actor/tempHpChoice.js';
import { cardEventsOf } from '#utils/chat/cardEvents.js';
import {
	canActOnTurnDamage,
	takeTurnDamage,
	undoTurnDamage,
} from '#utils/damage/turnDamageLine.js';
import { canEmptyPool, emptyPoolFromLine } from '#utils/dicePool/emptyPoolLine.js';
import { undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
import { canEndWaiting, endWaiting } from '#utils/lastsUntil/endWaiting.js';
import { canRuleEscape, endEscape } from '#utils/lastsUntil/escapeFollow.js';
import { actOnZeroHp, canActOnZeroHp } from '#utils/lastsUntil/zeroHpAtEnd.js';
import localize from '#utils/localize.js';
import { canSettleCritDiceLine, settleCritDiceLine } from '#utils/rolls/critDiceSaveLine.js';
import { canRollRequest, rollRequestedSave } from '#utils/saveRequest/saveRequests.js';

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

	function rollSave(event: CardEvent) {
		return clickLine(event, rollRequestedSave);
	}

	function rule(event: CardEvent) {
		return clickLine(event, endEscape);
	}

	function choose(event: CardEvent, take: boolean) {
		return clickLine(event, (card, line) => chooseTempHp(card, line, take));
	}

	/** Deals a waiting line, or gives back what a dealt line took. */
	function actOnDamage(event: CardEvent) {
		const action = event.action as TurnDamageAction;
		const run = action.state === 'waiting' ? takeTurnDamage : undoTurnDamage;
		return clickLine(event, run, 'Nimble | Could not change the damage of a turn.');
	}

	/** Puts a waiting effect on, or takes a gained one off. */
	function actOnStack(event: CardEvent) {
		return clickLine(
			event,
			actOnStackGain,
			'Nimble | Could not change the effect of a stack count.',
		);
	}

	/** One click on a line at a time. With `failure`, a failed click is logged. */
	async function clickLine(
		event: CardEvent,
		run: (card: never, event: CardEvent) => Promise<unknown>,
		failure?: string,
	) {
		if (busy[event.id]) return;
		busy[event.id] = true;
		try {
			const done = run(getMessage() as never, event);
			await (failure ? done.catch((error) => console.error(failure, error)) : done);
		} finally {
			busy[event.id] = false;
		}
	}

	/** Drops a waiting line to 0 HP, or gives back the HP a dropped line took. */
	function actOnZero(event: CardEvent) {
		return clickLine(event, actOnZeroHp, 'Nimble | Could not change the 0 HP of an ended effect.');
	}

	/** Ends a waiting effect through the end path of its moment. */
	function end(event: CardEvent) {
		return clickLine(event, endWaiting, 'Nimble | Could not end a waiting effect.');
	}

	function empty(event: CardEvent) {
		return clickLine(event, emptyPoolFromLine, 'Nimble | Could not empty a pool.');
	}

	function settleCrit(event: CardEvent) {
		return clickLine(
			event,
			settleCritDiceLine,
			'Nimble | Could not change the dice or the use of a crit dice save.',
		);
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
		canRollSave: canRollRequest,
		rollSave,
		canRule: canRuleEscape,
		rule,
		canChoose: canChooseTempHp,
		choose,
		canActOnDamage: canActOnTurnDamage,
		actOnDamage,
		canActOnStack: canActOnStackGain,
		actOnStack,
		canEnd: canEndWaiting,
		end,
		canEmpty: canEmptyPool,
		empty,
		canSettleCrit: canSettleCritDiceLine,
		settleCrit,
		canActOnZero: canActOnZeroHp,
		actOnZero,
		backStatus,
	};
}
