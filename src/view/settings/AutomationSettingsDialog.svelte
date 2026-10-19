<script lang="ts">
	import type { AutomationSettingsDialogProps } from './AutomationSettingsDialog.types.ts';

	import localize from '#utils/localize.js';
	import {
		AUTOMATION_SETTING_KEYS,
		isActionTrackingAutomationEnabled,
		isChatNotificationsAutomationEnabled,
		isCombatConvenienceAutomationEnabled,
		isDerivedConditionsAutomationEnabled,
		isHealthStateSyncAutomationEnabled,
		isMovementTrackingAutomationEnabled,
		isResourceRecoveryAutomationEnabled,
		isResourceSpendingAutomationEnabled,
		isRuleAutomationEnabled,
		readAutomationToggle,
		setAutomationToggle,
	} from '../../settings/automationSettings.js';

	type AutomationShortKey = keyof typeof AUTOMATION_SETTING_KEYS;

	interface AutomationSettingRow {
		shortKey: AutomationShortKey;
		/** Shows the `off` line under the hint. */
		hasOffLine?: boolean;
		/** Indented under this row, and disabled while this row is unchecked. */
		child?: AutomationSettingRow;
	}

	let { dialog }: AutomationSettingsDialogProps = $props();

	const t = (key: string) => localize(`NIMBLE.settings.automationMenu.${key}`);

	/** Snapshot of the stored values, used to write back only the toggles the GM changed. */
	const initialValues: Record<AutomationShortKey, boolean> = {
		applyRuleEffects: isRuleAutomationEnabled(),
		derivedConditions: isDerivedConditionsAutomationEnabled(),
		resourceRecovery: isResourceRecoveryAutomationEnabled(),
		resourceSpending: isResourceSpendingAutomationEnabled(),
		actionTracking: isActionTrackingAutomationEnabled(),
		healthStateSync: isHealthStateSyncAutomationEnabled(),
		combatConvenience: isCombatConvenienceAutomationEnabled(),
		chatNotifications: isChatNotificationsAutomationEnabled(),
		movementTracking: isMovementTrackingAutomationEnabled(),
		movementOffers: readAutomationToggle(AUTOMATION_SETTING_KEYS.movementOffers),
	};

	const toggles = $state({ ...initialValues });

	const sections: { legendKey: string; rows: AutomationSettingRow[] }[] = [
		{
			legendKey: 'sectionFeaturesEffects',
			rows: [{ shortKey: 'applyRuleEffects', hasOffLine: true }, { shortKey: 'derivedConditions' }],
		},
		{
			legendKey: 'sectionResources',
			rows: [{ shortKey: 'resourceRecovery' }, { shortKey: 'resourceSpending', hasOffLine: true }],
		},
		{
			legendKey: 'sectionCombat',
			rows: [
				{ shortKey: 'actionTracking' },
				{ shortKey: 'healthStateSync' },
				{ shortKey: 'combatConvenience' },
			],
		},
		{
			legendKey: 'sectionMovement',
			rows: [
				{
					shortKey: 'movementTracking',
					hasOffLine: true,
					child: { shortKey: 'movementOffers', hasOffLine: true },
				},
			],
		},
		{ legendKey: 'sectionChat', rows: [{ shortKey: 'chatNotifications' }] },
	];

	async function save() {
		if (!game.user?.isGM) {
			ui.notifications?.warn(t('gmOnly'));
			return;
		}

		try {
			for (const shortKey of Object.keys(AUTOMATION_SETTING_KEYS) as AutomationShortKey[]) {
				if (toggles[shortKey] !== initialValues[shortKey]) {
					await setAutomationToggle(AUTOMATION_SETTING_KEYS[shortKey], toggles[shortKey]);
					initialValues[shortKey] = toggles[shortKey];
				}
			}
		} catch (error) {
			console.error(error);
			ui.notifications?.error(t('saveError'));
			return;
		}

		ui.notifications?.info(t('saved'));
		dialog.close();
	}
</script>

{#snippet settingRow(row: AutomationSettingRow, disabled: boolean)}
	{@const inputId = `nimble-automation-${row.shortKey}`}
	{@const hintId = `${inputId}-hint`}
	{@const offId = `${inputId}-off`}
	<div
		class="nimble-automation-settings__row"
		class:nimble-automation-settings__row--disabled={disabled}
	>
		<div class="nimble-automation-settings__text">
			<label class="nimble-automation-settings__label" for={inputId}>
				{localize(`NIMBLE.settings.${row.shortKey}.name`)}
			</label>
			<p id={hintId} class="nimble-automation-settings__hint">
				{localize(`NIMBLE.settings.${row.shortKey}.hint`)}
			</p>
			{#if row.hasOffLine}
				<p id={offId} class="nimble-automation-settings__off">
					{localize(`NIMBLE.settings.${row.shortKey}.off`)}
				</p>
			{/if}
		</div>

		<input
			id={inputId}
			class="nimble-automation-settings__checkbox"
			type="checkbox"
			aria-describedby={row.hasOffLine ? `${hintId} ${offId}` : hintId}
			checked={toggles[row.shortKey]}
			{disabled}
			onchange={({ currentTarget }) => {
				toggles[row.shortKey] = currentTarget.checked;
			}}
		/>
	</div>

	{#if row.child}
		<div class="nimble-automation-settings__child">
			{@render settingRow(row.child, disabled || !toggles[row.shortKey])}
		</div>
	{/if}
{/snippet}

<article class="nimble-sheet__body nimble-automation-settings">
	<p class="nimble-automation-settings__intro">{t('intro')}</p>

	{#each sections as section (section.legendKey)}
		<fieldset class="nimble-automation-settings__section">
			<legend class="nimble-automation-settings__section-title">{t(section.legendKey)}</legend>

			{#each section.rows as row (row.shortKey)}
				{@render settingRow(row, false)}
			{/each}
		</fieldset>
	{/each}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" type="button" onclick={save}>
		{t('save')}
	</button>
</footer>

<style lang="scss">
	.nimble-automation-settings {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			color: var(--nimble-dark-text-color);
		}

		&__section {
			margin: 0;
			min-width: 0;
			display: flex;
			flex-direction: column;
			padding: 0.25rem 0.625rem 0.375rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__section-title {
			padding-inline: 0.25rem;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			font-weight: 900;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			color: var(--nimble-dark-text-color);
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.625rem;
			padding-block: 0.375rem;
		}

		&__row + &__row,
		&__row + &__child,
		&__child + &__row {
			border-block-start: 1px solid var(--nimble-card-border-color);
		}

		&__row--disabled &__text {
			opacity: 0.6;
		}

		&__child {
			margin-inline-start: 0.875rem;
			padding-inline-start: 0.625rem;
			border-inline-start: 2px solid var(--nimble-card-border-color);
		}

		&__text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
			overflow-wrap: anywhere;
		}

		&__label {
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__hint,
		&__off {
			margin: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.4;
		}

		&__hint {
			color: var(--nimble-dark-text-color);
		}

		&__off {
			color: var(--nimble-medium-text-color);
		}

		&__checkbox {
			margin: 0;
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
