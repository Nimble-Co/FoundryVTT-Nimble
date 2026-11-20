<script lang="ts">
	import type { MigrationReportChangesProps } from './MigrationReportChanges.types.ts';
	import {
		countText,
		placesText,
		type ReportMigration,
	} from '../../../migration/migrationReport.js';
	import { reportWord, whereLabel, windowWord } from './worldMigrationWords.js';

	let { migrations }: MigrationReportChangesProps = $props();

	function countsText(migration: ReportMigration): string {
		const copyCount = migration.copies.reduce((sum, group) => sum + group.holders.length, 0);
		return [
			...(copyCount > 0 ? [countText(reportWord, 'copies', copyCount)] : []),
			countText(reportWord, 'documents', migration.documents),
		].join(', ');
	}
</script>

{#snippet changeText(migration: ReportMigration)}
	<span class="nimble-world-migration__change-text">
		<span class="nimble-world-migration__name">
			{#if migration.kind === 'structure'}
				<i
					class="fa-solid fa-lock nimble-world-migration__lock"
					role="img"
					data-tooltip={windowWord('alwaysRuns')}
					aria-label={windowWord('alwaysRuns')}
				></i>
			{/if}
			{migration.title}
		</span>
		<span class="nimble-world-migration__meta">{countsText(migration)}</span>
	</span>
{/snippet}

{#if migrations.length > 0}
	<fieldset class="nimble-world-migration__section">
		<legend class="nimble-world-migration__legend">{reportWord('changesHeading')}</legend>
		{#each migrations as migration (migration.version)}
			{#if migration.copies.length > 0}
				<details class="nimble-world-migration__change">
					<summary
						class="nimble-world-migration__change-head nimble-world-migration__change-head--toggle"
					>
						<i class="fa-solid fa-chevron-right nimble-world-migration__chevron" aria-hidden="true"
						></i>
						{@render changeText(migration)}
					</summary>
					<ul class="nimble-world-migration__places">
						{#each migration.copies as group (group.name)}
							<li>
								<span class="nimble-world-migration__name">{group.name}</span>
								<span class="nimble-world-migration__meta">
									{placesText(group.holders, reportWord, whereLabel)}
								</span>
							</li>
						{/each}
					</ul>
				</details>
			{:else}
				<div class="nimble-world-migration__change nimble-world-migration__change-head">
					<span aria-hidden="true"></span>
					{@render changeText(migration)}
				</div>
			{/if}
		{/each}
	</fieldset>
{/if}

<style lang="scss">
	.nimble-world-migration {
		&__section {
			min-width: 0;
			margin: 0.5rem 0 0;
			padding: 0.25rem 0.5rem 0.375rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__legend {
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 900;
			letter-spacing: 0.02em;
			text-transform: uppercase;
		}

		&__name {
			font-weight: 600;
		}

		&__meta {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__change + &__change {
			border-top: 1px dashed var(--nimble-card-border-color);
		}

		&__change-head {
			display: grid;
			grid-template-columns: 0.75rem minmax(0, 1fr);
			align-items: baseline;
			gap: 0.375rem;
			padding: 0.25rem 0;
		}

		&__change-head--toggle {
			list-style: none;
			cursor: pointer;
			border-radius: 2px;

			&::-webkit-details-marker {
				display: none;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-focus-border-color);
				outline-offset: 1px;
			}
		}

		&__chevron {
			font-size: 0.6rem;
			color: var(--nimble-medium-text-color);
			transition: rotate 0.15s ease-out;

			@media (prefers-reduced-motion: reduce) {
				transition: none;
			}
		}

		&__change[open] &__chevron {
			rotate: 90deg;
		}

		&__change-text {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		&__lock {
			margin-right: 0.2rem;
			font-size: 0.6rem;
			color: var(--nimble-medium-text-color);
		}

		&__places {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			margin: 0 0 0.375rem 1.125rem;
			padding: 0;
			font-size: var(--nimble-xs-text);
			list-style: none;

			li {
				margin: 0;
			}

			.nimble-world-migration__name {
				font-weight: 700;
			}
		}
	}
</style>
