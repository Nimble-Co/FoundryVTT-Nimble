import { isActiveGM } from '#utils/isActiveGM.js';

interface ClaimingCard {
	claimFirstAttackHalves?(): Promise<void>;
}

/** An attack card uses each target's first-attack halve when it is made, also on a miss. */
export function registerFirstAttackHalveHooks(): void {
	Hooks.on('createChatMessage', (card: unknown) => {
		if (!isActiveGM()) return;
		void (card as ClaimingCard).claimFirstAttackHalves?.();
	});
}
