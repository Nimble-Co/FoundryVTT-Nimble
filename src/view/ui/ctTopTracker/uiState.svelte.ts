import { resolveMonsterCardsExpandedState } from './state.js';

export class CtTopTrackerUiState {
	monsterCardsExpanded = $state(false);

	toggleMonsterCardsExpanded(canCurrentUserExpandMonsterCards: boolean): boolean {
		if (!canCurrentUserExpandMonsterCards) return false;
		this.monsterCardsExpanded = !this.monsterCardsExpanded;
		return true;
	}

	syncMonsterCardsExpanded(params: {
		hasMonsterCombatants: boolean;
		canCurrentUserExpandMonsterCards: boolean;
	}): void {
		const normalizedMonsterCardsExpanded = resolveMonsterCardsExpandedState({
			hasMonsterCombatants: params.hasMonsterCombatants,
			canCurrentUserExpandMonsterCards: params.canCurrentUserExpandMonsterCards,
			monsterCardsExpanded: this.monsterCardsExpanded,
		});
		if (this.monsterCardsExpanded !== normalizedMonsterCardsExpanded) {
			this.monsterCardsExpanded = normalizedMonsterCardsExpanded;
		}
	}
}
