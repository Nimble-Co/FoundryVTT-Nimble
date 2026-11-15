<script lang="ts">
	import SupportReportErrors from './supportReport/SupportReportErrors.svelte';
	import SupportReportLinks from './supportReport/SupportReportLinks.svelte';
	import { createSupportReportDialogState } from './SupportReportDialogState.svelte.ts';
	import { supportWindowWord } from './supportReport/supportReportWords.js';

	const view = createSupportReportDialogState();
	const { entries, dropped, githubUrl, discordUrl, setWithActor, save, copy } = view;
	const ready = $derived(view.ready);
	const text = $derived(view.text);
	const also = $derived(view.also);
	const actorName = $derived(view.actorName);
	const actorChecked = $derived(view.actorChecked);
</script>

<article class="nimble-sheet__body nimble-support-report">
	<p class="nimble-support-report__lead">{supportWindowWord('lead')}</p>

	<SupportReportLinks {githubUrl} {discordUrl} />

	<SupportReportErrors {entries} {dropped} />

	<fieldset class="nimble-support-report__section">
		<legend class="nimble-support-report__legend">{supportWindowWord('alsoHeading')}</legend>
		<ul class="nimble-support-report__also">
			{#each also as row (row.icon)}
				<li>
					<i class={row.icon} aria-hidden="true"></i>
					<span>{row.text}</span>
				</li>
			{/each}
		</ul>
	</fieldset>

	<label class="nimble-support-report__actor">
		<input
			type="checkbox"
			checked={actorChecked}
			disabled={actorName === null}
			onchange={(event) => setWithActor(event.currentTarget.checked)}
		/>
		<span>
			<span class="nimble-support-report__actor-title">{supportWindowWord('actor')}</span>
			<span class="nimble-support-report__meta">
				{actorName === null
					? supportWindowWord('actorNone')
					: supportWindowWord('actorHint', { name: actorName })}
			</span>
		</span>
	</label>

	<details class="nimble-support-report__text">
		<summary class="nimble-support-report__text-toggle">
			<i class="fa-solid fa-chevron-right nimble-support-report__chevron" aria-hidden="true"></i>
			{supportWindowWord('showText')}
		</summary>
		<pre class="nimble-support-report__pre">{text}</pre>
	</details>
</article>

<footer class="nimble-sheet__footer nimble-support-report__footer">
	<button
		class="nimble-button nimble-support-report__save"
		data-button-variant="basic"
		type="button"
		disabled={!ready}
		onclick={save}
	>
		<i class="fa-solid fa-file-arrow-down"></i>
		{supportWindowWord('save')}
	</button>
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={!ready}
		onclick={copy}
	>
		<i class="fa-regular fa-copy"></i>
		{supportWindowWord('copy')}
	</button>
</footer>

<style lang="scss">
	.nimble-support-report {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		container: nimble-support-report / inline-size;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
		overflow-y: auto;
		font-size: var(--nimble-sm-text);
		line-height: 1.3;
		color: var(--nimble-dark-text-color);

		&__lead {
			margin: 0;
			font-size: var(--nimble-md-text);
			line-height: 1.35;
		}

		&__meta {
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
		}

		&__section {
			min-width: 0;
			margin: 0;
			padding: 0.25rem 0.625rem 0.375rem;
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

		&__also {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0.375rem 0.5rem;
			list-style: none;

			li {
				display: grid;
				grid-template-columns: 1.25rem minmax(0, 1fr);
				align-items: center;
				gap: 0.5rem;
				margin: 0;
				overflow-wrap: anywhere;
			}

			i {
				text-align: center;
				color: var(--nimble-medium-text-color);
			}
		}

		&__actor {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			input {
				flex: none;
				margin: 0;
			}

			> span {
				display: flex;
				flex-direction: column;
			}
		}

		&__actor-title {
			font-weight: 600;
		}

		&__text-toggle {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0;
			font-weight: 700;
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
			width: 0.75rem;
			font-size: 0.6rem;
			text-align: center;
			transition: rotate 0.15s ease-out;

			@media (prefers-reduced-motion: reduce) {
				transition: none;
			}
		}

		&__text[open] &__chevron {
			rotate: 90deg;
		}

		&__pre {
			max-height: 14rem;
			margin: 0.25rem 0 0;
			padding: 0.5rem 0.625rem;
			overflow: auto;
			font-family: 'Source Code Pro', monospace;
			font-size: var(--nimble-xs-text);
			line-height: 1.5;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}
	}

	.nimble-support-report__footer {
		display: flex;
		gap: 0.5rem;
		--nimble-button-padding: 0.5rem 1rem;

		.nimble-button {
			flex: 1;
			justify-content: center;
		}

		.nimble-support-report__save {
			flex: 2;
		}
	}
</style>
