export interface SaveTileProps {
	ability: string;
	/** signed modifier with a true minus sign: +3, +0, −1 */
	mod?: string;
	/** stacked advantage (positive) or disadvantage (negative) */
	advantage?: number;
	/** the strip with no advantage: bronze (default) or card (NPC rail) */
	stripTone?: 'bronze' | 'card';
	onclick?: () => void;
}
