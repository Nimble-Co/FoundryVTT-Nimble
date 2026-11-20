<script lang="ts">
	import type { SupportReportErrorsProps } from './SupportReportErrors.types.ts';
	import type { LogEntry } from '../../../support/supportLog.js';
	import { supportWord } from '../../../support/collectSupportReport.js';
	import { errorTotal, sourceText } from '../../../support/supportReport.js';
	import { supportWindowWord } from './supportReportWords.js';

	/** The window shows the first stack lines only; the saved text keeps all of them. */
	const STACK_LINES_SHOWN = 2;

	let { entries, dropped }: SupportReportErrorsProps = $props();

	const total = $derived(errorTotal(entries));

	function shownStack(entry: LogEntry): string {
		return entry.stack
			.slice(0, STACK_LINES_SHOWN)
			.map((line) => `at ${line}`)
			.join('\n');
	}
</script>

{#if entries.length === 0}
	<p class="nimble-support-report__clean">
		<i class="fa-solid fa-circle-check" aria-hidden="true"></i>
		{supportWindowWord('noErrors')}
	</p>
{:else}
	<fieldset class="nimble-support-report__section">
		<legend class="nimble-support-report__legend">
			{supportWindowWord('errorsHeading', { count: total })}
		</legend>
		<ul class="nimble-support-report__errors">
			{#each entries as entry, index (index)}
				<li class="nimble-support-report__error nimble-support-report__error--{entry.level}">
					<i
						class="fa-solid {entry.level === 'error'
							? 'fa-circle-exclamation'
							: 'fa-triangle-exclamation'}"
						aria-hidden="true"
					></i>
					<span class="nimble-support-report__message">{entry.message}</span>
					<span class="nimble-support-report__times">
						{supportWindowWord('times', { count: entry.count })}
					</span>
					<span class="nimble-support-report__source">
						{supportWindowWord('sourceLine', {
							level: supportWord(`level.${entry.level}`),
							source: sourceText(entry, supportWord),
						})}
					</span>
					{#if entry.stack.length > 0}
						<pre class="nimble-support-report__stack">{shownStack(entry)}</pre>
					{/if}
				</li>
			{/each}
		</ul>
		{#if dropped > 0}
			<p class="nimble-support-report__dropped">
				{supportWord('dropped', { count: String(dropped) })}
			</p>
		{/if}
	</fieldset>
{/if}

<style lang="scss">
	.nimble-support-report {
		&__clean {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			i {
				color: var(--nimble-roll-success-color);
			}
		}

		&__errors {
			max-height: 18rem;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			list-style: none;
		}

		&__error {
			display: grid;
			grid-template-columns: 1.25rem minmax(0, 1fr) auto;
			gap: 0.125rem 0.5rem;
			margin: 0;
			padding: 0.5rem 0;

			& + & {
				border-top: 1px dashed var(--nimble-card-border-color);
			}

			> i {
				padding-top: 0.1rem;
				text-align: center;
			}

			&--error > i {
				color: var(--nimble-validation-error-color);
			}

			&--warning > i {
				color: var(--nimble-ui-warn);
			}
		}

		&__message {
			font-weight: 600;
			line-height: 1.35;
			overflow-wrap: anywhere;
		}

		&__times {
			align-self: start;
			padding: 0.0625rem 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 900;
			font-variant-numeric: tabular-nums;
			white-space: nowrap;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 999px;
		}

		&__source,
		&__stack,
		&__dropped {
			grid-column: 2 / 4;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__stack {
			margin: 0.125rem 0 0;
			font-family: 'Source Code Pro', monospace;
			line-height: 1.45;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}

		&__dropped {
			margin: 0;
			padding: 0.25rem 0;
		}
	}
</style>
