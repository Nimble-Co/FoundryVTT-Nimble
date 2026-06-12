/**
 * Interaction state for the player character import dialog component: file
 * picker plumbing and drag-and-drop hover tracking. Import/preview state
 * lives on the dialog controller (`#import/playerCharacter`).
 */

/** The only controller surface this state needs (avoids a circular import). */
interface ImportDialog {
	loadFile(file: File | null | undefined): Promise<void>;
}

export function createImportPlayerCharacterDialogState(dialog: ImportDialog) {
	let fileInput = $state<HTMLInputElement | null>(null);
	let isDragging = $state(false);

	function openPicker(): void {
		fileInput?.click();
	}

	async function onFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		await dialog.loadFile(input.files?.[0]);
		// Reset so selecting the same file again still fires a change event.
		input.value = '';
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) dialog.loadFile(file);
	}

	function onDragOver(event: DragEvent): void {
		event.preventDefault();
		isDragging = true;
	}

	function onDragLeave(): void {
		isDragging = false;
	}

	return {
		get isDragging() {
			return isDragging;
		},
		get fileInput() {
			return fileInput;
		},
		set fileInput(element: HTMLInputElement | null) {
			fileInput = element;
		},
		openPicker,
		onFileChange,
		onDrop,
		onDragOver,
		onDragLeave,
	};
}
