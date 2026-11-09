<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { IncomingReactionPromptsProps } from '#types/components/IncomingReactionPrompts.d.ts';

	import { getContext } from 'svelte';
	import ChangeThisRoll from './ChangeThisRoll.svelte';
	import { createIncomingReactionPromptsState } from './IncomingReactionPrompts.svelte.ts';
	import LeftOutRerolls from './LeftOutRerolls.svelte';
	import RerollHistory from './RerollHistory.svelte';
	import ResultChangeLines from './ResultChangeLines.svelte';

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let { place }: IncomingReactionPromptsProps = $props();

	const prompts = createIncomingReactionPromptsState(messageDocument, () => place);
	const { held, text, control } = prompts;
</script>

{#snippet rerollHistory()}
	<RerollHistory
		legacyLines={prompts.legacyRerollLines}
		lines={prompts.historyLines}
		pendingKeep={prompts.pendingKeep}
		pendingLine={prompts.pendingLine}
		primaryDieBonuses={prompts.primaryDieBonuses}
		keptAmount={prompts.keptAmount}
		bonusNotAdded={prompts.bonusNotAdded}
		outcomeTags={prompts.outcomeTags}
		{held}
	/>
{/snippet}

{#snippet changeThisRoll()}
	<ChangeThisRoll
		{control}
		groups={prompts.pendingGroups}
		picking={prompts.picking}
		busy={prompts.busy}
		primaryOutcome={prompts.primaryOutcome}
		primaryDieBonuses={prompts.primaryDieBonuses}
		{text}
	/>
{/snippet}

<!-- The way to the card for the focus, when no button of the control is left. -->
{#if prompts.ownsControl}
	<span bind:this={control.elements.anchor} hidden></span>
{/if}

{#if place === 'checkRoll'}
	{#if prompts.outcomeTags.length > 0 || prompts.pendingGroups.length > 0 || prompts.historyLines.length > 0 || prompts.legacyRerollLines.length > 0 || prompts.pendingKeep || prompts.leftOutEntries.length > 0 || prompts.resultLines.length > 0}
		<section class="nimble-roll-changes nimble-roll-changes--under-row">
			<!-- A change a new roll took off came before that roll's line. -->
			<ResultChangeLines
				sum={prompts.resultSum}
				lines={prompts.resultLines.filter((line) => line.retired)}
				{held}
				onremove={prompts.removeResultLine}
			/>
			{@render rerollHistory()}
			<ResultChangeLines
				lines={prompts.resultLines.filter((line) => !line.retired)}
				{held}
				onremove={prompts.removeResultLine}
			/>
			{@render changeThisRoll()}
			{#if prompts.leftOutEntries.length > 0}
				<LeftOutRerolls entries={prompts.leftOutEntries} />
			{/if}
		</section>
	{/if}
{:else if place === 'roll'}
	{#if prompts.outcomeTags.length > 0 || prompts.keptAmount || prompts.primaryDieBonuses.length > 0 || prompts.pendingGroups.length > 0 || prompts.historyLines.length > 0 || prompts.legacyRerollLines.length > 0 || prompts.pendingKeep || prompts.leftOutEntries.length > 0 || prompts.resultLines.length > 0}
		<section class="nimble-roll-changes">
			{@render rerollHistory()}
			<ResultChangeLines lines={prompts.resultLines} {held} onremove={prompts.removeResultLine} />
			{@render changeThisRoll()}

			{#if prompts.leftOutEntries.length > 0}
				<LeftOutRerolls entries={prompts.leftOutEntries} />
			{/if}
		</section>
	{/if}
{:else if prompts.pendingGroups.length > 0 || prompts.usedEntries.length > 0}
	<section class="nimble-card-section nimble-card-section--incoming-reactions">
		{@render changeThisRoll()}

		{#each prompts.usedEntries as entry (entry.id)}
			<p class="nimble-incoming-reaction-attribution">
				<i class={text.icon(entry)} aria-hidden="true"></i>
				{text.usedAttribution(entry)}
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

		&--under-row {
			padding: 0.5rem 0 0;
		}
	}

	.nimble-incoming-reaction-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>
