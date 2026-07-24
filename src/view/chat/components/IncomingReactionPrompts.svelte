<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { IncomingReactionEntry } from '#utils/incomingAttackModifiers.ts';

	import { getContext } from 'svelte';
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
		return entry.source === 'baseline'
			? localize('NIMBLE.chat.incomingReactions.baselineInterpose')
			: localize('NIMBLE.chat.incomingReactions.interpose');
	}

	function getEntryLabel(entry: IncomingReactionEntry): string {
		const heading = getEntryHeading(entry);
		const actorName = getReactingActor(entry)?.name ?? '';
		const source = entry.label ? `: ${entry.label}` : '';
		return `${heading}${source} — ${actorName}`;
	}

	function getEntryIcon(entry: IncomingReactionEntry): string {
		if (entry.kind === 'forceReroll') return 'fa-solid fa-rotate-left';
		return 'fa-solid fa-shield-heart';
	}

	function getEntryTooltip(entry: IncomingReactionEntry): string | null {
		if (entry.source !== 'rule' || !entry.itemUuid) return null;
		const item = fromUuidSync(entry.itemUuid) as { name?: string } | null;
		return item?.name ?? null;
	}

	function getUsedAttribution(entry: IncomingReactionEntry): string {
		const actorName = getReactingActor(entry)?.name ?? '';
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

	async function useEntry(entry: IncomingReactionEntry) {
		if (busy) return;
		busy = true;

		try {
			if (entry.kind === 'redirectToSelf' && entry.source === 'baseline') {
				const spent = await spendBaselineInterpose(entry);
				if (!spent) return;
			}

			await requestIncomingAttackReaction({
				messageId: messageDocument.id ?? '',
				entryId: entry.id,
			});
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
