<script lang="ts">
	import type { SupportReportLinksProps } from './SupportReportLinks.types.ts';
	import { supportWindowWord } from './supportReportWords.js';

	let { githubUrl, discordUrl }: SupportReportLinksProps = $props();
</script>

<div class="nimble-support-report__links">
	<a
		class="nimble-support-report__link nimble-support-report__link--preferred"
		href={githubUrl}
		target="_blank"
		rel="noopener"
	>
		<i class="fa-brands fa-github nimble-support-report__brand" aria-hidden="true"></i>
		<span class="nimble-support-report__link-title">
			{supportWindowWord('github')}
			<span class="nimble-support-report__preferred">{supportWindowWord('preferred')}</span>
		</span>
		<span class="nimble-support-report__link-hint">{supportWindowWord('githubHint')}</span>
	</a>
	<a class="nimble-support-report__link" href={discordUrl} target="_blank" rel="noopener">
		<i class="fa-brands fa-discord nimble-support-report__brand" aria-hidden="true"></i>
		<span class="nimble-support-report__link-title">{supportWindowWord('discord')}</span>
		<span class="nimble-support-report__link-hint">{supportWindowWord('discordHint')}</span>
	</a>
</div>

<style lang="scss">
	.nimble-support-report {
		&__links {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.5rem;
		}

		&__link {
			display: grid;
			grid-template-columns: 1.5rem minmax(0, 1fr);
			grid-template-rows: auto auto;
			align-items: center;
			column-gap: 0.5rem;
			padding: 0.5rem 0.625rem;
			color: inherit;
			text-decoration: none;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			&:hover .nimble-support-report__link-title {
				text-decoration: underline;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-focus-border-color);
				outline-offset: 2px;
			}

			&--preferred {
				border-color: var(--nimble-crimson);
				box-shadow: inset 0 0 0 1px var(--nimble-crimson);
			}
		}

		&__brand {
			grid-row: 1 / 3;
			font-size: 1.25rem;
			text-align: center;
		}

		&__link-title {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.375rem;
			font-weight: 900;
		}

		&__preferred {
			padding: 0 0.3rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			color: var(--nimble-parchment);
			background: var(--nimble-crimson);
			border-radius: 3px;
		}

		&__link-hint {
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
		}
	}

	@container nimble-support-report (width < 28rem) {
		.nimble-support-report__links {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
