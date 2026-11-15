<script lang="ts">
	import type { MigrationReportViewProps } from './MigrationReportView.types.ts';
	import { formatDate, reportWord, whereLabel } from './worldMigrationWords.js';

	let { migration, report }: MigrationReportViewProps = $props();
</script>

<header class="nimble-world-migration__bar-row">
	<h2 class="nimble-world-migration__heading">{reportWord('title')}</h2>
	{#if migration.reports.length > 1}
		<select
			class="nimble-world-migration__report-select"
			aria-label={reportWord('pick')}
			bind:value={migration.shownReport}
		>
			{#each migration.reports as entry, index (entry.date)}
				<option value={index}>
					{reportWord('option', { date: formatDate(entry.date), version: entry.systemVersion })}
				</option>
			{/each}
		</select>
	{/if}
</header>

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
			{reportWord('documents', { count: report.documents })},
			{reportWord('copies', { count: report.copies })}
		</dd>
		<dt>{reportWord('keptOut')}</dt>
		<dd>{report.keptOut.length}</dd>
		<dt>{reportWord('errors')}</dt>
		<dd class:nimble-world-migration__error={report.errors.length > 0}>
			{report.errors.length}
		</dd>
	</dl>
	{#if report.stoppedRun}
		<p class="nimble-world-migration__meta">
			{reportWord('stoppedRun', { date: formatDate(report.stoppedRun) })}
		</p>
	{/if}

	{#if report.keptOut.length > 0}
		<fieldset class="nimble-world-migration__box nimble-world-migration__section">
			<legend class="nimble-world-migration__legend">{reportWord('keptOutHeading')}</legend>
			{#each report.keptOut as copy, index (index)}
				<div class="nimble-world-migration__report-row">
					<span class="nimble-world-migration__name">{copy.name}</span>
					<span class="nimble-world-migration__meta">{whereLabel(copy.holder)}</span>
					<div class="nimble-world-migration__titles">{copy.titles.join(', ')}</div>
				</div>
			{/each}
			<p class="nimble-world-migration__meta">{reportWord('structureStillRan')}</p>
		</fieldset>
	{/if}

	{#if report.errors.length > 0}
		<fieldset class="nimble-world-migration__box nimble-world-migration__section">
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
{:else}
	<p class="nimble-world-migration__empty">{reportWord('none')}</p>
{/if}

<style lang="scss">
	.nimble-world-migration {
		&__meta {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__empty {
			margin: 0;
		}

		&__heading {
			margin: 0;
			border: 0;
			font-size: var(--nimble-lg-text);
			font-weight: 900;
		}

		&__bar-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__report-select {
			width: auto;
		}

		&__box {
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__section {
			margin: 0;
			min-width: 0;
			padding: 0.25rem 0.5rem 0.375rem;
		}

		&__legend {
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 900;
			letter-spacing: 0.02em;
			text-transform: uppercase;
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

		&__report-row {
			padding: 0.25rem 0;

			.nimble-world-migration__name {
				font-weight: 600;
			}
		}

		&__titles {
			display: flex;
			flex-wrap: wrap;
			gap: 0.125rem 0.5rem;
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
