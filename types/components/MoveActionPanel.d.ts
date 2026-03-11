import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface MoveActionPanelProps {
	actor: NimbleCharacter;
	inCombat?: boolean;
	actionsRemaining?: number;
	onDeductAction?: () => Promise<void>;
}
