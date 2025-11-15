import { SystemSettings } from './settings/SystemSettings';

export default function registerKeybindings() {
	game.keybindings.register('nimble', 'system-settings-open-close', {
		name: 'Open/Close System Settings',
		editable: [{ key: 'KeyS', modifiers: ['Alt'] }],
		onDown: () => {
			new SystemSettings().render(true);
		},
	});
}
