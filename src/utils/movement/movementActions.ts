import { SYSTEM_ID } from '#system';

/** Movement action for a Free Move: Regular Movement that draws on no speed budget. */
export const FREE_MOVEMENT_ACTION = `${SYSTEM_ID}Free`;

/** Movement action for Forced Movement: a push, pull or drag the creature did not choose. */
export const FORCED_MOVEMENT_ACTION = `${SYSTEM_ID}Forced`;

type MovementActionConfig = {
	label: string;
	icon: string;
	order: number;
	teleport: boolean;
	measure: boolean;
	walls: string;
	visualize: boolean;
	canSelect: () => boolean;
	terrainAction?: string | null;
};

/**
 * Registers the system's movement actions. Must run during `init`: Foundry deep
 * freezes `CONFIG.Token.movement.actions` before `setup`.
 */
export function registerMovementActions(): void {
	const actions = CONFIG.Token?.movement?.actions as unknown as
		| Record<string, MovementActionConfig>
		| undefined;
	if (!actions) return;

	actions[FREE_MOVEMENT_ACTION] = {
		label: 'NIMBLE.movement.actions.free',
		icon: 'fa-solid fa-person-running',
		order: 50,
		teleport: false,
		measure: true,
		walls: 'move',
		visualize: true,
		canSelect: () => false,
		terrainAction: 'walk',
	};

	actions[FORCED_MOVEMENT_ACTION] = {
		label: 'NIMBLE.movement.actions.forced',
		icon: 'fa-solid fa-hand-back-fist',
		order: 51,
		teleport: false,
		measure: true,
		walls: 'move',
		visualize: true,
		canSelect: () => false,
		terrainAction: null,
	};
}

/** The movement action a Movement Offer of this kind labels its drag with. */
export function movementOfferAction(kind: 'free' | 'forced'): string {
	return kind === 'forced' ? FORCED_MOVEMENT_ACTION : FREE_MOVEMENT_ACTION;
}
