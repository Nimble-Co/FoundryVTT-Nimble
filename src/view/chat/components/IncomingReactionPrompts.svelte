<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';

	import { getContext } from 'svelte';
	import PoolSpendOfferDialog from '#documents/dialogs/PoolSpendOfferDialog.svelte.ts';
	import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
	import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
	import {
		getHeroicReactionUsageState,
		isSoftBlockedReason,
	} from '#utils/getHeroicReactionUsageState.js';
	import { requestIncomingAttackReaction } from '#utils/incomingAttackReactions.js';
	import localize from '../../../utils/localize.js';
	import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';

	function getReactingActor(entry: IncomingReactionEntry) {
		return (fromUuidSync(entry.actorUuid) ?? null) as Actor.Implementation | null;
	}

	function canUseEntry(entry: IncomingReactionEntry): boolean {
		if (game.user?.isGM) return true;
		const actor = getReactingActor(entry);
		return !!actor?.isOwner;
	}

	function getEntryHeading(entry: IncomingReactionEntry): string {
		if (entry.kind === 'forceReroll') {
			return localize('NIMBLE.chat.incomingReactions.forceReroll');
		}
		if (entry.kind === 'spendPoolForDamage') {
			return localize('NIMBLE.chat.incomingReactions.spendPoolForDamage');
		}
		return entry.source === 'baseline'
			? localize('NIMBLE.chat.incomingReactions.baselineInterpose')
			: localize('NIMBLE.chat.incomingReactions.interpose');
	}

	function getSourceItemName(entry: IncomingReactionEntry): string {
		if (!entry.itemUuid) return '';
		return ((fromUuidSync(entry.itemUuid) as { name?: string } | null)?.name ?? '').trim();
	}

	function getEntryLabel(entry: IncomingReactionEntry): string {
		const heading = getEntryHeading(entry);
		const actorName = getReactingActor(entry)?.name ?? '';
		// An attacker-side spend is already attributed by the card's speaker, so
		// the actor name adds nothing. Prefer the feature's own name over the
		// rule label, which is written for the rules builder, not for players.
		if (entry.kind === 'spendPoolForDamage') {
			const featureName = getSourceItemName(entry);
			return featureName ? `${heading}: ${featureName}` : heading;
		}
		const source = entry.label ? `: ${entry.label}` : '';
		return `${heading}${source} — ${actorName}`;
	}

	function getEntryIcon(entry: IncomingReactionEntry): string {
		if (entry.kind === 'forceReroll') return 'fa-solid fa-rotate-left';
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
		if (entry.kind === 'forceReroll') {
			return localize('NIMBLE.chat.incomingReactions.rerolledBy', {
				label: entry.label || actorName,
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
	 * Which pool does this offer's consumer draw from? Asked of the live rules
	 * rather than stamped on the entry, so an author retargeting the consumer
	 * does not strand offers on cards already posted.
	 */
	function findOfferPoolId(
		actor: Actor.Implementation,
		entry: IncomingReactionEntry,
	): string | null {
		const sourceItemId = entry.itemUuid
			? ((fromUuidSync(entry.itemUuid) as { id?: string } | null)?.id ?? null)
			: null;

		for (const pool of getDicePools(actor)) {
			const match = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).some(
				(consumer) =>
					consumer.ruleId === entry.ruleId && (!sourceItemId || consumer.itemId === sourceItemId),
			);
			if (match) return pool.id;
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

		const poolId = findOfferPoolId(actor, entry);
		if (!poolId) {
			ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.poolSpendUnavailable'));
			return;
		}

		const dialog = new PoolSpendOfferDialog(actor, poolId, entry.ruleId, getEntryLabel(entry));
		dialog.render(true);
		const selection = await dialog.promise;
		if (!selection) return;

		await requestIncomingAttackReaction({
			messageId: messageDocument?.id ?? '',
			entryId: entry.id,
			selection,
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

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let busy = $state(false);

	let entries = $derived(
		(messageDocument?.reactive?.system as { incomingReactions?: IncomingReactionEntry[] })
			?.incomingReactions ?? [],
	);
	let pendingEntries = $derived(entries.filter((entry) => !entry.used && canUseEntry(entry)));
	let usedEntries = $derived(entries.filter((entry) => entry.used));
</script>

{#if pendingEntries.length > 0 || usedEntries.length > 0}
	<section class="nimble-card-section nimble-card-section--incoming-reactions">
		{#if pendingEntries.length > 0}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.incomingReactions.heading')}
				</h3>
			</header>

			<ul class="nimble-incoming-reaction-list">
				{#each pendingEntries as entry (entry.id)}
					<li>
						<button
							class="nimble-button nimble-incoming-reaction-button"
							type="button"
							disabled={busy}
							data-tooltip={getEntryTooltip(entry)}
							onclick={() => useEntry(entry)}
						>
							<i class="nimble-button__icon {getEntryIcon(entry)}"></i>
							{getEntryLabel(entry)}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#each usedEntries as entry (entry.id)}
			<p class="nimble-incoming-reaction-attribution">
				<i class={getEntryIcon(entry)}></i>
				{getUsedAttribution(entry)}
			</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
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
			line-height: 0;
		}
	}

	.nimble-incoming-reaction-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>
