import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';
import type {
	DefendChoice,
	DefendOption,
	DefendWindowData,
} from '#types/components/DefendDialog.d.ts';
import { spendBaselineInterpose } from '../../view/chat/components/spendBaselineInterpose.js';
import DefendDialog from '../../view/dialogs/DefendDialog.svelte';
import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '../incomingReactions/getHeroicReactionUsageState.js';
import type { HeroicReactionKey } from '../incomingReactions/heroicActions.js';
import { requestIncomingAttackReaction } from '../incomingReactions/incomingAttackReactions.js';
import resolveHeroicReactionActionCost from '../incomingReactions/resolveHeroicReactionActionCost.js';
import showReactionConfirmation from '../incomingReactions/showReactionConfirmation.js';
import localize from '../localize.js';
import { type DefendReactor, defendReactors } from './defendReactors.js';
import { requestDefend } from './defendRequests.js';
import { type DefendWay, newestDefendCard } from './newestDefendCard.js';

const TEXT = 'NIMBLE.chat.defend';

type ReactionCombat = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: string[],
		options?: { force?: boolean },
	) => Promise<boolean>;
};

function combatantOf(combat: Combat | null, actor: Actor.Implementation, tokenUuid: string | null) {
	if (!combat) return null;
	const token = tokenUuid ? (fromUuidSync(tokenUuid) as TokenDocument | null) : null;
	return (
		(token ? combat.combatants.find((each) => each.tokenId === token.id) : null) ??
		combat.combatants.find((each) => each.actorId === actor.id) ??
		null
	);
}

function actionsText(count: number): string {
	if (count < 1) return localize('NIMBLE.chat.defend.actionsNone');
	return count === 1
		? localize('NIMBLE.chat.defend.actionsOne')
		: localize('NIMBLE.chat.defend.actionsMany', { count: String(count) });
}

function nameOfToken(uuid: string | null | undefined): string {
	const token = uuid ? (fromUuidSync(uuid) as TokenDocument | null) : null;
	return token?.actor?.name || token?.name || '';
}

function armorOf(actor: Actor.Implementation): number {
	const value = Number(foundry.utils.getProperty(actor, 'system.attributes.armor.value'));
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function cardName(card: NimbleChatMessage): string {
	const system = card.system as
		| { name?: string; spellName?: string; groupLabel?: string; actorName?: string }
		| undefined;
	const name = card.isMinionGroupAttackCard()
		? system?.groupLabel || system?.actorName
		: system?.name || system?.spellName || card.flavor;
	return (name || '').replace(/[.\s]+$/, '');
}

function costOf(actor: Actor.Implementation, keys: HeroicReactionKey[]): number {
	return resolveHeroicReactionActionCost(
		actor as unknown as Parameters<typeof resolveHeroicReactionActionCost>[0],
		keys,
	);
}

/** What the window shows for one hero. Exported for tests. */
export function defendWindowData(
	card: NimbleChatMessage,
	reactor: DefendReactor,
): DefendWindowData {
	const { actor } = reactor;
	const armor = armorOf(actor);
	const defendCost = costOf(actor, ['defend']);
	const options: DefendOption[] = [];

	if (reactor.targetTokenUuid) {
		const before = card.previewDamageFor(reactor.targetTokenUuid, 0);
		options.push({
			id: 'defend',
			title: localize(`${TEXT}.confirmDefend`),
			cost: localize(`${TEXT}.defendCost`, {
				actions: actionsText(defendCost),
				armor: String(armor),
			}),
			confirm: localize(`${TEXT}.confirmDefend`),
			before,
			takes: card.previewDamageFor(reactor.targetTokenUuid, armor),
			defend: true,
			interposeEntryId: null,
		});
	}

	const named = reactor.interposes.length > 1;
	for (const entry of reactor.interposes) {
		const name = nameOfToken(entry.targetTokenUuid);
		const interposeCost = entry.source === 'baseline' ? costOf(actor, ['interpose']) : 0;
		const token = entry.tokenUuid || reactor.targetTokenUuid;
		const before = token ? card.previewDamageFor(token, 0) : null;
		options.push({
			id: `interpose:${entry.id}`,
			title: named
				? localize(`${TEXT}.interposeFor`, { name })
				: localize(`${TEXT}.confirmInterpose`),
			cost: actionsText(interposeCost),
			confirm: localize(`${TEXT}.confirmInterpose`),
			before: null,
			takes: before,
			defend: false,
			interposeEntryId: entry.id,
		});
		options.push({
			id: `both:${entry.id}`,
			title: named
				? localize(`${TEXT}.interposeForAndDefend`, { name })
				: localize(`${TEXT}.confirmBoth`),
			cost: localize(`${TEXT}.defendCost`, {
				actions: actionsText(interposeCost + defendCost),
				armor: String(armor),
			}),
			confirm: localize(`${TEXT}.confirmBoth`),
			before,
			takes: token ? card.previewDamageFor(token, armor) : null,
			defend: true,
			interposeEntryId: entry.id,
		});
	}

	const hitToken = reactor.targetTokenUuid ?? reactor.interposes[0]?.targetTokenUuid ?? null;
	const hitDamage = hitToken ? card.previewDamageFor(hitToken, 0) : null;
	const attack = cardName(card);
	const name = nameOfToken(hitToken);
	return {
		heading:
			hitDamage === null
				? localize(`${TEXT}.headingNoDamage`, { attack, name })
				: localize(`${TEXT}.heading`, { attack, name, damage: String(hitDamage) }),
		options,
	};
}

async function spendDefend(
	combat: ReactionCombat | null,
	combatant: Combatant.Implementation | null,
): Promise<{ previousActions: number | null } | null> {
	if (!combat?.started || !combat.useHeroicReactions || !combatant?.id) {
		return { previousActions: null };
	}
	const previousActions = Number(
		foundry.utils.getProperty(combatant, 'system.actions.base.current') ?? 0,
	);
	if (await combat.useHeroicReactions(combatant.id, ['defend'])) return { previousActions };

	const usage = getHeroicReactionUsageState({ combat, combatant, reactionKeys: ['defend'] });
	if (!isSoftBlockedReason(usage.blockedReason)) return null;
	const label = localize('NIMBLE.ui.heroicActions.reactionLabels.defend');
	const confirmed = await showReactionConfirmation({
		reactionName: label,
		spentReactionNames: label,
		noActions: usage.blockedReason === 'noActions',
		hasSpentReactions: usage.blockedReason === 'spent',
		isActiveTurn: usage.blockedReason === 'activeTurn',
	});
	if (!confirmed) return null;
	return (await combat.useHeroicReactions(combatant.id, ['defend'], { force: true }))
		? { previousActions }
		: null;
}

/** Wait until the card lists the token as a target (the GM writes an Interpose). */
function waitForTarget(
	card: NimbleChatMessage,
	tokenUuid: string,
	timeout = 5000,
): Promise<boolean> {
	const has = () =>
		((game.messages?.get(card.id ?? '')?.system as { targets?: string[] })?.targets ?? []).includes(
			tokenUuid,
		);
	if (has()) return Promise.resolve(true);
	return new Promise((resolve) => {
		const hookId = Hooks.on('updateChatMessage', (message: ChatMessage) => {
			if (message.id !== card.id || !has()) return;
			Hooks.off('updateChatMessage', hookId);
			clearTimeout(timer);
			resolve(true);
		});
		const timer = setTimeout(() => {
			Hooks.off('updateChatMessage', hookId);
			resolve(has());
		}, timeout);
	});
}

function firstOf(data: DefendWindowData, way: DefendWay): string | undefined {
	const prefix = way === 'defend' ? 'defend' : `${way}:`;
	return data.options.find((option) => option.id.startsWith(prefix))?.id;
}

/**
 * Open the Defend window for one hero on an attack card, then do what the player
 * picked. `way` picks its first row. Returns true when the hero reacted.
 */
export async function openDefendWindow(
	card: NimbleChatMessage,
	actor: Actor.Implementation,
	way: DefendWay | null = null,
): Promise<boolean> {
	const reactor = defendReactors(card as never).find((each) => each.actor.uuid === actor.uuid);
	if (!reactor || reactor.defend) return false;

	const data = defendWindowData(card, reactor);
	if (way) data.picked = firstOf(data, way);
	const dialog = new ChoiceDialog<DefendChoice>(actor, {
		component: DefendDialog,
		icon: 'fa-solid fa-shield-halved',
		title: localize('NIMBLE.chat.defend.windowTitle', { name: actor.name ?? '' }),
		data: { data },
	});
	await dialog.render(true);
	const choice = await dialog.promise;
	if (!choice || (!choice.defend && !choice.interposeEntryId)) return false;

	const combat = (game.combat ?? null) as ReactionCombat | null;
	let defendedToken = reactor.targetTokenUuid;

	if (choice.interposeEntryId) {
		const entry = reactor.interposes.find((each) => each.id === choice.interposeEntryId);
		if (!entry) return false;
		if (entry.source === 'baseline' && !(await spendBaselineInterpose(entry))) return false;
		const sent = await requestIncomingAttackReaction({
			messageId: card.id ?? '',
			entryId: entry.id,
		});
		if (!sent) return false;
		defendedToken = entry.tokenUuid || null;
		if (!choice.defend) return true;
		if (defendedToken && !(await waitForTarget(card, defendedToken))) return true;
	}

	if (!choice.defend || !defendedToken) return Boolean(choice.interposeEntryId);

	const combatant = combatantOf(combat, actor, defendedToken);
	const paid = await spendDefend(combat, combatant);
	if (!paid) return Boolean(choice.interposeEntryId);

	await requestDefend({
		messageId: card.id ?? '',
		tokenUuid: defendedToken,
		actorUuid: actor.uuid ?? '',
		armor: armorOf(actor),
		label: '',
		combatantId: combatant?.id ?? '',
		previousActions: paid.previousActions,
		reactionKeys: ['defend'],
	});
	return true;
}

/**
 * Open the Defend window on the newest attack card of the running combat where the
 * hero can react in that way. Returns null when there is no such card.
 */
export async function openDefendWindowOnNewestCard(
	actor: Actor.Implementation,
	way: DefendWay,
): Promise<boolean | null> {
	const combat = game.combat;
	if (!combat?.started) return null;
	const since = Number(foundry.utils.getProperty(combat, '_stats.createdTime') ?? 0);
	const cards = (game.messages?.contents ?? []) as unknown as NimbleChatMessage[];
	const card = newestDefendCard(cards, actor, way, since);
	return card ? openDefendWindow(card, actor, way) : null;
}
