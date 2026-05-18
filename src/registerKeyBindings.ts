import { SYSTEM_ID } from '#system';

export default function registerKeybindings() {
	game.keybindings.register(SYSTEM_ID, 'system-settings-open-close', {
		name: 'Open/Close System Settings',
		editable: [{ key: 'KeyS', modifiers: ['ALT'] }],
		onDown: () => {
			// Open Foundry's Configure Settings dialog and switch to System tab
			const app = game.settings.sheet;
			if (app.rendered) {
				app.close();
			} else {
				app.render(true);
			}
		},
	});
}
