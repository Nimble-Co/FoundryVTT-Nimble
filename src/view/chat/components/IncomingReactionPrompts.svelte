<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { IncomingReactionPromptsProps } from '#types/components/IncomingReactionPrompts.d.ts';

	import { getContext, tick } from 'svelte';
	import localize from '../../../utils/localize.js';
	import IncomingReactionEntryGroups from './IncomingReactionEntryGroups.svelte';
	import { createIncomingReactionPromptsState } from './IncomingReactionPrompts.svelte.ts';
	import LeftOutRerolls from './LeftOutRerolls.svelte';
	import RerollDiePicker from './RerollDiePicker.svelte';
	import RerollHistory from './RerollHistory.svelte';
	import RollRerollButton from './RollRerollButton.svelte';

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let { place }: IncomingReactionPromptsProps = $props();

	const prompts = createIncomingReactionPromptsState(messageDocument, () => place);
	const { held, text } = prompts;

	let rollRerollButton = $state<{ focus(): void } | undefined>();

	async function cancelPickAtRollButton(): Promise<void> {
		prompts.cancelPick();
		await tick();
		rollRerollButton?.focus();
	}
</script>

{#snippet rerollHistory()}
	<RerollHistory
		legacyLines={prompts.legacyRerollLines}
		lines={prompts.historyLines}
		pendingKeep={prompts.pendingKeep}
		pendingLine={prompts.pendingLine}
		{held}
	/>
{/snippet}

{#snippet entryGroups()}
	<IncomingReactionEntryGroups
		groups={prompts.pendingGroups}
		picking={prompts.picking}
		busy={prompts.busy}
		primaryOutcome={prompts.primaryOutcome}
		{text}
		onuse={prompts.useEntry}
		onpick={prompts.pickDie}
		oncancel={prompts.cancelPick}
	/>
{/snippet}

{#if place === 'rollButton'}
	{#if prompts.rerollChoices.length > 0}
		<RollRerollButton
			bind:this={rollRerollButton}
			choices={prompts.rerollChoices}
			disabled={prompts.busy}
			onChoose={prompts.useEntryById}
		/>
	{/if}
	{#if prompts.picking}
		<RerollDiePicker
			dice={prompts.picking.dice}
			feature={text.featureName(prompts.picking.entry) || prompts.picking.entry.label}
			primaryOutcome={null}
			rolling={prompts.picking.rolling}
			onpick={prompts.pickDie}
			oncancel={cancelPickAtRollButton}
		/>
	{/if}
{:else if place === 'rollHistory'}
	{#if prompts.historyLines.length > 0 || prompts.legacyRerollLines.length > 0 || prompts.pendingKeep || prompts.leftOutEntries.length > 0}
		<section class="nimble-roll-changes nimble-roll-changes--under-row">
			{@render rerollHistory()}
			{#if prompts.leftOutEntries.length > 0}
				<LeftOutRerolls entries={prompts.leftOutEntries} />
			{/if}
		</section>
	{/if}
{:else if place === 'roll'}
	{#if prompts.pendingGroups.length > 0 || prompts.usedEntries.length > 0 || prompts.historyLines.length > 0 || prompts.legacyRerollLines.length > 0 || prompts.pendingKeep || prompts.leftOutEntries.length > 0}
		<section class="nimble-roll-changes">
			{@render rerollHistory()}

			{#each prompts.usedEntries as entry (entry.id)}
				<div class="nimble-roll-changes__history">
					<i class={text.icon(entry)} aria-hidden="true"></i>
					<p>{text.usedAttribution(entry)}</p>
				</div>
			{/each}

			{#if prompts.pendingGroups.length > 0}
				<div class="nimble-roll-changes__well">
					{@render entryGroups()}
				</div>
			{/if}

			{#if prompts.leftOutEntries.length > 0}
				<LeftOutRerolls entries={prompts.leftOutEntries} />
			{/if}
		</section>
	{/if}
{:else if prompts.pendingGroups.length > 0 || prompts.usedEntries.length > 0}
	<section class="nimble-card-section nimble-card-section--incoming-reactions">
		{#if prompts.pendingGroups.length > 0}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.incomingReactions.heading')}
				</h3>
			</header>

			{@render entryGroups()}
		{/if}

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

		// The used-entry lines; the reroll lines style their own copy in RerollHistory.
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

		&__well {
			margin-top: 0.125rem;
		}
	}

	.nimble-incoming-reaction-attribution {
		margin: 0.25rem 0 0 0;
		font-size: var(--nimble-xs-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}
</style>
