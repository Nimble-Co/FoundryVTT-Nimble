import type { Snippet } from 'svelte';
import type { RowUses } from '#view/actorSheets/parts/types.ts';

export interface AbilityCardProps {
	name: string;
	/** the document art */
	img?: string;
	/** Font Awesome class, when there is no image */
	icon?: string;
	/** roll = d20, opens the roll window; chat = speech bubble, posts to chat */
	kind?: 'roll' | 'chat';
	range?: string;
	uses?: RowUses;
	description?: string;
	/** the text as Foundry enriched it (inline rolls, links); shown in place of `description` */
	descriptionHtml?: string;
	/** indent under an attack sequence */
	nested?: boolean;
	/** the text is open; it starts open */
	open?: boolean;
	/** leave it out in edit mode: the name does not act */
	onuse?: () => void;
	onedit?: () => void;
	touch?: boolean;
	/** just = you just used it; out = no uses left; both after the last use */
	state?: 'just' | 'out' | 'just out';
	id?: string;
	/** edit mode: the numbers that you type and the trash button, in place of the range and the uses */
	fields?: Snippet;
	/** under the text: a ConfirmBar */
	children?: Snippet;
}
