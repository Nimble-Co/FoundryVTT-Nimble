export interface CtTopTrackerHookCallbacks {
	updateCurrentCombat: (force?: boolean) => void;
	onLayoutInvalidated: () => void;
	onSettingKeyUpdated: (settingKey: unknown) => void;
}

export function registerCtTopTrackerHooks(callbacks: CtTopTrackerHookCallbacks): () => void {
	const hooksApi = Hooks as unknown as {
		on: (hook: string, listener: (...args: unknown[]) => void) => number;
		off: (hook: string, id: number) => void;
	};
	const hooks: Array<{ hook: string; id: number }> = [];
	const register = (hook: string, listener: (...args: unknown[]) => void) => {
		hooks.push({ hook, id: hooksApi.on(hook, listener) });
	};

	register('createCombat', () => callbacks.updateCurrentCombat(true));
	register('updateCombat', () => callbacks.updateCurrentCombat(true));
	register('deleteCombat', () => callbacks.updateCurrentCombat(true));
	register('createCombatant', () => callbacks.updateCurrentCombat(true));
	register('updateCombatant', () => callbacks.updateCurrentCombat(true));
	register('deleteCombatant', () => callbacks.updateCurrentCombat(true));
	register('updateActor', () => callbacks.updateCurrentCombat(true));
	register('createToken', () => callbacks.updateCurrentCombat(true));
	register('updateToken', () => callbacks.updateCurrentCombat(true));
	register('deleteToken', () => callbacks.updateCurrentCombat(true));
	register('canvasReady', () => callbacks.updateCurrentCombat(true));
	register('updateScene', () => callbacks.updateCurrentCombat(true));
	register('renderSceneNavigation', () => {
		callbacks.onLayoutInvalidated();
		callbacks.updateCurrentCombat(true);
	});
	register('combatStart', () => callbacks.updateCurrentCombat(true));
	register('combatTurn', () => callbacks.updateCurrentCombat(true));
	register('combatRound', () => callbacks.updateCurrentCombat(true));
	register('updateSetting', (setting: unknown) => {
		const settingKey =
			setting && typeof setting === 'object'
				? foundry.utils.getProperty(setting, 'key')
				: undefined;
		callbacks.onSettingKeyUpdated(settingKey);
	});

	return () => {
		for (const { hook, id } of hooks) {
			hooksApi.off(hook, id);
		}
	};
}
