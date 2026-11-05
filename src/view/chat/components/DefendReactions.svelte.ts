import { createSubscriber } from 'svelte/reactivity';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import { registerCombatStateHooks } from '#utils/combat/combatState.js';
import {
	type AllyDefendOffer,
	allyDefendOffers,
	useAllyDefendOffer,
} from '#utils/defend/allyDefendOffers.js';
import {
	attackCannotBeDefended,
	canReactFor,
	defendReactors,
} from '#utils/defend/defendReactors.js';
import { defendsOf } from '#utils/defend/defendRecords.js';
import { openDefendWindow } from '#utils/defend/openDefendWindow.js';

/** The Reactions section of an attack card: hero buttons, ally buttons and reminder lines. */
export function createDefendReactionsState(getMessage: () => NimbleChatMessage) {
	const isGM = game.user?.isGM === true;
	// game.combat is the tracker's viewed combat: it changes when the tracker renders.
	const subscribeCombat = createSubscriber((update) => {
		const off = registerCombatStateHooks(update);
		const trackerHook = Hooks.on('renderCombatTracker', update);
		return () => {
			off();
			Hooks.off('renderCombatTracker', trackerHook);
		};
	});

	const card = $derived({
		system: getMessage()?.reactive?.system,
		speaker: getMessage()?.speaker,
	});
	const inCombat = $derived.by(() => {
		subscribeCombat();
		return game.combat?.started === true;
	});
	const blocked = $derived(attackCannotBeDefended(card));
	const reactors = $derived(
		blocked ? [] : defendReactors(card).filter((reactor) => canReactFor(reactor.actor)),
	);
	const open = $derived(inCombat ? reactors.filter((reactor) => !reactor.defend) : []);
	const reminders = $derived(defendsOf(card.system).flatMap((defend) => defend.reminders));
	const allyOffers = $derived(inCombat && !blocked ? allyDefendOffers(card) : []);
	const solo = $derived(
		!isGM && open.length === 1 && reminders.length === 0 && allyOffers.length === 0,
	);

	let opening = $state<string | null>(null);

	async function once(key: string, run: () => Promise<unknown>) {
		if (opening === key) return;
		opening = key;
		try {
			await run();
		} finally {
			if (opening === key) opening = null;
		}
	}

	return {
		isGM,
		get blocked() {
			return blocked;
		},
		get open() {
			return open;
		},
		get reminders() {
			return reminders;
		},
		get allyOffers() {
			return allyOffers;
		},
		get solo() {
			return solo;
		},
		get showSection() {
			return open.length > 0 || reminders.length > 0 || allyOffers.length > 0;
		},
		get opening() {
			return opening;
		},
		react(actor: Actor.Implementation) {
			return once(actor.uuid ?? '', () => openDefendWindow(getMessage(), actor));
		},
		useAlly(offer: AllyDefendOffer) {
			return once(offer.key, () => useAllyDefendOffer(getMessage().id ?? '', offer));
		},
	};
}
