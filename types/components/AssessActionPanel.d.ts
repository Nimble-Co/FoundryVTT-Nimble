import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface AssessActionPanelProps {
	actor: NimbleCharacter;
	onDeductAction?: () => Promise<void>;
}
