export interface MovementSpeed {
	type: string;
	value: number;
	label: string;
	icon: string;
}

/**
 * Get the movement speeds for an actor, formatted for display.
 * @param actor - The actor to get movement speeds from
 * @returns Array of movement speed objects with type, value, label, and icon
 */
export function getMovementSpeeds(actor: {
	system?: { attributes?: { movement?: Record<string, number> } };
}): MovementSpeed[] {
	const { movementTypes, movementTypeIcons } = CONFIG.NIMBLE;
	const movement = actor.system?.attributes?.movement ?? {};
	const speeds: MovementSpeed[] = [];

	// Always show walk first if it exists
	if (movement.walk > 0) {
		speeds.push({
			type: 'walk',
			value: movement.walk,
			label: game.i18n.localize(movementTypes.walk),
			icon: movementTypeIcons.walk,
		});
	}

	// Add other movement types if non-zero
	for (const type of ['fly', 'climb', 'swim', 'burrow']) {
		if (movement[type] > 0) {
			speeds.push({
				type,
				value: movement[type],
				label: game.i18n.localize(movementTypes[type]),
				icon: movementTypeIcons[type],
			});
		}
	}

	return speeds;
}
