<script lang="ts">
	import localize from '../../utils/localize.js';
	import {
		type BuiltinLanguageRow,
		type CustomLanguageRow,
		LanguageCustomizationDialogState,
	} from './languageCustomization/state.svelte.js';

	let {
		dialog,
	}: {
		dialog?: { submit?: (results?: unknown) => void; close?: () => void };
	} = $props();

	const state = new LanguageCustomizationDialogState();

	async function handleSave() {
		if (state.hasConflicts) return;
		await state.save();
		dialog?.submit?.({ saved: true });
	}
</script>

{#snippet spokenBy(row: BuiltinLanguageRow | CustomLanguageRow)}
	{@const languageName = 'defaultLabel' in row ? row.defaultLabel : row.label.trim()}
	{@const available = state.ancestryOptions.filter(
		(option) => !row.speakers.some((speaker) => speaker.ancestry === option.value),
	)}
	<div class="nimble-language-customization__speakers">
		<span class="nimble-language-customization__speakers-title">
			{localize('NIMBLE.settings.languageCustomization.spokenBy')}
		</span>

		{#if row.key === 'common'}
			<p class="hint nimble-language-customization__speakers-hint">
				{localize('NIMBLE.settings.languageCustomization.spokenByEveryone')}
			</p>
		{:else}
			{#if row.speakers.length}
				<ul class="nimble-language-customization__speaker-list">
					{#each row.speakers as speaker (speaker.ancestry)}
						<li class="nimble-language-customization__speaker">
							<span class="nimble-language-customization__speaker-name"
								>{state.ancestryLabel(speaker.ancestry)}</span
							>
							<input
								type="text"
								class="nimble-language-customization__speaker-alias"
								placeholder={languageName}
								bind:value={speaker.alias}
							/>
							<button
								type="button"
								class="nimble-language-customization__icon-button"
								data-tooltip={localize('NIMBLE.settings.languageCustomization.removeAncestry')}
								aria-label={localize('NIMBLE.settings.languageCustomization.removeAncestry')}
								onclick={() => state.removeSpeaker(row, speaker.ancestry)}
							>
								<i class="fa-solid fa-xmark"></i>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if available.length}
				<select
					class="nimble-language-customization__ancestry-select"
					value=""
					onchange={(event) => {
						const select = event.currentTarget;
						if (select.value) state.addSpeaker(row, select.value);
						select.value = '';
					}}
				>
					<option value="" disabled selected>
						{localize('NIMBLE.settings.languageCustomization.selectAncestry')}
					</option>
					{#each available as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			{:else if !state.ancestryOptions.length}
				<p class="hint">{localize('NIMBLE.settings.languageCustomization.noAncestries')}</p>
			{/if}
		{/if}
	</div>
{/snippet}

<section class="nimble-sheet__body nimble-language-customization standard-form">
	<p class="nimble-language-customization__intro">
		{localize('NIMBLE.settings.languageCustomization.intro')}
	</p>

	<p class="hint nimble-language-customization__speakers-hint">
		{localize('NIMBLE.settings.languageCustomization.spokenByHint')}
	</p>

	<label class="nimble-language-customization__toggle">
		<input type="checkbox" bind:checked={state.alternateNamesEnabled} />
		<span>{localize('NIMBLE.settings.languageCustomization.enableAlternateNames')}</span>
	</label>

	{#if state.alternateNamesEnabled}
		<p class="hint nimble-language-customization__speakers-hint">
			{localize('NIMBLE.settings.languageCustomization.alternateNamesHint')}
		</p>
	{/if}

	{#if state.hasConflicts}
		<p class="nimble-language-customization__error" role="alert">
			<i class="fa-solid fa-triangle-exclamation"></i>
			{localize('NIMBLE.settings.languageCustomization.conflictError')}
		</p>
	{/if}

	<fieldset class="nimble-language-customization__section">
		<legend class="nimble-language-customization__section-title">
			{localize('NIMBLE.settings.languageCustomization.builtinSection')}
		</legend>

		<div class="nimble-language-customization__rows">
			{#each state.builtinRows as row, index (row.key)}
				{@const conflicted = state.conflicts.has(state.conflictIdForBuiltin(row))}
				<div class="nimble-language-customization__card">
					<header class="nimble-language-customization__card-header">
						<span class="nimble-language-customization__default-name">{row.defaultLabel}</span>
						{#if state.isBuiltinCustomized(row)}
							<button
								type="button"
								class="nimble-language-customization__icon-button"
								data-tooltip={localize('NIMBLE.settings.languageCustomization.reset')}
								aria-label={localize('NIMBLE.settings.languageCustomization.reset')}
								onclick={() => state.resetBuiltin(index)}
							>
								<i class="fa-solid fa-rotate-left"></i>
							</button>
						{/if}
					</header>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.rename')}</span>
						<input
							type="text"
							class:nimble-language-customization__input--error={conflicted}
							placeholder={row.defaultLabel}
							bind:value={row.label}
						/>
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.tooltip')}</span>
						<input type="text" placeholder={row.defaultHint} bind:value={row.hint} />
					</label>

					{@render spokenBy(row)}
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
				{@const conflicted = state.conflicts.has(state.conflictIdForCustom(index))}
				<div class="nimble-language-customization__card">
					<header class="nimble-language-customization__card-header">
						<span class="nimble-language-customization__default-name">
							{row.label.trim() || localize('NIMBLE.settings.languageCustomization.newLanguage')}
						</span>
						<button
							type="button"
							class="nimble-language-customization__icon-button"
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
							class:nimble-language-customization__input--error={conflicted}
							placeholder={localize('NIMBLE.settings.languageCustomization.label')}
							bind:value={row.label}
						/>
					</label>

					<label class="nimble-language-customization__field">
						<span>{localize('NIMBLE.settings.languageCustomization.tooltip')}</span>
						<input type="text" bind:value={row.hint} />
					</label>

					{@render spokenBy(row)}
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
			disabled={state.saving || state.hasConflicts}
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

	.nimble-language-customization__toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.nimble-language-customization__error {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		padding: 0.4rem 0.6rem;
		border-radius: 0.3rem;
		background: rgba(180, 40, 40, 0.12);
		color: var(--color-level-error, #b42828);
		font-size: var(--font-size-12, 0.75rem);
		font-weight: 600;
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

	.nimble-language-customization__input--error {
		border-color: var(--color-level-error, #b42828);
		outline: 1px solid var(--color-level-error, #b42828);
	}

	.nimble-language-customization__speakers {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px dashed var(--color-border-light-tertiary, rgba(0, 0, 0, 0.15));
	}

	.nimble-language-customization__speakers-title {
		font-size: var(--font-size-12, 0.75rem);
		font-weight: 700;
	}

	.nimble-language-customization__speakers-hint {
		margin: 0;
	}

	.nimble-language-customization__speaker-list {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-language-customization__speaker {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.nimble-language-customization__speaker-name {
		flex: 0 0 8rem;
		font-size: var(--font-size-12, 0.75rem);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nimble-language-customization__speaker-alias {
		flex: 1 1 auto;
	}

	.nimble-language-customization__ancestry-select {
		width: 100%;
	}

	.nimble-language-customization__icon-button,
	.nimble-language-customization__add,
	.nimble-language-customization__save {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		width: auto;
	}

	.nimble-language-customization__icon-button {
		flex: 0 0 auto;
		padding-inline: 0.4rem;
	}

	.nimble-language-customization__footer {
		display: flex;
		justify-content: flex-end;
	}

	// Dark mode: the translucent black backgrounds/borders above disappear against
	// a dark sheet, so each language reads as one flat panel. Give the cards a
	// lighter surface and visible borders so they read as distinct boxes.
	:global(.theme-dark) .nimble-language-customization__section {
		border-color: hsl(220, 10%, 34%);
	}

	:global(.theme-dark) .nimble-language-customization__card {
		background: hsl(220, 15%, 19%);
		border-color: hsl(220, 12%, 40%);
	}

	:global(.theme-dark) .nimble-language-customization__speakers {
		border-top-color: hsl(220, 10%, 38%);
	}
</style>
