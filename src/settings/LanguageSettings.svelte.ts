import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import LanguageSettingsDialog from '../view/dialogs/LanguageSettingsDialog.svelte';
import { settings } from './settings.js';

const { ApplicationV2 } = foundry.applications.api;

interface LanguageConfig {
	enabled: boolean;
	alias: string;
}

interface LanguageSet {
	defaults: Record<string, LanguageConfig>;
	custom: string[];
}

function _isLanguageSet(value: unknown): value is LanguageSet {
	if (!value || typeof value !== 'object') return false;
	const obj = value as Record<string, unknown>;

	if (!obj.defaults || typeof obj.defaults !== 'object') return false;
	if (!Array.isArray(obj.custom)) return false;

	return true;
}

export class LanguageSettings extends SvelteApplicationMixin(ApplicationV2) {
	data: Record<string, any>;

	root = LanguageSettingsDialog;

	store = $state();

	public promise = null;

	public resolve = null;

	constructor(options = {}, _dialogData = {}) {
		// ApplicationV2 does take options - TypeScript limitation
		super(
			// @ts-expect-error
			foundry.utils.mergeObject(options, {
				id: 'nimble-language-settings',
				classes: ['nimble-sheet', 'nimble-sheet--settings'],
				position: { width: 650, height: 'auto' },
				window: { title: 'NIMBLE.settings.languagesMenu.name', icon: 'fa-solid fa-cog' },
			}),
		);

		this.populateSettings();
		this.data = { settings: this.store };

		// @ts-expect-error
		this.promise = new Promise((resolve) => {
			// @ts-expect-error
			this.resolve = resolve;
		});
	}

	async _prepareContext() {
		return {
			...this.data,
			dialog: this,
		};
	}

	populateSettings() {
		this.store = settings.reduce(
			(acc, setting) => {
				// @ts-expect-error - Foundry's settings type system doesn't support dynamic keys
				let value: unknown = game.settings.get(setting.namespace, setting.key);

				// Migrate languageSet from old array structure to new object structure
				if (setting.key === 'languageSet') {
					console.log('Language Set Setting Options:', setting.options);
					console.log('Language Set Retrieved Value:', value);

					const defaultValue = setting.options.default;

					// Check if value is in old array format and migrate it
					if (Array.isArray(value)) {
						console.warn('Detected old languageSet array format. Migrating to new structure...');

						const migratedValue: LanguageSet = {
							defaults: _isLanguageSet(defaultValue) ? defaultValue.defaults : {},
							custom: value, // Old array becomes custom languages
						};

						// Save the migrated value
						// @ts-expect-error - Foundry's settings type system doesn't support dynamic keys
						game.settings.set(setting.namespace, setting.key, migratedValue);
						value = migratedValue;
						console.log('Migration complete. New structure:', value);
					}
					// Check if value is missing the expected structure
					else if (!_isLanguageSet(value)) {
						console.warn('Invalid languageSet structure detected. Resetting to default...');

						if (_isLanguageSet(defaultValue)) {
							value = defaultValue;
							// @ts-expect-error - Foundry's settings type system doesn't support dynamic keys
							game.settings.set(setting.namespace, setting.key, value);
							console.log('Reset to default structure:', value);
						}
					}
				}

				acc[setting.key] = {
					data: setting.options,
					value,
				};

				return acc;
			},
			{} as Record<string, { data: unknown; value: unknown }>,
		);
	}

	static getActiveApp(): LanguageSettings {
		// @ts-expect-error
		return Object.values(ui.windows).find((app) => app.id === 'nimble-language-settings');
	}

	static async show(options = {}, dialogData = {}) {
		const app = LanguageSettings.getActiveApp();
		if (app) return app.render(false, { focus: true });

		return new Promise((resolve) => {
			// @ts-expect-error
			options.resolve = resolve;

			new LanguageSettings(options, dialogData).render(true, { focus: true });
		});
	}

	submit(results) {
		this.#resolvePromise(results);

		if (results.reload) {
			foundry.utils.debounce(() => window.location.reload(), 250)();
		}

		return super.close();
	}

	#resolvePromise(data): void {
		if (this.resolve) {
			// @ts-expect-error
			this.resolve(data);
		}
	}
}
