export interface RowTileProps {
	/** path to the document art */
	img?: string;
	/** Font Awesome class, when there is no image */
	icon?: string;
	/** md = 32 px (character row), sm = 24 px (NPC card), win = 28 px (the head of a small window) */
	size?: 'md' | 'sm' | 'win';
}
