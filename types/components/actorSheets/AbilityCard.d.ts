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
	/** indent under an attack sequence */
	nested?: boolean;
	/** the text is open; it starts open */
	open?: boolean;
	onuse?: () => void;
	onedit?: () => void;
	touch?: boolean;
	/** just = you just used it; out = no uses left; both after the last use */
	state?: 'just' | 'out' | 'just out';
	id?: string;
}
