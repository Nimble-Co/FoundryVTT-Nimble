import dialogConfirm from '../utils/dialogConfirm.js';
import localize from '../utils/localize.js';

/**
 * Check if the current user has permission to toggle combat (GM or Assistant role).
 */
function canUserToggleCombat(): boolean {
	const user = game.user;
	if (!user) return false;
	if (user.isGM) return true;
	const assistantRoleValue = Number(CONST.USER_ROLES?.ASSISTANT ?? 3);
	return (user.role ?? 0) >= assistantRoleValue;
}

/**
 * Handle click on combat sidebar button - toggles combat for current scene.
 */
async function handleCombatToggleClick(event: Event): Promise<void> {
	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();

	const scene = canvas.scene;
	if (!scene) {
		ui.notifications?.warn('No active scene to create combat for.');
		return;
	}

	// Check if there's already a combat for this scene
	const existingCombat = game.combats?.contents.find((combat) => combat.scene?.id === scene.id);

	if (existingCombat) {
		const hasCombatants = existingCombat.combatants.size > 0;
		const hasStarted = (existingCombat.round ?? 0) > 0;

		// Confirm before ending combat if there are combatants or combat has started
		if (hasCombatants || hasStarted) {
			const confirmed = await dialogConfirm({
				title: localize('NIMBLE.combatControls.endCombatTitle'),
				content: `<p>${localize('NIMBLE.combatControls.endCombatContent')}</p>`,
				confirmLabel: localize('NIMBLE.combatControls.endCombat'),
				cancelLabel: localize('NIMBLE.combatControls.continueCombat'),
				confirmIcon: 'fa-solid fa-check',
				cancelIcon: 'fa-solid fa-xmark',
				confirmOnRight: true,
				rejectClose: false,
				modal: true,
			});

			if (confirmed) {
				await existingCombat.delete();
			}
		} else {
			// No combatants and not started, delete without confirmation
			await existingCombat.delete();
		}
	} else {
		// Create a new combat for the current scene
		await Combat.create({ scene: scene.id });
	}
}

/**
 * Block right-click context menu on combat sidebar button.
 */
function handleCombatContextMenu(event: Event): void {
	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();
}

/**
 * Register combat sidebar toggle functionality.
 * Intercepts the combat sidebar button to toggle combat instead of opening the native tracker.
 */
export default function registerCombatSidebarToggle(): void {
	// Enable combat toggle visibility for GM/Assistant users via CSS
	if (canUserToggleCombat()) {
		document.body.classList.add('nimble-combat-toggle-enabled');
	}

	// Find the combat sidebar button
	const combatSidebarButton = document.querySelector<HTMLElement>(
		'#sidebar-tabs [data-tab="combat"]',
	);

	if (!combatSidebarButton) return;

	// Intercept left-click to toggle combat
	combatSidebarButton.addEventListener('click', handleCombatToggleClick, { capture: true });

	// Block right-click context menu (native Foundry multi-encounter menu)
	combatSidebarButton.addEventListener('contextmenu', handleCombatContextMenu, { capture: true });
}
