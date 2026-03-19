import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface AssessActionDialogProps {
	document: NimbleCharacter;
	dialog: {
		submit: (result: {
			option: string;
			skill: string;
			isSuccess: boolean;
			target?: string;
		}) => void;
		close: () => void;
	};
	deductActionPip: () => Promise<void>;
	inCombat?: boolean;
}
