/**
 * A number that goes up each time the user targets or untargets a token. Read it where a
 * value depends on `game.user.targets`, so the value is worked out again on a retarget.
 */
export function useTargetChanges() {
	let version = $state(0);

	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			version += 1;
		});
		return () => {
			Hooks.off('targetToken', hookId);
		};
	});

	return {
		get version() {
			return version;
		},
	};
}
