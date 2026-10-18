let registered = false;

function isActorConditionEffect(effect: ActiveEffect): boolean {
	if (effect.parent?.documentName !== 'Actor') return false;
	const conditions = CONFIG.NIMBLE.conditions as Record<string, string>;
	return [...effect.statuses].some((statusId) => Object.hasOwn(conditions, statusId));
}

function setsExpired(changed: object): boolean {
	return (changed as { duration?: { expired?: unknown } }).duration?.expired === true;
}

async function deleteExpiredCondition(effect: ActiveEffect): Promise<void> {
	if (!effect.id || !effect.parent?.effects.has(effect.id)) return;
	try {
		await effect.delete();
	} catch (error) {
		console.warn('Nimble | Failed to remove an expired condition:', error);
	}
}

/**
 * Core only marks an expired effect `duration.expired`, so a condition would stay on the actor,
 * switched off. Deleting it lets the condition be applied again and removes its linked
 * conditions through the delete path. Only the client that made the update deletes, so it runs
 * once.
 */
export function registerConditionExpiryHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateActiveEffect', async (effect, changed, _options, userId) => {
		if (userId !== game.user?.id) return;
		if (!setsExpired(changed) || !isActorConditionEffect(effect)) return;
		await deleteExpiredCondition(effect);
	});
}
