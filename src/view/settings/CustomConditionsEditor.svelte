<script lang="ts">
	import type { CustomConditionsEditorProps } from './CustomConditionsEditor.types.ts';
	import { createCustomConditionsEditorState } from './CustomConditionsEditorState.svelte.ts';

	let { dialog }: CustomConditionsEditorProps = $props();

	const state = createCustomConditionsEditorState(() => dialog);

	const { t, defaultIcon, addRow, removeRow, onNameInput, onIdInput, normalizeId, pickIcon, save } =
		state;
	const rows = $derived(state.rows);
	const rowErrors = $derived(state.rowErrors);
	const hasErrors = $derived(state.hasErrors);
	const saving = $derived(state.saving);
</script>

<article class="nimble-sheet__body nimble-custom-conditions">
	<p class="nimble-custom-conditions__intro">{t('intro')}</p>

	{#if rows.length === 0}
		<p class="nimble-custom-conditions__empty">{t('empty')}</p>
	{:else}
		<div class="nimble-custom-conditions__list">
			{#each rows as row, index (row.uid)}
				<section class="condition-card" class:condition-card--invalid={rowErrors[index]}>
					<header class="condition-card__header">
						<button
							type="button"
							class="condition-card__icon"
							data-tooltip={t('chooseIcon')}
							aria-label={t('chooseIcon')}
							onclick={() => pickIcon(row)}
						>
							<img src={row.img || defaultIcon} alt="" />
							<span class="condition-card__icon-overlay"><i class="fa-solid fa-pen"></i></span>
						</button>

						<label class="condition-card__field condition-card__field--name">
							<span class="condition-card__field-label">{t('columnName')}</span>
							<input
								type="text"
								class="condition-card__input"
								placeholder={t('namePlaceholder')}
								value={row.name}
								oninput={({ target }) => onNameInput(row, (target as HTMLInputElement).value)}
							/>
						</label>

						<button
							type="button"
							class="condition-card__remove"
							aria-label={t('remove')}
							data-tooltip={t('remove')}
							onclick={() => removeRow(row)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					</header>

					<label class="condition-card__field">
						<span class="condition-card__field-label">{t('columnId')}</span>
						<input
							type="text"
							class="condition-card__input condition-card__input--mono"
							placeholder={t('idPlaceholder')}
							value={row.id}
							readonly={row.persisted}
							data-tooltip={row.persisted ? t('idLocked') : null}
							oninput={({ target }) => onIdInput(row, (target as HTMLInputElement).value)}
							onchange={() => normalizeId(row)}
						/>
					</label>

					<label class="condition-card__field">
						<span class="condition-card__field-label">{t('columnDescription')}</span>
						<textarea
							class="condition-card__input condition-card__textarea"
							rows="3"
							placeholder={t('descriptionPlaceholder')}
							bind:value={row.description}
						></textarea>
					</label>

					{#if rowErrors[index]}
						<p class="condition-card__error" role="alert">
							<i class="fa-solid fa-circle-exclamation"></i>
							{rowErrors[index]}
						</p>
					{/if}
				</section>
			{/each}
		</div>
	{/if}

	<button type="button" class="nimble-custom-conditions__add" onclick={addRow}>
		<i class="fa-solid fa-plus"></i>
		{t('addCondition')}
	</button>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={hasErrors || saving}
		onclick={save}
	>
		{t('save')}
	</button>
</footer>

<style lang="scss">
	.nimble-custom-conditions {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
		}

		&__empty {
			margin: 0;
			padding: 1.25rem 0.75rem;
			text-align: center;
			font-style: italic;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}

		&__add {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.375rem;
			width: 100%;
			padding: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 6px;
			cursor: pointer;
			transition:
				border-color 0.15s ease,
				color 0.15s ease;

			&:hover {
				color: var(--nimble-dark-text-color);
				border-color: var(--nimble-medium-text-color);
			}
		}
	}

	.condition-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&--invalid {
			border-color: var(--nimble-validation-error-border-color);
		}

		&__header {
			display: flex;
			align-items: flex-end;
			gap: 0.5rem;
		}

		&__icon {
			position: relative;
			display: flex;
			align-items: center;
			justify-content: center;
			flex: 0 0 auto;
			width: 2.5rem;
			height: 2.5rem;
			padding: 0;
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
			cursor: pointer;
			overflow: hidden;
			transition: border-color 0.15s ease;

			&:hover {
				border-color: var(--nimble-accent-color);

				.condition-card__icon-overlay {
					opacity: 1;
				}
			}

			img {
				width: 1.5rem;
				height: 1.5rem;
				object-fit: contain;
				border: none;
			}
		}

		&__icon-overlay {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.75rem;
			color: var(--nimble-icon-picker-overlay-text-color);
			background: var(--nimble-icon-picker-overlay-background);
			opacity: 0;
			transition: opacity 0.15s ease;
		}

		&__field {
			display: flex;
			flex-direction: column;
			gap: 0.1875rem;
			min-width: 0;

			&--name {
				flex: 1 1 auto;
			}
		}

		&__field-label {
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: var(--nimble-medium-text-color);
		}

		// Colour, background, border and focus ring come from the shared
		// `.system-nimble .nimble-sheet input/textarea` rules in scss/components/_sheet.scss,
		// which outrank these scoped selectors — only layout belongs here.
		&__input {
			width: 100%;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);

			&--mono {
				font-family: var(--nimble-mono-font);
				font-size: var(--nimble-xs-text);
			}

			&[readonly] {
				opacity: 0.65;
				cursor: not-allowed;
			}
		}

		&__textarea {
			resize: vertical;
			line-height: 1.4;
		}

		&__remove {
			display: flex;
			align-items: center;
			justify-content: center;
			flex: 0 0 auto;
			width: 2.5rem;
			height: 2.5rem;
			padding: 0;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 1px solid transparent;
			border-radius: 6px;
			cursor: pointer;
			transition:
				color 0.15s ease,
				background 0.15s ease;

			&:hover {
				color: var(--nimble-validation-error-color);
				background: color-mix(in srgb, var(--nimble-validation-error-color) 12%, transparent);
			}
		}

		&__error {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-validation-error-color);
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
