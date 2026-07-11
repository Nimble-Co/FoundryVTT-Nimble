import type { NimbleCharacter } from '#documents/actor/character.js';
import { SYSTEM_PATH } from '#system';
import type { PreviewState } from '#types/components/PdfPreviewDialog.js';
import { extractCharacterData } from '../sheets/character/pdfExport/extractCharacterData.ts';

/** The sheet renders at a fixed 612pt width and scales to fit its container. */
const PDF_PAGE_WIDTH = 612;

export function createPdfPreviewDialogState(
	getActor: () => NimbleCharacter,
	getPreviewState: () => PreviewState,
) {
	let wrapperWidth = $state(0);

	const scale = $derived(wrapperWidth > 0 ? wrapperWidth / PDF_PAGE_WIDTH : 1);
	const characterData = $derived(extractCharacterData(getActor()));
	const templateSrc = $derived(
		`${SYSTEM_PATH}/assets/pdf/${getPreviewState().template === 'noLines' ? 'CharacterSheet-Full-NoLines.png' : 'CharacterSheet-Full.png'}`,
	);
	const additionalTemplateSrc = $derived(
		`${SYSTEM_PATH}/assets/pdf/${getPreviewState().template === 'noLines' ? 'CharacterSheet-Additional-NoLines.png' : 'CharacterSheet-Additional.png'}`,
	);

	/** Page 2 only renders when at least one additional column has visible text */
	const hasAdditionalContent = $derived(
		getPreviewState().additionalColumnContent.some(
			(html) => html.replace(/<[^>]*>/g, '').trim() !== '',
		),
	);

	return {
		get wrapperWidth() {
			return wrapperWidth;
		},
		set wrapperWidth(value: number) {
			wrapperWidth = value;
		},
		get scale() {
			return scale;
		},
		get characterData() {
			return characterData;
		},
		get templateSrc() {
			return templateSrc;
		},
		get additionalTemplateSrc() {
			return additionalTemplateSrc;
		},
		get hasAdditionalContent() {
			return hasAdditionalContent;
		},
	};
}
