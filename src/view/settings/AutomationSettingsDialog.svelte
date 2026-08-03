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
		isResourceRecoveryAutomationEnabled,
		isResourceSpendingAutomationEnabled,
		isRuleAutomationEnabled,
		setAutomationToggle,
	} from '../../settings/automationSettings.js';

	type AutomationShortKey = keyof typeof AUTOMATION_SETTING_KEYS;

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
	};

	const toggles = $state({ ...initialValues });

	const sections: { legendKey: string; shortKeys: AutomationShortKey[] }[] = [
		{ legendKey: 'sectionRulesEffects', shortKeys: ['applyRuleEffects', 'derivedConditions'] },
		{ legendKey: 'sectionResources', shortKeys: ['resourceRecovery', 'resourceSpending'] },
		{
			legendKey: 'sectionCombat',
			shortKeys: ['actionTracking', 'healthStateSync', 'combatConvenience'],
		},
		{ legendKey: 'sectionChat', shortKeys: ['chatNotifications'] },
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

<article class="nimble-sheet__body nimble-automation-settings">
	<p class="nimble-automation-settings__intro">{t('intro')}</p>

	{#each sections as section (section.legendKey)}
		<fieldset class="nimble-automation-settings__section">
			<legend class="nimble-automation-settings__section-title">{t(section.legendKey)}</legend>

			<div class="nimble-automation-settings__rows">
				{#each section.shortKeys as shortKey (shortKey)}
					<div class="nimble-automation-settings__row">
						<div class="nimble-automation-settings__text">
							<label
								class="nimble-automation-settings__label"
								for={`nimble-automation-${shortKey}`}
							>
								{localize(`NIMBLE.settings.${shortKey}.name`)}
							</label>
							<p class="nimble-automation-settings__hint">
								{localize(`NIMBLE.settings.${shortKey}.hint`)}
							</p>
						</div>

						<input
							id={`nimble-automation-${shortKey}`}
							type="checkbox"
							checked={toggles[shortKey]}
							onchange={({ currentTarget }) => {
								toggles[shortKey] = currentTarget.checked;
							}}
						/>
					</div>
				{/each}
			</div>
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
		gap: 0.75rem;

		&__intro {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			color: var(--nimble-medium-text-color);
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
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
