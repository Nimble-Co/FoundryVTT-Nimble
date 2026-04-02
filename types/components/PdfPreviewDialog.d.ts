import type { NimbleCharacter } from '#documents/actor/character.js';
import type { TemplateType } from '../../src/view/sheets/character/pdfExport/exportCharacterPdf.ts';

export interface PdfPreviewDialogProps {
	actor: NimbleCharacter;
	columnContent: [string, string, string];
	template: TemplateType;
	dialog: {
		close(): void;
	};
}
