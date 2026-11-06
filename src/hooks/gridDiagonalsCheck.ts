import { checkGridDiagonals } from '../settings/gridDiagonalsCheck.js';

/**
 * Check again when a GM changes Grid Diagonals outside core's Settings window.
 * A change made in that window asks for a reload, and the check on ready runs
 * after it, so the two popups never open together.
 */
export function registerGridDiagonalsCheckHooks(): void {
	const onSetting = (setting: { key?: string }) => {
		if (setting?.key !== 'core.gridDiagonals') return;
		if (foundry.applications.instances.get('settings-config')) return;
		checkGridDiagonals().catch((error) => console.error(error));
	};
	Hooks.on('createSetting', onSetting);
	Hooks.on('updateSetting', onSetting);
}
