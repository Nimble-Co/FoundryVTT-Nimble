<script lang="ts">
	import { addVariant, effectiveVariants, removeVariant } from '#utils/ancestryVariants.js';
	import localize from '#utils/localize.js';

	interface Props {
		selectedVariants: string[] | undefined;
		/** The ancestry's own name, used to say what characters are called when it lists no variants. */
		ancestryName: string;
		onChange: (nextVariants: string[]) => unknown;
	}

	let { selectedVariants, ancestryName, onChange }: Props = $props();

	let draft = $state('');
	/** A name the list already carries, shown until the next add. */
	let duplicate = $state('');

	// Imported or hand-edited ancestries can still store blanks or repeats; reads normalize both.
	let currentVariants = $derived(effectiveVariants(selectedVariants));

	function formatVariants(variants: string[]): string {
		const formatter = new Intl.ListFormat(game.i18n?.lang ?? 'en', {
			style: 'long',
			type: 'disjunction',
		});

		return formatter.format(variants);
	}

	/**
	 * Commit the draft name. A name the list already carries stays in the field with a note saying
	 * so, rather than vanishing as though it had been added.
	 */
	function handleAdd() {
		const variant = draft.trim();
		const nextVariants = addVariant(currentVariants, variant);

		if (nextVariants.length === currentVariants.length) {
			duplicate = variant;
			return;
		}

		duplicate = '';
		draft = '';
		onChange(nextVariants);
	}

	/** Enter adds the name rather than submitting the sheet, matching the Add button. */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();
		handleAdd();
	}

	function handleRemove(variant: string) {
		duplicate = '';
		onChange(removeVariant(currentVariants, variant));
	}

	/** What the GM's list means for character creation. */
	let summary = $derived.by(() => {
		if (currentVariants.length > 1) {
			return localize('NIMBLE.ancestrySheet.variantsSummaryChoice', {
				variants: formatVariants(currentVariants),
			});
		}

		if (currentVariants.length === 1) return localize('NIMBLE.ancestrySheet.variantsSummaryOne');

		return localize('NIMBLE.ancestrySheet.variantsSummaryNone', { ancestry: ancestryName });
	});
</script>

<div
	class="nimble-variant-options"
	role="group"
	aria-label={localize('NIMBLE.ancestrySheet.variants')}
>
	<div class="nimble-variant-options__field">
		<input
			class="nimble-variant-options__input"
			type="text"
			autocomplete="off"
			spellcheck="false"
			aria-label={localize('NIMBLE.ancestrySheet.variantsPlaceholder')}
			placeholder={localize('NIMBLE.ancestrySheet.variantsPlaceholder')}
			bind:value={draft}
			onkeydown={handleKeydown}
		/>

		<button
			class="nimble-variant-options__add"
			type="button"
			disabled={!draft.trim()}
			onclick={handleAdd}
		>
			{localize('NIMBLE.ancestrySheet.variantsAdd')}
		</button>
	</div>

	{#if currentVariants.length}
		<ul class="nimble-variant-options__badges">
			{#each currentVariants as variant (variant)}
				<li>
					<span class="nimble-variant-options__badge">
						{variant}

						<button
							class="nimble-variant-options__badge-remove"
							type="button"
							aria-label={localize('NIMBLE.ancestrySheet.variantsRemove', { variant })}
							onclick={() => handleRemove(variant)}
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if duplicate}
		<p class="nimble-variant-options__notice" role="status">
			{localize('NIMBLE.ancestrySheet.variantsDuplicate', { variant: duplicate })}
		</p>
	{/if}

	<p class="nimble-variant-options__summary">{summary}</p>
</div>

<style lang="scss">
	.nimble-variant-options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		&__field {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__input {
			flex: 1;
			min-width: 0;
		}

		&__add {
			flex: 0 0 auto;
			width: max-content;
			margin: 0;
			padding: 0.25rem 0.5rem;
			font-family: inherit;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 2px;
			transition: var(--nimble-standard-transition);

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover:not(:disabled) {
				border-color: var(--nimble-accent-color);
			}

			&:focus-visible {
				border-color: var(--nimble-accent-color);
			}

			&:disabled {
				color: var(--nimble-medium-text-color);
				cursor: default;
			}
		}

		&__badges {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__badge {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.25rem 0.25rem 0.25rem 0.5rem;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
			background: var(--nimble-selected-tag-background-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 99px;
		}

		&__badge-remove {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 0.875rem;
			height: 0.875rem;
			margin: 0;
			padding: 0;
			font-size: var(--nimble-xxs-text);
			color: inherit;
			// Tinted from the badge's own text color, so the chip stays legible whatever the badge is.
			background: color-mix(in srgb, currentColor 18%, transparent);
			border: none;
			border-radius: 50%;
			transition: var(--nimble-standard-transition);

			&:active,
			&:focus,
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				background: color-mix(in srgb, currentColor 32%, transparent);
			}
		}

		&__notice,
		&__summary {
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
			text-wrap: pretty;
		}

		&__notice {
			color: var(--nimble-dark-text-color);
		}
	}
</style>
