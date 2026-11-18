<script lang="ts">
	import type { MigrationReportViewProps } from './MigrationReportView.types.ts';
	import { countText, type MigrationReport } from '../../../migration/migrationReport.js';
	import MigrationPanes from './MigrationPanes.svelte';
	import MigrationReportChanges from './MigrationReportChanges.svelte';
	import MigrationReportShown from './MigrationReportShown.svelte';
	import MigrationPickList from './MigrationPickList.svelte';
	import { formatDate, formatShortDate, reportWord, whereLabel } from './worldMigrationWords.js';

	let { migration, report }: MigrationReportViewProps = $props();
</script>

{#snippet reportPick(entry: MigrationReport)}
	<i class="fa-solid fa-file-lines nimble-world-migration__icon" aria-hidden="true"></i>
	<span class="nimble-world-migration__name">
		{reportWord('entry', { version: entry.systemVersion })}
	</span>
	<span class="nimble-world-migration__count">{formatShortDate(entry.date)}</span>
{/snippet}

{#snippet side()}
	<h2 class="nimble-world-migration__legend">{reportWord('list')}</h2>
	<MigrationPickList
		items={migration.reports}
		selectedIndex={migration.shownReport}
		label={reportWord('list')}
		itemKey={(entry) => entry.date}
		itemLabel={(entry) =>
			`${reportWord('entry', { version: entry.systemVersion })}, ${formatDate(entry.date)}`}
		onSelect={(index) => (migration.shownReport = index)}
		pick={reportPick}
	/>
{/snippet}

{#snippet main()}
	<h2 class="nimble-world-migration__heading">{reportWord('title')}</h2>
	{#if report}
		<dl class="nimble-world-migration__facts">
			<dt>{reportWord('version')}</dt>
			<dd>
				{reportWord('versionValue', {
					version: report.systemVersion,
					from: report.fromSchema,
					to: report.toSchema,
				})}
			</dd>
			<dt>{reportWord('date')}</dt>
			<dd>{formatDate(report.date)}</dd>
			<dt>{reportWord('changed')}</dt>
			<dd>
				{countText(reportWord, 'documents', report.documents)},
				{countText(reportWord, 'copies', report.copies)}
			</dd>
			<dt>{reportWord('keptOut')}</dt>
			<dd>{report.keptOut.length}</dd>
			<dt>{reportWord('errors')}</dt>
			<dd class:nimble-world-migration__error={report.errors.length > 0}>
				{report.errors.length}
			</dd>
		</dl>
		{#if report.stoppedRun}
			<p class="nimble-world-migration__meta nimble-world-migration__stopped-run">
				{reportWord('stoppedRun', { date: formatDate(report.stoppedRun) })}
			</p>
		{/if}

		<MigrationReportChanges migrations={report.migrations ?? []} />

		{#if report.keptOut.length > 0}
			<fieldset class="nimble-world-migration__section">
				<legend class="nimble-world-migration__legend">{reportWord('keptOutHeading')}</legend>
				{#each report.keptOut as copy, index (index)}
					<div class="nimble-world-migration__report-row">
						<span class="nimble-world-migration__name">{copy.name}</span>
						<span class="nimble-world-migration__meta">{whereLabel(copy.holder)}</span>
						<div class="nimble-world-migration__titles">{copy.titles.join(', ')}</div>
					</div>
				{/each}
				<p class="nimble-world-migration__meta nimble-world-migration__note">
					{reportWord('structureStillRan')}
				</p>
			</fieldset>
		{/if}

		{#if report.errors.length > 0}
			<fieldset class="nimble-world-migration__section">
				<legend class="nimble-world-migration__legend">{reportWord('errorsHeading')}</legend>
				{#each report.errors as error, index (index)}
					<div class="nimble-world-migration__report-row">
						<span class="nimble-world-migration__name nimble-world-migration__error">
							<i class="fa-solid fa-circle-exclamation"></i>
							{error.name}
						</span>
						{#if error.title}<span class="nimble-world-migration__meta">{error.title}</span>{/if}
						<pre class="nimble-world-migration__code">{error.message}</pre>
					</div>
				{/each}
			</fieldset>
		{/if}

		<MigrationReportShown shown={report.shown ?? []} />
	{:else}
		<p class="nimble-world-migration__empty">{reportWord('none')}</p>
	{/if}
{/snippet}

<MigrationPanes {side} {main} />

<style lang="scss">
	.nimble-world-migration {
		&__legend {
			margin: 0;
			padding: 0.125rem 0.25rem 0.375rem;
			border: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 900;
			letter-spacing: 0.02em;
			text-transform: uppercase;
		}

		&__section &__legend {
			padding: 0 0.25rem;
		}

		&__heading {
			margin: 0.125rem 0 0.25rem;
			padding: 0;
			border: 0;
			font-size: var(--nimble-lg-text);
			font-weight: 900;
		}

		&__icon {
			justify-self: center;
		}

		&__name {
			font-weight: 600;
		}

		&__count {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__meta {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__empty {
			margin: 0;
		}

		&__stopped-run {
			margin-top: 0.25rem;
		}

		&__facts {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.2rem 0.75rem;
			margin: 0;

			dt {
				font-weight: 700;
				text-shadow: none;
			}

			dd {
				margin: 0;
				font-variant-numeric: tabular-nums;
			}
		}

		&__section {
			min-width: 0;
			margin: 0.5rem 0 0;
			padding: 0.25rem 0.5rem 0.375rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__report-row {
			padding: 0.25rem 0;

			& + & {
				border-top: 1px dashed var(--nimble-card-border-color);
			}

			.nimble-world-migration__name {
				font-weight: 600;
			}
		}

		&__note {
			padding: 0.25rem 0;
		}

		&__titles {
			margin-top: 0.125rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__error {
			color: var(--nimble-validation-error-color);
		}

		&__code {
			margin: 0.25rem 0 0;
			padding: 0.3rem 0.4rem;
			font-family: 'Source Code Pro', monospace;
			font-size: var(--nimble-xs-text);
			white-space: pre-wrap;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 2px;
		}
	}
</style>
