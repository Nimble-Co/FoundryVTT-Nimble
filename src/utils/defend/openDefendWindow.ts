import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';
import type { DefendChoice, DefendWindowData } from '#types/components/DefendDialog.d.ts';
import { spendBaselineInterpose } from '../../view/chat/components/spendBaselineInterpose.js';
import DefendDialog from '../../view/dialogs/DefendDialog.svelte';
import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '../incomingReactions/getHeroicReactionUsageState.js';
import { requestIncomingAttackReaction } from '../incomingReactions/incomingAttackReactions.js';
import resolveHeroicReactionActionCost from '../incomingReactions/resolveHeroicReactionActionCost.js';
import showReactionConfirmation from '../incomingReactions/showReactionConfirmation.js';
import localize from '../localize.js';
import { type DefendReactor, defendReactors } from './defendReactors.js';
import { requestDefend } from './defendRequests.js';

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
	const system = card.system as { name?: string; spellName?: string } | undefined;
	return system?.name || system?.spellName || card.flavor || '';
}

/** What the window shows for one hero. Exported for tests. */
export function defendWindowData(
	card: NimbleChatMessage,
	reactor: DefendReactor,
): DefendWindowData {
	const { actor } = reactor;
	const combat = game.combat ?? null;
	const combatant = combatantOf(combat, actor, reactor.targetTokenUuid);
	const usage =
		combat && combatant
			? getHeroicReactionUsageState({ combat, combatant, reactionKeys: ['defend'] })
			: null;
	const armor = armorOf(actor);
	const cost = resolveHeroicReactionActionCost(
		actor as unknown as Parameters<typeof resolveHeroicReactionActionCost>[0],
		['defend'],
	);
	const heroToken =
		reactor.targetTokenUuid ??
		reactor.interposes.find((entry) => entry.tokenUuid)?.tokenUuid ??
		null;

	const takes: Record<string, number | null> = {};
	const key = (defend: boolean, entryId: string) => `${defend ? 1 : 0}:${entryId}`;
	if (reactor.targetTokenUuid) {
		takes[key(false, '')] = card.previewDamageFor(reactor.targetTokenUuid, 0);
		takes[key(true, '')] = card.previewDamageFor(reactor.targetTokenUuid, armor);
	}
	for (const entry of reactor.interposes) {
		const token = entry.tokenUuid || heroToken;
		if (!token) continue;
		takes[key(false, entry.id)] = card.previewDamageFor(token, 0);
		takes[key(true, entry.id)] = card.previewDamageFor(token, armor);
	}

	const blocked = usage && !usage.canUse ? usage.blockedReason : null;
	const blockedNote =
		blocked === 'spent' || blocked === 'noActions' || blocked === 'activeTurn'
			? localize(`NIMBLE.chat.defend.blocked.${blocked}`)
			: '';

	const attack = cardName(card);
	const ownDamage = reactor.targetTokenUuid ? takes[key(false, '')] : null;
	return {
		heroName: actor.name ?? '',
		heading:
			reactor.targetTokenUuid && ownDamage !== null && ownDamage !== undefined
				? localize('NIMBLE.chat.defend.heading', {
						attack,
						name: actor.name ?? '',
						damage: String(ownDamage),
					})
				: localize('NIMBLE.chat.defend.headingProtector', { attack }),
		isTarget: reactor.targetTokenUuid !== null,
		ways: [
			{
				id: 'defend',
				name: localize('NIMBLE.chat.defend.plainDefend'),
				note: localize('NIMBLE.chat.defend.plainDefendNote', {
					actions: actionsText(cost),
					armor: String(armor),
				}),
			},
		],
		interposes: reactor.interposes.map((entry) => ({
			entryId: entry.id,
			label: localize('NIMBLE.chat.defend.interposeFor', {
				name: nameOfToken(entry.targetTokenUuid),
			}),
			note: localize('NIMBLE.chat.defend.interposeNote', {
				actions: actionsText(
					entry.source === 'baseline'
						? resolveHeroicReactionActionCost(
								actor as unknown as Parameters<typeof resolveHeroicReactionActionCost>[0],
								['interpose'],
							)
						: 0,
				),
			}),
		})),
		blockedNote,
		takes,
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

/** Open the Defend window for one hero on an attack card, then do what the player picked. */
export async function openDefendWindow(
	card: NimbleChatMessage,
	actor: Actor.Implementation,
): Promise<void> {
	const reactor = defendReactors(card as never).find((each) => each.actor.uuid === actor.uuid);
	if (!reactor || reactor.defend) return;

	const data = defendWindowData(card, reactor);
	const dialog = new ChoiceDialog<DefendChoice>(actor, {
		component: DefendDialog,
		icon: 'fa-solid fa-shield-halved',
		title: localize('NIMBLE.chat.defend.windowTitle', { name: actor.name ?? '' }),
		data: { data },
	});
	await dialog.render(true);
	const choice = await dialog.promise;
	if (!choice || (!choice.defend && !choice.interposeEntryId)) return;

	const combat = (game.combat ?? null) as ReactionCombat | null;
	let defendedToken = reactor.targetTokenUuid;

	if (choice.interposeEntryId) {
		const entry = reactor.interposes.find((each) => each.id === choice.interposeEntryId);
		if (!entry) return;
		if (entry.source === 'baseline' && !(await spendBaselineInterpose(entry))) return;
		const sent = await requestIncomingAttackReaction({
			messageId: card.id ?? '',
			entryId: entry.id,
		});
		if (!sent) return;
		defendedToken = entry.tokenUuid || null;
		if (choice.defend && defendedToken && !(await waitForTarget(card, defendedToken))) return;
	}

	if (!choice.defend || !defendedToken) return;

	const combatant = combatantOf(combat, actor, defendedToken);
	const paid = await spendDefend(combat, combatant);
	if (!paid) return;

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
}
