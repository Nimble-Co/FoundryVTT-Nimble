<script lang="ts">
	import { SYSTEM_ID } from '#system';
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';

	const messageDocument = getContext('messageDocument');

	// The activating client stamps this flag when an item's rules adjust anyone's
	// actions. The entries are the REQUESTED adjustment: the recipient's combatant
	// clamps it and may relay the write asynchronously, so this is a record of
	// intent, not a readback of the resulting pools.
	let summary = $derived(messageDocument?.reactive?.flags?.[SYSTEM_ID]?.actionDeltaSummary ?? []);

	function getChangeColor(delta: number): string {
		return delta < 0
			? 'var(--nimble-roll-failure-color, hsl(1, 100%, 33%))'
			: 'var(--nimble-roll-success-color, hsl(120, 45%, 55%))';
	}

	/**
	 * The key for the sentence describing one adjustment. Singular and plural
	 * wordings live in sibling keys because the localization layer has no plural
	 * rules, and every key is spelled out so they stay greppable.
	 */
	function getAdjustmentLocalizationKey(delta: number, appliesNextTurn: boolean): string {
		const isSingular = Math.abs(delta) === 1;

		if (appliesNextTurn) {
			if (delta < 0) {
				return isSingular
					? 'NIMBLE.chat.actionDeltaSummary.loseActionNextTurn'
					: 'NIMBLE.chat.actionDeltaSummary.loseActionsNextTurn';
			}
			return isSingular
				? 'NIMBLE.chat.actionDeltaSummary.gainActionNextTurn'
				: 'NIMBLE.chat.actionDeltaSummary.gainActionsNextTurn';
		}

		if (delta < 0) {
			return isSingular
				? 'NIMBLE.chat.actionDeltaSummary.loseActionNow'
				: 'NIMBLE.chat.actionDeltaSummary.loseActionsNow';
		}
		return isSingular
			? 'NIMBLE.chat.actionDeltaSummary.gainActionNow'
			: 'NIMBLE.chat.actionDeltaSummary.gainActionsNow';
	}
</script>

{#if summary.length > 0}
	<section class="nimble-action-delta-summary">
		{#each summary as entry (entry.combatantId)}
			{#if entry.currentDelta !== 0}
				<div
					class="nimble-action-delta-summary__entry"
					style="color: {getChangeColor(entry.currentDelta)}"
				>
					{localize(getAdjustmentLocalizationKey(entry.currentDelta, false), {
						name: entry.name,
						count: String(Math.abs(entry.currentDelta)),
					})}
				</div>
			{/if}
			{#if entry.pendingDelta !== 0}
				<div
					class="nimble-action-delta-summary__entry"
					style="color: {getChangeColor(entry.pendingDelta)}"
				>
					{localize(getAdjustmentLocalizationKey(entry.pendingDelta, true), {
						name: entry.name,
						count: String(Math.abs(entry.pendingDelta)),
					})}
				</div>
			{/if}
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-action-delta-summary {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nimble-action-delta-summary__entry {
		font-size: var(--nimble-sm-text, 0.833rem);
		font-weight: 500;
	}
</style>
