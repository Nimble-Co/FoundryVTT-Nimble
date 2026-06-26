<script lang="ts">
	import localize from '../../utils/localize.js';
	import { LanguageCustomizationDialogState } from './languageCustomization/state.svelte.js';

	let {
		dialog,
	}: {
		dialog?: { submit?: (results?: unknown) => void; close?: () => void };
	} = $props();

	const state = new LanguageCustomizationDialogState();

	async function handleSave() {
		await state.save();
		dialog?.submit?.({ saved: true });
	}
</script>

<section class="nimble-sheet__body nimble-language-customization standard-form">
	<p class="nimble-language-customization__intro">
		{localize('NIMBLE.settings.languageCustomization.intro')}
	</p>

	<fieldset class="nimble-language-customization__section">
		<legend class="nimble-language-customization__section-title">
			{localize('NIMBLE.settings.languageCustomization.builtinSection')}
		</legend>

		<div class="nimble-language-customization__rows">
			{#each state.builtinRows as row, index (row.key)}
				<div class="nimble-language-customization__card">
					<header class="nimble-language-customization__card-header">
						<span class="nimble-language-customization__default-name">{row.defaultLabel}</span>
						<button
							type="button"
							class="nimble-language-customization__reset"
							data-tooltip={localize('NIMBLE.settings.languageCustomization.reset')}
							aria-label={localize('NIMBLE.settings.languageCustomization.reset')}
							onclick={() => state.resetBuiltin(index)}
						>
							<i class="fa-solid fa-rotate-left"></i>
						</button>
					</header>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.label')}</span>
						<input type="text" placeholder={row.defaultLabel} bind:value={row.label} />
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.aliases')}</span>
						<input
							type="text"
							placeholder={localize('NIMBLE.settings.languageCustomization.aliasesPlaceholder')}
							bind:value={row.aliases}
						/>
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.tooltip')}</span>
						<input type="text" placeholder={row.defaultHint} bind:value={row.hint} />
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.icon')}</span>
						<input type="text" placeholder={row.defaultImage} bind:value={row.image} />
					</label>
				</div>
			{/each}
		</div>
	</fieldset>

	<fieldset class="nimble-language-customization__section">
		<legend class="nimble-language-customization__section-title">
			{localize('NIMBLE.settings.languageCustomization.customSection')}
		</legend>

		<div class="nimble-language-customization__rows">
			{#each state.customRows as row, index (index)}
				<div class="nimble-language-customization__card">
					<header class="nimble-language-customization__card-header">
						<span class="nimble-language-customization__default-name">
							{row.label.trim() || localize('NIMBLE.settings.languageCustomization.newLanguage')}
						</span>
						<button
							type="button"
							class="nimble-language-customization__reset"
							data-tooltip={localize('NIMBLE.settings.languageCustomization.remove')}
							aria-label={localize('NIMBLE.settings.languageCustomization.remove')}
							onclick={() => state.removeCustomLanguage(index)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					</header>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.label')}</span>
						<input
							type="text"
							placeholder={localize('NIMBLE.settings.languageCustomization.label')}
							bind:value={row.label}
						/>
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.aliases')}</span>
						<input
							type="text"
							placeholder={localize('NIMBLE.settings.languageCustomization.aliasesPlaceholder')}
							bind:value={row.aliases}
						/>
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.tooltip')}</span>
						<input type="text" bind:value={row.hint} />
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.icon')}</span>
						<input type="text" placeholder="icons/..." bind:value={row.image} />
					</label>
				</div>
			{/each}
		</div>

		<button
			type="button"
			class="nimble-language-customization__add"
			onclick={state.addCustomLanguage}
		>
			<i class="fa-solid fa-plus"></i>
			{localize('NIMBLE.settings.languageCustomization.addLanguage')}
		</button>
	</fieldset>

	<footer class="nimble-language-customization__footer">
		<button
			type="button"
			class="nimble-language-customization__save"
			disabled={state.saving}
			onclick={handleSave}
		>
			<i class="fa-solid fa-floppy-disk"></i>
			{localize('NIMBLE.settings.languageCustomization.save')}
		</button>
	</footer>
</section>

<style lang="scss">
	.nimble-language-customization {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
	}

	.nimble-language-customization__intro {
		margin: 0;
		font-size: var(--font-size-13, 0.8125rem);
		opacity: 0.85;
	}

	.nimble-language-customization__section {
		margin: 0;
		border: 1px solid var(--color-border-light-secondary, rgba(0, 0, 0, 0.25));
		border-radius: 0.375rem;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nimble-language-customization__section-title {
		padding-inline: 0.3rem;
		font-weight: 700;
	}

	.nimble-language-customization__rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nimble-language-customization__card {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem 0.6rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border-light-tertiary, rgba(0, 0, 0, 0.15));
		border-radius: 0.3rem;
		background: rgba(0, 0, 0, 0.05);
	}

	.nimble-language-customization__card-header {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.nimble-language-customization__default-name {
		font-weight: 700;
	}

	.nimble-language-customization__field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: var(--font-size-12, 0.75rem);

		input {
			width: 100%;
		}
	}

	.nimble-language-customization__reset,
	.nimble-language-customization__add,
	.nimble-language-customization__save {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		width: auto;
	}

	.nimble-language-customization__reset {
		flex: 0 0 auto;
		padding-inline: 0.4rem;
	}

	.nimble-language-customization__footer {
		display: flex;
		justify-content: flex-end;
	}
</style>
