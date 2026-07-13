export interface WeaponCardToggle {
	enabled: boolean;
	ariaLabel: string;
	onClick: (event: MouseEvent) => void | Promise<void>;
}

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
	toggle?: WeaponCardToggle | null;
	onToggleDescription?: ((event: MouseEvent) => void) | null;
	onclick?: () => void;
	ondragstart?: ((event: DragEvent) => void) | null;
}
