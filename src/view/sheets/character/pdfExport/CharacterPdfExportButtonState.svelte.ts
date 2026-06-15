import type { NimbleCharacter } from '#documents/actor/character.js';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.ts';
import localize from '#utils/localize.ts';

export function createCharacterPdfExportButtonState(
	getActor: () => NimbleCharacter,
	exportDialogComponent: unknown,
) {
	function handleExport() {
		const actor = getActor();
		const uniqueId = `pdf-export-${actor.id}`;
		if (GenericDialog.isOpen(uniqueId)) return;

		const dialog = GenericDialog.getOrCreate(
			localize('NIMBLE.pdfExport.dialogTitle'),
			exportDialogComponent as ConstructorParameters<typeof GenericDialog>[1],
			{ actor },
			{
				icon: 'fa-solid fa-file-pdf',
				width: 900,
				height: Math.min(window.innerHeight - 100, 750),
				uniqueId,
			},
		);
		dialog.render(true);
	}

	return {
		handleExport,
	};
}
