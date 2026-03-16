export interface WeaponCardProps {
	name: string;
	image?: string | null;
	icon?: string;
	damage?: string | null;
	properties?: string[];
	description?: string | null;
	isExpanded?: boolean;
	disabled?: boolean;
	showImage?: boolean;
	itemId?: string | null;
	onToggleDescription?: ((event: MouseEvent) => void) | null;
	onclick?: () => void;
	ondragstart?: ((event: DragEvent) => void) | null;
}
