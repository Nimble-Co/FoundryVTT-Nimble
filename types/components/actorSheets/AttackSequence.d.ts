import type { Snippet } from 'svelte';
import type { SequencePart } from '#view/actorSheets/parts/types.ts';

export interface AttackSequenceProps {
	parts?: SequencePart[];
	/** the text of the sequence as Foundry enriched it; shown in place of `parts` */
	html?: string;
	/** the name of the sequence, for the label of the pen */
	name?: string;
	/** the pen: open the window of the sequence */
	onedit?: () => void;
	touch?: boolean;
	/** edit mode: the trash button, before the pen */
	fields?: Snippet;
	/** under the note: a ConfirmBar */
	children?: Snippet;
}
