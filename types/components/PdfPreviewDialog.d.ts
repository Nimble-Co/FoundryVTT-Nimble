import type { NimbleCharacter } from '#documents/actor/character.js';
import type { TemplateType } from '../../src/view/sheets/character/pdfExport/exportCharacterPdf.ts';

export interface PreviewState {
	columnContent: [string, string, string];
	template: TemplateType;
}

export interface PdfPreviewDialogProps {
	actor: NimbleCharacter;
	previewState: PreviewState;
	dialog: {
		close(): void;
	};
}
