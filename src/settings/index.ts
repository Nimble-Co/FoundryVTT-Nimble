import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';

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
		hint: 'Configure system settings for the Nimble RPG system',
		label: 'Coming Soon...',
		icon: 'fas fa-bars',
		type: SystemSettingsPlaceholder,
		restricted: false,
	});

	game.settings.register(
		'nimble' as 'core',
		'autoExpandRolls' as 'rollMode',
		{
			name: 'Auto-Expand Rolls',
			hint: 'When enabled, dice roll details are shown inline below each roll in chat messages, without needing to hover.',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// Migration schema version tracking
	game.settings.register(
		'nimble' as 'core',
		'worldSchemaVersion' as 'rollMode',
		{
			name: 'World Schema Version',
			hint: 'Tracks the current migration version of this world',
			scope: 'world',
			config: false,
			type: Number,
			default: MigrationRunnerBase.MINIMUM_SAFE_VERSION,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}
