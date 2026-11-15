<script lang="ts">
	import type { MigrationReportShownProps } from './MigrationReportShown.types.ts';
	import { shownText } from '../../../migration/migrationReport.js';
	import { reportWord } from './worldMigrationWords.js';

	let { shown }: MigrationReportShownProps = $props();
</script>

{#if shown.length > 0}
	<fieldset class="nimble-world-migration__section">
		<legend class="nimble-world-migration__legend">{reportWord('shownHeading')}</legend>
		<p class="nimble-world-migration__meta">{reportWord('shownHint')}</p>
		<ul class="nimble-world-migration__shown">
			{#each shown as item, index (index)}
				<li>
					{#if item.level === 'error'}
						<i
							class="fa-solid fa-circle-exclamation nimble-world-migration__shown-error"
							aria-hidden="true"
						></i>
					{:else}
						<i
							class="fa-solid fa-triangle-exclamation nimble-world-migration__shown-warning"
							aria-hidden="true"
						></i>
					{/if}
					<span>{shownText(item, reportWord)}</span>
				</li>
			{/each}
		</ul>
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

		&__meta {
			margin: 0;
			padding: 0.125rem 0 0.25rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__shown {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;

			li {
				display: grid;
				grid-template-columns: 1rem minmax(0, 1fr);
				align-items: baseline;
				gap: 0.25rem;
				margin: 0;
				overflow-wrap: anywhere;
			}
		}

		&__shown-error {
			color: var(--nimble-validation-error-color);
		}

		// The shared warning icon colour is dark brown in the dark theme; the UI warning ink reads in both.
		&__shown-warning {
			color: var(--nimble-ui-warn);
		}
	}
</style>
