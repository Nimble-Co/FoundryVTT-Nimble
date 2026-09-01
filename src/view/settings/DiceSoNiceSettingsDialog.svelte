<script lang="ts">
	import type { DiceSoNiceSettingsDialogProps } from './DiceSoNiceSettingsDialog.types.ts';

	import localize from '#utils/localize.js';
	import {
		DEFAULT_PRIMARY_DIE_COLOR,
		DEFAULT_PRIMARY_DIE_LABEL_COLOR,
		getPrimaryDiePreferences,
		isDiceSoNiceActive,
		setPrimaryDiePreferences,
	} from '../../settings/diceSoNiceSettings.js';

	let { dialog }: DiceSoNiceSettingsDialogProps = $props();

	const t = (key: string) => localize(`NIMBLE.settings.diceSoNiceMenu.${key}`);

	const moduleActive = isDiceSoNiceActive();

	const preferences = $state(getPrimaryDiePreferences());

	const colorRows = [
		{ shortKey: 'dsnPrimaryDieColor', field: 'background' },
		{ shortKey: 'dsnPrimaryDieLabelColor', field: 'foreground' },
	] as const;

	function resetToDefaults() {
		preferences.background = DEFAULT_PRIMARY_DIE_COLOR;
		preferences.foreground = DEFAULT_PRIMARY_DIE_LABEL_COLOR;
	}

	async function save() {
		try {
			await setPrimaryDiePreferences({ ...preferences });
		} catch (error) {
			console.error(error);
			ui.notifications?.error(t('saveError'));
			return;
		}

		ui.notifications?.info(t('saved'));
		dialog.close();
	}
</script>

<article class="nimble-sheet__body nimble-dsn-settings">
	<p class="nimble-dsn-settings__intro">{t('intro')}</p>

	{#if !moduleActive}
		<p class="nimble-dsn-settings__warning">{t('moduleMissing')}</p>
	{/if}

	<fieldset class="nimble-dsn-settings__section">
		<legend class="nimble-dsn-settings__section-title">{t('sectionPrimaryDie')}</legend>

		<div class="nimble-dsn-settings__rows">
			<div class="nimble-dsn-settings__row">
				<div class="nimble-dsn-settings__text">
					<label class="nimble-dsn-settings__label" for="nimble-dsn-enabled">
						{localize('NIMBLE.settings.dsnPrimaryDieStyleEnabled.name')}
					</label>
					<p class="nimble-dsn-settings__hint">
						{localize('NIMBLE.settings.dsnPrimaryDieStyleEnabled.hint')}
					</p>
				</div>

				<input
					id="nimble-dsn-enabled"
					type="checkbox"
					checked={preferences.enabled}
					onchange={({ currentTarget }) => {
						preferences.enabled = currentTarget.checked;
					}}
				/>
			</div>

			{#each colorRows as row (row.shortKey)}
				<div class="nimble-dsn-settings__row">
					<div class="nimble-dsn-settings__text">
						<label class="nimble-dsn-settings__label" for={`nimble-dsn-${row.shortKey}`}>
							{localize(`NIMBLE.settings.${row.shortKey}.name`)}
						</label>
						<p class="nimble-dsn-settings__hint">
							{localize(`NIMBLE.settings.${row.shortKey}.hint`)}
						</p>
					</div>

					<input
						id={`nimble-dsn-${row.shortKey}`}
						type="color"
						class="nimble-dsn-settings__color-picker"
						disabled={!preferences.enabled}
						value={preferences[row.field]}
						oninput={({ currentTarget }) => {
							preferences[row.field] = currentTarget.value;
						}}
					/>
				</div>
			{/each}
		</div>

		<div
			class="nimble-dsn-settings__preview"
			class:nimble-dsn-settings__preview--muted={!preferences.enabled}
			style={`--nimble-dsn-preview-background: ${preferences.background}; --nimble-dsn-preview-foreground: ${preferences.foreground};`}
		>
			<span class="nimble-dsn-settings__preview-die">20</span>
			<span class="nimble-dsn-settings__preview-label">{t('preview')}</span>
		</div>
	</fieldset>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" type="button" onclick={resetToDefaults}>
		{t('reset')}
	</button>

	<button class="nimble-button" data-button-variant="basic" type="button" onclick={save}>
		{t('save')}
	</button>
</footer>

<style lang="scss">
	.nimble-dsn-settings {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		&__intro,
		&__warning {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
		}

		&__warning {
			padding: 0.5rem 0.625rem;
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-inline-start: 3px solid var(--nimble-attack-roll-color, #8a1c1c);
			border-radius: 6px;
		}

		&__section {
			margin: 0;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 0.625rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__section-title {
			margin-inline-start: 0.3rem;
			padding-inline: 0.3rem;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__rows {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
			gap: 0.75rem;
		}

		&__text {
			display: flex;
			flex-direction: column;
			gap: 0.1875rem;
			min-width: 0;
		}

		&__label {
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__hint {
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
		}

		&__color-picker {
			inline-size: 2.5rem;
			block-size: 1.75rem;
			padding: 0;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;

			&:disabled {
				cursor: not-allowed;
				opacity: 0.5;
			}
		}

		&__preview {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			&--muted {
				opacity: 0.4;
			}
		}

		&__preview-die {
			display: grid;
			place-items: center;
			inline-size: 2rem;
			block-size: 2rem;
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dsn-preview-foreground);
			background: var(--nimble-dsn-preview-background);
			border-radius: 6px;
		}

		&__preview-label {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		display: flex;
		gap: 0.5rem;
	}
</style>
