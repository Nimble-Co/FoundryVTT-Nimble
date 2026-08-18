<script lang="ts">
	import type { VariantOptionsInputProps } from '#types/components/VariantOptionsInput.d.ts';

	import localize from '#utils/localize.js';
	import { createVariantOptionsInputState } from './VariantOptionsInput.svelte.ts';

	let { selectedVariants, ancestryName, onChange }: VariantOptionsInputProps = $props();

	const state = createVariantOptionsInputState(() => ({
		selectedVariants,
		ancestryName,
		onChange,
	}));

	const { addDraftVariant, handleKeydown, removeListedVariant } = state;
	const currentVariants = $derived(state.currentVariants);
	const duplicateVariant = $derived(state.duplicateVariant);
	const summary = $derived(state.summary);

	// Two ancestry sheets can be open at once, so the notice needs an id unique to this instance.
	const instanceId = $props.id();
	const noticeId = `nimble-variant-options-notice-${instanceId}`;
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
			aria-describedby={noticeId}
			aria-invalid={Boolean(duplicateVariant)}
			placeholder={localize('NIMBLE.ancestrySheet.variantsPlaceholder')}
			bind:value={state.draftVariant}
			onkeydown={handleKeydown}
		/>

		<button
			class="nimble-button nimble-variant-options__add"
			data-button-variant="secondary"
			type="button"
			disabled={!state.draftVariant.trim()}
			onclick={addDraftVariant}
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
							onclick={() => removeListedVariant(variant)}
						>
							<i class="fa-solid fa-xmark" aria-hidden="true"></i>
						</button>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Rendered even when empty so the live region exists before it has something to announce, and
	so the input's `aria-describedby` always points at a real element. -->
	<p class="nimble-variant-options__notice" id={noticeId} role="status">
		{duplicateVariant
			? localize('NIMBLE.ancestrySheet.variantsDuplicate', { variant: duplicateVariant })
			: ''}
	</p>

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

		// Layout only — the look comes from the global `secondary` button variant. That variant has
		// neither a disabled state nor a focus ring of its own, so both are supplied here.
		&__add {
			flex: 0 0 auto;

			// Qualified with `.nimble-button` deliberately: the global base rule clears `box-shadow`
			// at the same specificity this block would otherwise have, and would win on source order.
			&.nimble-button:focus-visible {
				box-shadow: 0 0 0 1px var(--nimble-accent-color);
			}

			&:disabled {
				opacity: 0.5;
				// The global variant still recolours on hover, which would read as enabled.
				pointer-events: none;
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
			&:hover {
				box-shadow: none;
				outline: none;
			}

			&:hover {
				background: color-mix(in srgb, currentColor 32%, transparent);
			}

			// The reset above drops the UA ring, so put a visible one back for keyboard focus.
			&:focus-visible {
				box-shadow: 0 0 0 1px var(--nimble-accent-color);
				outline: none;
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

			// Deliberately not `display: none` while empty: that would drop the live region out of the
			// accessibility tree between announcements, which is the failure this always-rendered
			// element exists to avoid. The paragraph has no height without text, but it is still a flex
			// item, so its share of the column `gap` is cancelled instead.
			&:empty {
				margin-block-start: -0.375rem;
			}
		}
	}
</style>
