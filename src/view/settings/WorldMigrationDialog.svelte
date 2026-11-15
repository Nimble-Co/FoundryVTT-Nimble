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
	const leadText = $derived(view.leadText);
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
			<p class="nimble-world-migration__lead">{leadText}</p>
		{/if}

		<MigrationCopyList {migration} />

		{#if phase === 'review'}
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
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		font-size: var(--nimble-sm-text);
		line-height: 1.3;
		color: var(--nimble-dark-text-color);

		p {
			margin: 0;
		}

		&__lead {
			font-size: var(--nimble-md-text);
			line-height: 1.35;
		}

		&__meta {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__warn {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			padding: 0.4rem 0.5rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			background: var(--nimble-warning-background-color);
			border: 1px solid var(--nimble-warning-border-color);
			border-radius: 4px;

			i {
				margin-top: 0.1rem;
				color: var(--nimble-warning-icon-color);
			}
		}
	}

	.nimble-world-migration__footer {
		display: flex;
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
