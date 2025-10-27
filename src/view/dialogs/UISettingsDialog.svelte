<script lang="ts">
const { settings }: { settings: Record<string, any> } = $props();

// UI-specific settings
const uiSettings = [
	'conditionHUD',
	'reactionPrompts',
	'assessHelper',
	'displayConditionsIcons',
	'showSkillTooltips',
	'showBoons',
	'debugLogs',
];

function _handleChange(key: string, value: any) {
	settings[key].value = value;
	game.settings.set('nimble', key, value);
}

function _handleMultiselectChange(key: string, selectedOptions: string[]) {
	settings[key].value = selectedOptions;
	game.settings.set('nimble', key, selectedOptions);
}

function _getUISettings() {
	return uiSettings
		.map(key => ({ key, ...settings[key] }))
		.filter(setting => setting.data);
}

function _isMultiselect(setting: any): boolean {
	return setting.data.type === Array && setting.data.choices;
}
</script>

<div class="system-settings-dialog">
	<h2>{game.i18n.localize('NIMBLE.settings.uiMenu.name')}</h2>

	<form class="settings-list">
		<div class="category-section">
			{#each _getUISettings() as setting}
				<div class="setting-item">
					<div class="setting-header">
						<label for={setting.key}>{game.i18n.localize(setting.data.name)}</label>
						{#if setting.data.hint}
							<p class="hint">{game.i18n.localize(setting.data.hint)}</p>
						{/if}
					</div>
					<div class="setting-input">
						{#if setting.data.type === Boolean}
							<input
								type="checkbox"
								id={setting.key}
								checked={setting.value}
								onchange={(e) => _handleChange(setting.key, e.target.checked)}
							/>
						{:else if setting.data.type === Number}
							<input
								type="number"
								id={setting.key}
								value={setting.value}
								min={setting.data.range?.min}
								max={setting.data.range?.max}
								step={setting.data.range?.step}
								oninput={(e) => _handleChange(setting.key, Number(e.target.value))}
							/>
						{:else if setting.data.type === String && setting.data.choices}
							<select
								id={setting.key}
								value={setting.value}
								onchange={(e) => _handleChange(setting.key, e.target.value)}
							>
								{#each Object.entries(setting.data.choices) as [value, label]}
									<option value={value}>{game.i18n.localize(label)}</option>
								{/each}
							</select>
						{:else if _isMultiselect(setting)}
							<div class="multiselect-container">
								{#each Object.entries(setting.data.choices) as [value, label]}
									<label class="checkbox-label">
										<input
											type="checkbox"
											value={value}
											checked={setting.value.includes(value)}
											onchange={(e) => {
												const newValue = e.target.checked
													? [...setting.value, value]
													: setting.value.filter(v => v !== value);
												_handleMultiselectChange(setting.key, newValue);
											}}
										/>
										<span>{game.i18n.localize(label)}</span>
									</label>
								{/each}
							</div>
						{:else if setting.data.type === String}
							<input
								type="text"
								id={setting.key}
								value={setting.value}
								oninput={(e) => _handleChange(setting.key, e.target.value)}
							/>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</form>
</div>

<style>
	.system-settings-dialog {
		padding: 1rem;
		max-height: 70vh;
		overflow-y: auto;
	}

	h2 {
		margin-top: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-border-light-primary, #ccc);
		padding-bottom: 0.5rem;
	}

	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.category-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.setting-item {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem;
		border-radius: 4px;
	}

	.setting-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.setting-header label {
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
	}

	.hint {
		margin: 0;
		font-size: 0.85rem;
		font-style: italic;
	}

	.setting-input {
		display: flex;
		align-items: center;
	}

	.setting-input input[type="checkbox"] {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.setting-input input[type="number"],
	.setting-input input[type="text"] {
		min-width: 200px;
		padding: 0.5rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.setting-input input[type="number"]:focus,
	.setting-input input[type="text"]:focus,
	.setting-input select:focus {
		outline: none;
		border-color: var(--color-border-highlight-primary, #4a90e2);
		box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
	}

	.setting-input select {
		min-width: 200px;
		padding: 0.5rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.multiselect-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		max-height: 200px;
		overflow-y: auto;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.checkbox-label:hover {
		border-radius: 4px;
	}

	.checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.checkbox-label span {
		font-size: 0.9rem;
	}
</style>
