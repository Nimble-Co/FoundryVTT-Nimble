<script lang="ts">
	import SpellSchoolIcon from '#view/components/SpellSchoolIcon.svelte';
	import { createCustomSpellSchoolsEditorState } from './CustomSpellSchoolsEditorState.svelte.ts';
	import type { CustomSpellSchoolsEditorProps } from './CustomSpellSchoolsEditor.types.ts';

	let { dialog }: CustomSpellSchoolsEditorProps = $props();

	const state = createCustomSpellSchoolsEditorState(() => dialog);

	const {
		t,
		defaultIcon,
		addRow,
		removeRow,
		onLabelInput,
		onKeyInput,
		normalizeKey,
		pickIcon,
		save,
	} = state;
	const rows = $derived(state.rows);
	const rowErrors = $derived(state.rowErrors);
	const hasErrors = $derived(state.hasErrors);
</script>

<article class="nimble-sheet__body nimble-custom-spell-schools">
	<p class="nimble-custom-spell-schools__intro">{t('intro')}</p>

	{#if rows.length === 0}
		<p class="nimble-custom-spell-schools__empty">{t('empty')}</p>
	{:else}
		<div class="nimble-custom-spell-schools__list">
			{#each rows as row, index (index)}
				<section class="school-card" class:school-card--invalid={rowErrors[index]}>
					<header class="school-card__header">
						<button
							type="button"
							class="school-card__icon"
							data-tooltip={t('chooseIcon')}
							aria-label={t('chooseIcon')}
							onclick={() => pickIcon(row)}
						>
							<SpellSchoolIcon icon={row.icon || defaultIcon} alt="" />
							<span class="school-card__icon-overlay"><i class="fa-solid fa-pen"></i></span>
						</button>

						<label class="school-card__field school-card__field--label">
							<span class="school-card__field-label">{t('columnLabel')}</span>
							<input
								type="text"
								class="school-card__input"
								placeholder={t('labelPlaceholder')}
								value={row.label}
								oninput={({ target }) => onLabelInput(row, (target as HTMLInputElement).value)}
							/>
						</label>

						<button
							type="button"
							class="school-card__remove"
							aria-label={t('remove')}
							data-tooltip={t('remove')}
							onclick={() => removeRow(index)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					</header>

					<label class="school-card__field">
						<span class="school-card__field-label">{t('columnKey')}</span>
						<input
							type="text"
							class="school-card__input school-card__input--mono"
							placeholder={t('keyPlaceholder')}
							value={row.key}
							oninput={({ target }) => onKeyInput(row, (target as HTMLInputElement).value)}
							onchange={() => normalizeKey(row)}
						/>
					</label>

					{#if rowErrors[index]}
						<p class="school-card__error">
							<i class="fa-solid fa-circle-exclamation"></i>
							{rowErrors[index]}
						</p>
					{/if}
				</section>
			{/each}
		</div>
	{/if}

	<button type="button" class="nimble-custom-spell-schools__add" onclick={addRow}>
		<i class="fa-solid fa-plus"></i>
		{t('addSchool')}
	</button>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		type="button"
		disabled={hasErrors}
		onclick={save}
	>
		{t('save')}
	</button>
</footer>

<style lang="scss">
	.nimble-custom-spell-schools {
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

	.school-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&--invalid {
			border-color: hsl(0deg 65% 55%);
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
			font-size: 1.25rem;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
			cursor: pointer;
			overflow: hidden;
			transition: border-color 0.15s ease;

			&:hover {
				border-color: var(--nimble-accent-color);

				.school-card__icon-overlay {
					opacity: 1;
				}
			}
		}

		&__icon-overlay {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.75rem;
			color: #fff;
			background: rgba(0, 0, 0, 0.55);
			opacity: 0;
			transition: opacity 0.15s ease;
		}

		&__field {
			display: flex;
			flex-direction: column;
			gap: 0.1875rem;
			min-width: 0;

			&--label {
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

		&__input {
			width: 100%;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-input-background-color);
			color: var(--nimble-dark-text-color);

			&:focus {
				outline: 2px solid hsl(212deg 60% 48%);
				outline-offset: -1px;
				border-color: hsl(212deg 60% 48%);
			}

			&--mono {
				font-family: var(--nimble-monospace-font, monospace);
				font-size: var(--nimble-xs-text);
			}
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
				color: hsl(0deg 65% 50%);
				background: hsl(0deg 65% 50% / 0.1);
			}
		}

		&__error {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: hsl(0deg 65% 45%);
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
