import type { NimbleCharacter } from '#documents/actor/character.js';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.ts';
import localize from '#utils/localize.ts';

import type { TemplateType } from './exportCharacterPdf.ts';

export function createCharacterPdfExportButtonState(
	getActor: () => NimbleCharacter,
	exportDialogComponent: unknown,
) {
	let isExporting = $state(false);

	async function handleExport() {
		if (isExporting) return;

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

		const result = await dialog.promise;

		if (result?.columnContent) {
			isExporting = true;

			try {
				const { exportCharacterPdf } = await import('./exportCharacterPdf.ts');
				await exportCharacterPdf(actor, {
					columnContent: result.columnContent as [string, string, string],
					template: (result.template as TemplateType) ?? 'lined',
				});
				ui.notifications?.info(localize('NIMBLE.pdfExport.success'));
			} catch (error) {
				console.error('PDF export failed:', error);
				ui.notifications?.error(localize('NIMBLE.pdfExport.error'));
			} finally {
				isExporting = false;
			}
		}
	}

	return {
		get isExporting() {
			return isExporting;
		},
		handleExport,
	};
}
