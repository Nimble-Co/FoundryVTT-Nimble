<script lang="ts">
	import type { WorldMigrationDialogProps } from './WorldMigrationDialog.types.ts';
	import MigrationCopyList from './worldMigration/MigrationCopyList.svelte';
	import MigrationProgressBar from './worldMigration/MigrationProgressBar.svelte';
	import MigrationReportView from './worldMigration/MigrationReportView.svelte';
	import { createWorldMigrationDialogState } from './WorldMigrationDialogState.svelte.ts';
	import { progressWord, reportWord, windowWord } from './worldMigration/worldMigrationWords.js';

	let { dialog, migration }: WorldMigrationDialogProps = $props();

	const view = createWorldMigrationDialogState(() => ({ dialog, migration }));
	const { close, start, copyReport } = view;
	const report = $derived(view.report);
	const lead = $derived(view.lead);
	const startLabel = $derived(view.startLabel);
	const phase = $derived(migration.phase);
</script>

<article class="nimble-sheet__body nimble-world-migration">
	{#if phase === 'report'}
		<MigrationReportView {migration} {report} />
	{:else}
		{#if phase === 'running' && migration.progress}
			<MigrationProgressBar progress={migration.progress} />
		{:else if phase === 'running'}
			<p class="nimble-world-migration__meta">{progressWord('checking')}</p>
		{:else}
			<p class="nimble-world-migration__lead">
				{#each lead as part, index (index)}{#if part.strong}<strong>{part.text}</strong
						>{:else}{part.text}{/if}{/each}
			</p>
		{/if}

		<MigrationCopyList {migration} />

		{#if phase === 'review' || phase === 'stopped'}
			<p class="nimble-world-migration__warn">
				<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
				{windowWord('backup')}
			</p>
		{/if}
	{/if}
</article>

{#if phase === 'review' || phase === 'stopped'}
	<footer class="nimble-sheet__footer nimble-world-migration__footer">
		<button class="nimble-button" data-button-variant="basic" type="button" onclick={close}>
			<i class="fa-regular fa-clock"></i>
			{windowWord('later')}
		</button>
		<button
			class="nimble-button nimble-world-migration__start"
			data-button-variant="basic"
			type="button"
			disabled={phase === 'stopped'}
			onclick={start}
		>
			<i class="fa-solid fa-play"></i>
			{startLabel}
		</button>
	</footer>
{:else if phase === 'report'}
	<footer class="nimble-sheet__footer nimble-world-migration__footer">
		{#if report}
			<button class="nimble-button" data-button-variant="basic" type="button" onclick={copyReport}>
				<i class="fa-regular fa-copy"></i>
				{reportWord('copy')}
			</button>
		{/if}
		<button class="nimble-button" data-button-variant="basic" type="button" onclick={close}>
			<i class="fa-solid fa-check"></i>
			{reportWord('close')}
		</button>
	</footer>
{/if}

<style lang="scss">
	.nimble-world-migration {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		// The panes stack when the window is narrow.
		container: nimble-world-migration / inline-size;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
		overflow-y: auto;
		font-size: var(--nimble-sm-text);
		line-height: 1.3;
		color: var(--nimble-dark-text-color);

		p {
			margin: 0;
		}

		&__lead {
			flex: none;
			font-size: var(--nimble-md-text);
			line-height: 1.35;

			strong {
				font-weight: 900;
			}
		}

		&__meta {
			flex: none;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__warn {
			display: flex;
			flex: none;
			align-items: baseline;
			gap: 0.5rem;
			padding: 0.5rem 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.4;
			background: var(--nimble-warning-background-color);
			border: 1px solid var(--nimble-warning-border-color);
			border-radius: 4px;

			i {
				color: var(--nimble-warning-icon-color);
			}
		}
	}

	// The shared dark warning fill is too light for light text, and its icon colour is dark.
	:global(.theme-dark) .nimble-world-migration__warn {
		--nimble-warning-background-color: hsl(40, 60%, 22%);
		--nimble-warning-border-color: hsl(40, 55%, 40%);
		--nimble-warning-icon-color: hsl(45, 100%, 65%);
	}

	.nimble-world-migration__footer {
		display: flex;
		flex: none;
		gap: 0.5rem;
		--nimble-button-padding: 0.5rem 1rem;

		.nimble-button {
			flex: 1;
			justify-content: center;
		}

		.nimble-world-migration__start {
			flex: 2;
		}
	}
</style>
