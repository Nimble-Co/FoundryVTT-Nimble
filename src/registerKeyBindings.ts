import { SystemSettings } from './settings/SystemSettings.js';

export default function registerKeybindings() {
	game.keybindings.register('nimble', 'system-settings-open-close', {
		name: 'Open/Close System Settings',
		editable: [{ key: 'KeyS', modifiers: ['ALT'] }],
		onDown: () => {
			new SystemSettings().render(true);
		},
	});
}
