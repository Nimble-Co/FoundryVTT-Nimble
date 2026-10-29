export interface ConfirmBarProps {
	question: string;
	/** default "Delete" */
	confirmLabel?: string;
	/** default "Keep" */
	cancelLabel?: string;
	onconfirm?: () => void;
	oncancel?: () => void;
}
