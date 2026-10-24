<script lang="ts">
	import type { IncomingReactionPromptsProps } from '#types/components/IncomingReactionPrompts.d.ts';
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { IncomingReactionEntry, RerollRecord } from '#utils/incomingReactionEntry.ts';

	import { getContext } from 'svelte';
	import PoolSpendOfferDialog from '#documents/dialogs/PoolSpendOfferDialog.svelte.ts';
	import { confirmRerollHeroicReaction } from './confirmRerollHeroicReaction.js';
	import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
	import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
	import {
		getHeroicReactionUsageState,
		isSoftBlockedReason,
	} from '#utils/getHeroicReactionUsageState.js';
	import {
		INCOMING_REACTION_REJECTED_HOOK,
		type IncomingReactionRejection,
		requestIncomingAttackReaction,
	} from '#utils/incomingAttackReactions.js';
	import localize from '../../../utils/localize.js';
	import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
	import DieFace from '../../components/DieFace.svelte';
	import { getIncomingReactionCost } from './incomingReactionCost.ts';
	import { isRerollAgain, rerollAgainRecords, rerollHistoryLines } from './rerollHistoryLines.ts';

	interface ActorGroup {
		actorUuid: string;
		name: string;
		entries: IncomingReactionEntry[];
	}

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let { place }: IncomingReactionPromptsProps = $props();

	let busy = $state(false);

	/**
	 * Offers whose request has been handed off but whose result has not come
	 * back yet. For a player the request is a socket emit, so it returns long
	 * before the GM writes `used: true`; leaving the offer clickable in that
	 * window lets a second confirm read the same unspent pool and fold the
	 * bonus twice for one set of dice.
	 *
	 * A refusal releases the hold as soon as it reaches us, so the button comes
	 * back with an explanation rather than in silence. The timer is the fallback
	 * for a refusal that never arrives (the GM disconnecting mid-request). The
	 * executor holds its own lock for the correctness half of this.
	 */
	const SPEND_HOLD_DURATION = 10_000;
	let heldEntryIds = $state(new Set<string>());

	let speakerUuid = $derived(
		(messageDocument as { speakerActor?: { uuid?: string } | null })?.speakerActor?.uuid ?? '',
	);
	let storedEntries = $derived(
		(messageDocument?.reactive?.system as { incomingReactions?: IncomingReactionEntry[] })
			?.incomingReactions ?? [],
	);
	// Old cards can still hold the legacy `forceReroll` kind. Nothing resolves a
	// waiting one, and a used one wrote no reroll record, so it keeps its old line.
	let entries = $derived(storedEntries.filter((entry) => entry.kind !== 'forceReroll'));
	let legacyRerollLines = $derived(
		place === 'roll'
			? storedEntries
					.filter((entry) => entry.kind === 'forceReroll' && entry.used)
					.map((entry) => ({
						id: entry.id,
						text: localize('NIMBLE.chat.incomingReactions.rerolledBy', {
							label: entry.label || (getReactingActor(entry)?.name ?? ''),
						}),
					}))
			: [],
	);
	let placeEntries = $derived(
		entries.filter((entry) => changesTheRoll(entry) === (place === 'roll')),
	);
	let pendingGroups = $derived(
		groupByActor(
			placeEntries.filter(
				(entry) => !entry.used && !heldEntryIds.has(entry.id) && canUseEntry(entry),
			),
		),
	);
	// A used reroll is told by the card's history line, not by its entry.
	let usedEntries = $derived(placeEntries.filter((entry) => entry.used && entry.kind !== 'reroll'));
	let rerolls = $derived(
		(messageDocument?.reactive?.system as { rerolls?: RerollRecord[] })?.rerolls ?? [],
	);
	let historyLines = $derived(
		place === 'roll'
			? rerollHistoryLines({
					records: rerolls,
					speakerUuid,
					rerollAgain: rerollAgainRecords(
						rerolls,
						pendingGroups.flatMap((group) => group.entries),
					),
					documentName: getDocumentName,
				})
			: [],
	);

	$effect(() => {
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: (rejection: IncomingReactionRejection) => void) => number;
			off: (hook: string, id: number) => void;
		};
		const hookId = hooksApi.on(INCOMING_REACTION_REJECTED_HOOK, (rejection) => {
			if (rejection.messageId !== messageDocument?.id) return;
			releaseEntry(rejection.entryId);
		});
		return () => hooksApi.off(INCOMING_REACTION_REJECTED_HOOK, hookId);
	});

	function changesTheRoll(entry: IncomingReactionEntry): boolean {
		return entry.kind === 'reroll';
	}

	function getReactingActor(entry: IncomingReactionEntry) {
		return (fromUuidSync(entry.actorUuid) ?? null) as Actor.Implementation | null;
	}

	function canUseEntry(entry: IncomingReactionEntry): boolean {
		const actor = getReactingActor(entry);
		if (!game.user?.isGM && !actor?.isOwner) return false;
		// A reroll the card no longer allows (outcome, side, cost) is hidden.
		if (entry.kind === 'reroll') return messageDocument?.canStillUseReroll(entry) ?? false;
		return true;
	}

	function getSourceItemName(entry: IncomingReactionEntry): string {
		return entry.itemUuid ? getDocumentName(entry.itemUuid) : '';
	}

	function getDocumentName(uuid: string): string {
		return ((fromUuidSync(uuid) as { name?: string } | null)?.name ?? '').trim();
	}

	function getEntryLabel(entry: IncomingReactionEntry): string {
		if (isRerollAgain(entry, rerolls)) return localize('NIMBLE.chat.incomingReactions.rerollAgain');
		if (changesTheRoll(entry)) {
			return localize('NIMBLE.chat.incomingReactions.rerollWith', {
				feature: getSourceItemName(entry) || entry.label,
			});
		}
		// Prefer the feature's own name over the rule label, which is written
		// for the rules builder, not for players.
		if (entry.kind === 'spendPoolForDamage') {
			const heading = localize('NIMBLE.chat.incomingReactions.spendPoolForDamage');
			const featureName = getSourceItemName(entry);
			return featureName ? `${heading}: ${featureName}` : heading;
		}
		const heading = localize('NIMBLE.chat.incomingReactions.interpose');
		return entry.source === 'rule' && entry.label ? `${heading}: ${entry.label}` : heading;
	}

	function getEntryCost(entry: IncomingReactionEntry): string {
		return getIncomingReactionCost(entry, getReactingActor(entry));
	}

	/** One group per actor, in the order the card lists them. */
	function groupByActor(list: IncomingReactionEntry[]): ActorGroup[] {
		const groups = new Map<string, ActorGroup>();
		for (const entry of list) {
			let group = groups.get(entry.actorUuid);
			if (!group) {
				// The card's header already names the one who rolled.
				group = {
					actorUuid: entry.actorUuid,
					name: entry.actorUuid === speakerUuid ? '' : (getReactingActor(entry)?.name ?? '').trim(),
					entries: [],
				};
				groups.set(entry.actorUuid, group);
			}
			group.entries.push(entry);
		}
		return [...groups.values()];
	}

	function getEntryIcon(entry: IncomingReactionEntry): string {
		if (changesTheRoll(entry)) return 'fa-solid fa-rotate-left';
		if (entry.kind === 'spendPoolForDamage') return 'fa-solid fa-dice-d6';
		return 'fa-solid fa-shield-heart';
	}

	function getEntryTooltip(entry: IncomingReactionEntry): string | null {
		if (entry.source !== 'rule' || !entry.itemUuid) return null;
		const item = fromUuidSync(entry.itemUuid) as { name?: string } | null;
		return item?.name ?? null;
	}

	function getUsedAttribution(entry: IncomingReactionEntry): string {
		const actorName = getReactingActor(entry)?.name ?? '';
		// Spend offers store their outcome as components, so the sentence is
		// built on whichever client renders it rather than the one that spent.
		if (entry.kind === 'spendPoolForDamage') {
			const featureName = getSourceItemName(entry) || entry.label;
			if (typeof entry.usedAmount !== 'number') return featureName;
			return localize('NIMBLE.chat.incomingReactions.poolSpendNote', {
				label: featureName,
				amount: String(entry.usedAmount),
				pool: entry.usedPoolLabel ?? '',
				faces: (entry.usedFaces ?? []).join(', '),
			});
		}
		return entry.label
			? localize('NIMBLE.chat.incomingReactions.redirectedToVia', {
					name: actorName,
					label: entry.label,
				})
			: localize('NIMBLE.chat.incomingReactions.redirectedTo', { name: actorName });
	}

	/**
	 * Baseline Interpose costs the standard heroic reaction; spend it through
	 * the combat's reaction bookkeeping (with the usual already-spent
	 * confirmation) before relaying the redirect. Rule-granted offers leave
	 * their cost to the granting feature. Outside combat there is nothing to
	 * spend.
	 */
	async function spendBaselineInterpose(entry: IncomingReactionEntry): Promise<boolean> {
		const combat = game.combat as
			| (Combat & {
					useHeroicReactions?: (
						combatantId: string,
						reactionKeys: string[],
						options?: { force?: boolean },
					) => Promise<boolean>;
			  })
			| null;
		if (!combat?.started || !combat.useHeroicReactions) return true;

		const tokenDoc = entry.tokenUuid
			? (fromUuidSync(entry.tokenUuid) as TokenDocument.Implementation | null)
			: null;
		const combatant = tokenDoc
			? (combat.combatants.find((c) => c.tokenId === tokenDoc.id) ?? null)
			: null;
		if (!combatant?.id) return true;

		const used = await combat.useHeroicReactions(combatant.id, ['interpose']);
		if (used) return true;

		const usageState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['interpose'],
		});
		if (!isSoftBlockedReason(usageState.blockedReason)) return false;

		const confirmed = await showReactionConfirmation({
			reactionName: localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'),
			spentReactionNames: localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'),
			noActions: usageState.blockedReason === 'noActions',
			hasSpentReactions: usageState.blockedReason === 'spent',
			isActiveTurn: usageState.blockedReason === 'activeTurn',
		});
		if (!confirmed) return false;

		return combat.useHeroicReactions(combatant.id, ['interpose'], { force: true });
	}

	/**
	 * Which pool and item does this offer's consumer belong to? Asked of the live
	 * rules rather than stamped on the entry, so an author retargeting the
	 * consumer does not strand offers on cards already posted.
	 */
	function findOfferTarget(
		actor: Actor.Implementation,
		entry: IncomingReactionEntry,
	): { poolId: string; itemId: string | null } | null {
		const sourceItemId = entry.itemUuid
			? ((fromUuidSync(entry.itemUuid) as { id?: string } | null)?.id ?? null)
			: null;

		for (const pool of getDicePools(actor)) {
			const match = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
				(consumer) =>
					consumer.ruleId === entry.ruleId && (!sourceItemId || consumer.itemId === sourceItemId),
			);
			if (match) return { poolId: pool.id, itemId: match.itemId };
		}
		return null;
	}

	/**
	 * The dice are picked on the spending player's own client, then the chosen
	 * selection is relayed like any other reaction: the message mutation is the
	 * GM's to make, both because a chat message is only updatable by its author
	 * or a GM and because one writer keeps concurrent reactions from clobbering
	 * each other.
	 */
	async function useSpendOffer(entry: IncomingReactionEntry): Promise<void> {
		const actor = getReactingActor(entry);
		if (!actor) return;

		const target = findOfferTarget(actor, entry);
		if (!target) {
			ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.poolSpendUnavailable'));
			return;
		}

		const dialog = new PoolSpendOfferDialog(
			actor,
			target.poolId,
			entry.ruleId,
			target.itemId,
			getEntryLabel(entry),
		);
		dialog.render(true);
		const selection = await dialog.promise;
		if (!selection) return;

		holdEntry(entry.id);
		await requestIncomingAttackReaction({
			messageId: messageDocument?.id ?? '',
			entryId: entry.id,
			selection,
		});
	}

	async function useReroll(entry: IncomingReactionEntry): Promise<void> {
		const forceHeroicReaction = await confirmRerollHeroicReaction(entry);
		if (forceHeroicReaction === null) return;

		holdEntry(entry.id);
		await requestIncomingAttackReaction({
			messageId: messageDocument?.id ?? '',
			entryId: entry.id,
			forceHeroicReaction,
		});
	}

	async function useEntry(entry: IncomingReactionEntry) {
		if (busy) return;
		busy = true;

		try {
			if (entry.kind === 'spendPoolForDamage') {
				await useSpendOffer(entry);
				return;
			}

			if (entry.kind === 'reroll') {
				await useReroll(entry);
				return;
			}

			if (entry.kind === 'redirectToSelf' && entry.source === 'baseline') {
				const spent = await spendBaselineInterpose(entry);
				if (!spent) return;
			}

			await requestIncomingAttackReaction({
				messageId: messageDocument.id ?? '',
				entryId: entry.id,
			});
		} catch (error) {
			console.error('Nimble | Failed to use a chat card reaction', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		} finally {
			busy = false;
		}
	}

	function releaseEntry(entryId: string): void {
		const next = new Set(heldEntryIds);
		if (next.delete(entryId)) heldEntryIds = next;
	}

	function holdEntry(entryId: string): void {
		heldEntryIds = new Set(heldEntryIds).add(entryId);
		setTimeout(() => releaseEntry(entryId), SPEND_HOLD_DURATION);
	}
</script>

{#snippet actorGroups(groups: ActorGroup[])}
	{#each groups as group (group.actorUuid)}
		<div class="nimble-incoming-reaction-group">
			{#if group.name}
				<p class="nimble-incoming-reaction-group__actor">{group.name}</p>
			{/if}

			<ul class="nimble-incoming-reaction-list">
				{#each group.entries as entry (entry.id)}
					{@const cost = getEntryCost(entry)}
					<li>
						<button
							class="nimble-button nimble-incoming-reaction-button"
							type="button"
							disabled={busy}
							data-tooltip={getEntryTooltip(entry)}
							onclick={() => useEntry(entry)}
						>
							<i
								class="nimble-incoming-reaction-button__icon {getEntryIcon(entry)}"
								aria-hidden="true"
							></i>
							<span class="nimble-incoming-reaction-button__label">{getEntryLabel(entry)}</span>
							{#if cost}
								<span class="nimble-incoming-reaction-button__cost">{cost}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
{/snippet}

{#if place === 'roll'}
	{#if pendingGroups.length > 0 || usedEntries.length > 0 || historyLines.length > 0 || legacyRerollLines.length > 0}
		<section class="nimble-roll-changes">
			{#each legacyRerollLines as line (line.id)}
				<div class="nimble-roll-changes__history">
					<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
					<p>{line.text}</p>
				</div>
			{/each}

			{#each historyLines as line, index (index)}
				<div class="nimble-roll-changes__history nimble-roll-changes__history--reroll">
					<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
					<div class="nimble-roll-changes__text">
						<p>{line.text}</p>
						{#if line.detail}
							<p class="nimble-roll-changes__detail">{line.detail}</p>
						{/if}
					</div>
					{#if line.dice}
						<span class="nimble-roll-changes__dice">
							<DieFace {...line.dice.previous} discarded />
							<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
							<DieFace {...line.dice.next} />
						</span>
					{/if}
				</div>
			{/each}

			{#each usedEntries as entry (entry.id)}
				<div class="nimble-roll-changes__history">
					<i class={getEntryIcon(entry)} aria-hidden="true"></i>
					<p>{getUsedAttribution(entry)}</p>
				</div>
			{/each}

			{#if pendingGroups.length > 0}
				<div class="nimble-roll-changes__well">
					{@render actorGroups(pendingGroups)}
				</div>
			{/if}
		</section>
	{/if}
{:else if pendingGroups.length > 0 || usedEntries.length > 0}
	<section class="nimble-card-section nimble-card-section--incoming-reactions">
		{#if pendingGroups.length > 0}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.incomingReactions.heading')}
				</h3>
			</header>

			{@render actorGroups(pendingGroups)}
		{/if}

		{#each usedEntries as entry (entry.id)}
			<p class="nimble-incoming-reaction-attribution">
				<i class={getEntryIcon(entry)} aria-hidden="true"></i>
				{getUsedAttribution(entry)}
			</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-roll-changes {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;

		&:not(:last-of-type) {
			padding-bottom: 0;
		}

		&__history {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);

			> i {
				margin-top: 0.125rem;
			}

			p {
				margin: 0;
				text-wrap: pretty;
			}
		}

		&__history--reroll {
			align-items: center;
			gap: 0.25rem;

			> i {
				align-self: flex-start;
			}
		}

		&__text {
			flex: 1;
			min-width: 0;
		}

		&__dice {
			display: flex;
			flex: none;
			align-items: center;
			gap: 0.25rem;
		}

		&__arrow {
			font-size: 0.625rem;
			color: var(--nimble-medium-text-color);
		}

		&__detail {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__well {
			margin-top: 0.125rem;
		}
	}

	.nimble-incoming-reaction-group {
		&:not(:first-child) {
			margin-top: 0.375rem;
		}

		&__actor {
			margin: 0 0 0.1875rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-incoming-reaction-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nimble-incoming-reaction-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.25rem 0.5rem;
		font-size: var(--nimble-sm-text);
		text-align: left;

		&__icon {
			flex: none;
			line-height: 0;
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__cost {
			flex: none;
			margin-left: auto;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}
	}

	.nimble-incoming-reaction-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>
