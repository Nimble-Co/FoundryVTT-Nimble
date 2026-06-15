import type { NimbleCharacter } from '#documents/actor/character.js';
import type { TemplateType } from '../../src/view/sheets/character/pdfExport/pdfExport.types.ts';

export interface PreviewState {
	columnContent: [string, string, string];
	template: TemplateType;
	lineHeights: [number, number, number];
	overLimit: [boolean, boolean, boolean];
}

export interface PdfPreviewDialogProps {
	actor: NimbleCharacter;
	previewState: PreviewState;
	dialog: {
		close(): void;
	};
}
