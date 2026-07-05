import type { NimbleCharacter } from '#documents/actor/character.js';

import { generatePdfPreviewUrl } from './exportCharacterPdf.ts';
import type { TemplateType } from './pdfExport.types.ts';

/**
 * Show a PDF preview in a new window.
 */
async function showPdfPreview(
	actor: NimbleCharacter,
	columnContent: [string, string, string],
	template: TemplateType = 'lined',
): Promise<void> {
	const previewUrl = await generatePdfPreviewUrl(actor, {
		columnContent,
		template,
	});

	// Open in a new window/tab
	const previewWindow = window.open(previewUrl, '_blank', 'width=800,height=1000');

	if (!previewWindow) {
		// Fallback: show in an iframe dialog if popup was blocked
		showPdfPreviewDialog(previewUrl, actor.name ?? 'Character');
	}
}

/**
 * Show PDF preview in a Foundry dialog with an iframe.
 */
function showPdfPreviewDialog(pdfUrl: string, characterName: string): void {
	const content = `
		<div style="width: 100%; height: 600px;">
			<iframe
				src="${pdfUrl}"
				style="width: 100%; height: 100%; border: none;"
				title="PDF Preview"
			></iframe>
		</div>
	`;

	void foundry.applications.api.DialogV2.wait({
		window: {
			title: `PDF Preview: ${characterName}`,
			resizable: true,
		},
		position: {
			width: 700,
			height: 700,
		},
		content,
		buttons: [
			{
				action: 'close',
				label: 'Close',
				icon: 'fa-solid fa-times',
				default: true,
			},
		],
		rejectClose: false,
	});
}

export { showPdfPreview };
