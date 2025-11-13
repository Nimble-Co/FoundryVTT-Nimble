<script lang="ts">
const { settings }: { settings: Record<string, any> } = $props();

// Organize settings by category
const categories = {
	ui: [
		'conditionHUD',
		'reactionPrompts',
		'assessHelper',
		'displayConditionsIcons',
		'showSkillTooltips',
		'showBoons',
		'debugLogs',
		'languageSet',
	],
	variantRules: [
		'multiclassing',
		'largeGroups',
		'fastResting',
		'criticalHealing',
		'thrownPotions',
		'suckerPunch',
		'inspiration',
		'keyStatSwap',
		'complexCharacters',
		'customWeaponDice',
		'measurementSystem',
		'grittyDying',
		'grittyDyingPenalty',
	],
};

const _categoryLabels = {
	variantRules: 'Optional Rules & Variants',
	ui: 'UI & Quality of Life',
};

function _handleChange(key: string, value: any) {
	settings[key].value = value;
	game.settings.set('nimble', key, value);
}

function _handleMultiselectChange(key: string, selectedOptions: string[]) {
	settings[key].value = selectedOptions;
	game.settings.set('nimble', key, selectedOptions);
}

function _getSettingsByCategory(category: string) {
	return categories[category]
		.map(key => ({ key, ...settings[key] }))
		.filter(setting => setting.data);
}

function _isMultiselect(setting: any): boolean {
	return setting.data.type === Array && setting.data.choices;
}

function _isFlexibleArray(setting: any): boolean {
	return setting.data.type === Array && !setting.data.choices;
}

function _isLanguageSet(setting: any): boolean {
	return setting.key === 'languageSet' && setting.data.type === Object;
}

let newLanguageInput = $state('');

// Language Set handlers
function _toggleDefaultLanguage(key: string, language: string, enabled: boolean) {
	const current = settings[key].value || { defaults: {}, custom: [] };
	const updated = {
		...current,
		defaults: {
			...current.defaults,
			[language]: {
				...current.defaults[language],
				enabled,
			},
		},
	};
	settings[key].value = updated;
	game.settings.set('nimble', key, updated);
}

function _updateLanguageAlias(key: string, language: string, alias: string) {
	const current = settings[key].value || { defaults: {}, custom: [] };
	const updated = {
		...current,
		defaults: {
			...current.defaults,
			[language]: {
				...current.defaults[language],
				alias: alias.trim(),
			},
		},
	};
	settings[key].value = updated;
	game.settings.set('nimble', key, updated);
}

function _addCustomLanguage(key: string) {
	if (!newLanguageInput.trim()) return;
	const current = settings[key].value || { defaults: {}, custom: [] };
	if (current.custom.includes(newLanguageInput.trim())) {
		newLanguageInput = '';
		return;
	}
	const updated = {
		...current,
		custom: [...current.custom, newLanguageInput.trim()],
	};
	settings[key].value = updated;
	game.settings.set('nimble', key, updated);
	newLanguageInput = '';
}

function _removeCustomLanguage(key: string, language: string) {
	const current = settings[key].value || { defaults: {}, custom: [] };
	const updated = {
		...current,
		custom: current.custom.filter(lang => lang !== language),
	};
	settings[key].value = updated;
	game.settings.set('nimble', key, updated);
}

// Generic flexible array handlers
function _addLanguage(key: string) {
	if (!newLanguageInput.trim()) return;
	const currentLanguages = settings[key].value || [];
	if (currentLanguages.includes(newLanguageInput.trim())) {
		newLanguageInput = '';
		return;
	}
	const newLanguages = [...currentLanguages, newLanguageInput.trim()];
	settings[key].value = newLanguages;
	game.settings.set('nimble', key, newLanguages);
	newLanguageInput = '';
}

function _removeLanguage(key: string, language: string) {
	const currentLanguages = settings[key].value || [];
	const newLanguages = currentLanguages.filter(lang => lang !== language);
	settings[key].value = newLanguages;
	game.settings.set('nimble', key, newLanguages);
}
</script>

<div class="system-settings-dialog">
	<h2>{game.i18n.localize('NIMBLE.settings.menu.name')}</h2>

	<form class="settings-list">
		{#each Object.keys(categories) as category}
			{@const categorySettings = _getSettingsByCategory(category)}
			{#if categorySettings.length > 0}
				<div class="category-section">
					<h3 class="category-heading">{_categoryLabels[category]}</h3>
					{#each categorySettings as setting}
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
								{:else if _isLanguageSet(setting)}
									<div class="language-set-container">
										<!-- Default Languages -->
										<div class="language-section">
											<h4 class="language-section-title">Default Languages</h4>
											{#if !setting.value || !setting.value.defaults}
												<p class="error-message">
													⚠️ Language set data structure mismatch. Expected object with 'defaults' and 'custom' properties.
													<br/>
													Current value type: {typeof setting.value} {Array.isArray(setting.value) ? '(Array)' : ''}
													<br/>
													<button type="button" onclick={() => {
														game.settings.set('nimble', 'languageSet', setting.data.default);
														window.location.reload();
													}}>
														Reset to Default Structure
													</button>
												</p>
											{:else}
											<div class="default-languages-grid">
												{#each Object.entries(setting.value?.defaults || {}) as [language, config]}
													<div class="default-language-row">
														<label class="language-checkbox">
															<input
																type="checkbox"
																checked={config.enabled}
																onchange={(e) => _toggleDefaultLanguage(setting.key, language, e.target.checked)}
															/>
															<span class="language-name">{language}</span>
														</label>
														{#if config.enabled}
															<input
																type="text"
																class="alias-input"
																placeholder="Alias (optional)"
																value={config.alias || ''}
																oninput={(e) => _updateLanguageAlias(setting.key, language, e.target.value)}
															/>
														{/if}
													</div>
												{/each}
											</div>
											{/if}
										</div>

										<!-- Custom Languages -->
										<div class="language-section">
											<h4 class="language-section-title">Custom Languages</h4>
											<div class="tags-list">
												{#each (setting.value?.custom || []) as language}
													<div class="tag-chip">
														<span>{language}</span>
														<button
															type="button"
															class="tag-remove"
															onclick={() => _removeCustomLanguage(setting.key, language)}
															title="Remove {language}"
														>
															×
														</button>
													</div>
												{/each}
											</div>
											<div class="tag-input-row">
												<input
													type="text"
													class="tag-input"
													placeholder="Add custom language..."
													bind:value={newLanguageInput}
													onkeydown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															_addCustomLanguage(setting.key);
														}
													}}
												/>
												<button
													type="button"
													class="tag-add-btn"
													onclick={() => _addCustomLanguage(setting.key)}
													disabled={!newLanguageInput.trim()}
												>
													Add
												</button>
											</div>
										</div>
									</div>
								{:else if _isFlexibleArray(setting)}
									<div class="tag-input-container">
										<div class="tags-list">
											{#each (setting.value || []) as item}
												<div class="tag-chip">
													<span>{item}</span>
													<button
														type="button"
														class="tag-remove"
														onclick={() => _removeLanguage(setting.key, item)}
														title="Remove {item}"
													>
														×
													</button>
												</div>
											{/each}
										</div>
										<div class="tag-input-row">
											<input
												type="text"
												class="tag-input"
												placeholder="Add new language..."
												bind:value={newLanguageInput}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														_addLanguage(setting.key);
													}
												}}
											/>
											<button
												type="button"
												class="tag-add-btn"
												onclick={() => _addLanguage(setting.key)}
												disabled={!newLanguageInput.trim()}
											>
												Add
											</button>
										</div>
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
			{/if}
		{/each}
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

	.category-heading {
		margin: 0;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--color-border-light-primary, #ddd);
		font-size: 1.1rem;
		font-weight: 600;
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

	.error-message {
		padding: 1rem;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		color: #856404;
		font-size: 0.9rem;
	}

	.error-message button {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: #ffc107;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.error-message button:hover {
		background: #e0a800;
	}

	/* Language Set Styles */
	.language-set-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		min-width: 500px;
	}

	.language-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.language-section-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border-light-tertiary, #e0e0e0);
	}

	.default-languages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.5rem;
	}

	.default-language-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.language-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.language-checkbox input[type='checkbox'] {
		margin: 0;
		cursor: pointer;
	}

	.language-name {
		font-weight: 500;
	}

	.alias-input {
		padding: 0.25rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid var(--color-border-light-tertiary, #e0e0e0);
		border-radius: 3px;
		margin-left: 1.5rem;
	}

	.alias-input:focus {
		outline: none;
		border-color: var(--color-border-highlight, #0066cc);
	}

	/* Tag/Chip Input Styles */
	.tag-input-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		min-width: 300px;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-height: 32px;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.6rem;
		background: var(--color-border-highlight-primary, #4a90e2);
		color: white;
		border-radius: 16px;
		font-size: 0.85rem;
		transition: background 0.2s;
	}

	.tag-chip:hover {
		background: var(--color-border-highlight-secondary, #357abd);
	}

	.tag-remove {
		background: none;
		border: none;
		color: white;
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background 0.2s;
	}

	.tag-remove:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.tag-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.tag-input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--color-border-light-primary, #ccc);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.tag-input:focus {
		outline: none;
		border-color: var(--color-border-highlight-primary, #4a90e2);
		box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
	}

	.tag-add-btn {
		padding: 0.5rem 1rem;
		background: var(--color-border-highlight-primary, #4a90e2);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s;
		white-space: nowrap;
	}

	.tag-add-btn:hover:not(:disabled) {
		background: var(--color-border-highlight-secondary, #357abd);
	}

	.tag-add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
