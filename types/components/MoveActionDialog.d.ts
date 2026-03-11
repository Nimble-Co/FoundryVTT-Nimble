import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface MoveActionDialogProps {
	document: NimbleCharacter;
	dialog: {
		submit: (result: { confirmed: boolean }) => void;
		close: () => void;
	};
	deductActionPip: () => Promise<void>;
	inCombat?: boolean;
}
