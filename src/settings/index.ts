import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';

const { ApplicationV2 } = foundry.applications.api;

const namespace = 'nimble';
export const settings = [
	{
		namespace,
		key: 'hideRolls',
		options: {
			name: 'nimble.settings.dice.hideRolls',
			hint: 'nimble.settings.hints.hideRolls',
			scope: 'client',
			config: false,
			default: false,
			type: Boolean,
		},
	},
];

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

	for (const setting of settings) {
		game.settings.register(
			setting.namespace as 'core',
			setting.key as 'rollMode',
			setting.options as unknown as Parameters<typeof game.settings.register>[2],
		);
	}

	game.settings.register(
		'nimble' as 'core',
		'hideRolls' as 'rollMode',
		{
			name: 'Hide Rolls by Default',
			hint: 'When enabled, skill check and weapon roll dialogs will default to hiding the roll from other players.',
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
