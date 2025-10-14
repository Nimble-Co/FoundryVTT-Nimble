const { ApplicationV2 } = foundry.applications.api;

/**
 * Placeholder class for the upcoming System Settings feature
 */
class SystemSettingsPlaceholder extends ApplicationV2 {
	constructor() {
		super({});
	}

	override async render(): Promise<this> {
		ui.notifications?.info('System Settings - Coming Soon!');
		return this;
	}
}

export default function registerSystemSettings() {
	game.settings.registerMenu('nimble', 'SystemSettings', {
		name: 'System Settings',
		label: 'Coming Soon...',
		icon: 'fas fa-bars',
		// @ts-expect-error - Using placeholder until full implementation
		type: SystemSettingsPlaceholder,
		restricted: false,
	});
}
