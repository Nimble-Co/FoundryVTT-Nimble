import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import OptionalRulesSettingsDialog from '../view/dialogs/OptionalRulesSettingsDialog.svelte';
import { settings } from './settings.js';

const { ApplicationV2 } = foundry.applications.api;

export class OptionalRulesSettings extends SvelteApplicationMixin(ApplicationV2) {
	data: Record<string, any>;

	root = OptionalRulesSettingsDialog;

	store = $state();

	public promise = null;

	public resolve = null;

	constructor(options = {}, _dialogData = {}) {
		// ApplicationV2 does take options - TypeScript limitation
		super(
			// @ts-expect-error
			foundry.utils.mergeObject(options, {
				id: 'nimble-optional-rules-settings',
				classes: ['nimble-sheet', 'nimble-sheet--settings'],
				position: { width: 650, height: 'auto' },
				window: { title: 'NIMBLE.settings.optionalRulesMenu.name', icon: 'fa-solid fa-cog' },
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
				const value: unknown = game.settings.get(setting.namespace, setting.key);

				acc[setting.key] = {
					data: setting.options,
					value,
				};

				return acc;
			},
			{} as Record<string, { data: unknown; value: unknown }>,
		);
	}

	static getActiveApp(): OptionalRulesSettings {
		// @ts-expect-error
		return Object.values(ui.windows).find((app) => app.id === 'nimble-optional-rules-settings');
	}

	static async show(options = {}, dialogData = {}) {
		const app = OptionalRulesSettings.getActiveApp();
		if (app) return app.render(false, { focus: true });

		return new Promise((resolve) => {
			// @ts-expect-error
			options.resolve = resolve;

			new OptionalRulesSettings(options, dialogData).render(true, { focus: true });
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
