import { jsPDF } from 'jspdf';

import type { NimbleCharacter } from '#documents/actor/character.js';

import { drawStyledText } from './drawStyledText.ts';
import { parseHtmlToStyledSegments } from './parseHtmlToStyledSegments.ts';
import { type LinedTextAreaConfig, pdfCoordinates, type TextPosition } from './pdfCoordinates.ts';

/** PDF page dimensions in points (letter size) */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/** Template options */
type TemplateType = 'lined' | 'noLines';

interface ExportOptions {
	columnContent: [string, string, string];
	template?: TemplateType;
	returnPdf?: boolean;
}

/**
 * Format a modifier value with a sign prefix.
 */
function formatModifier(value: number): string {
	if (value >= 0) return `+${value}`;
	return `${value}`;
}

/**
 * Extract character data from a NimbleCharacter for PDF export.
 */
function extractCharacterData(actor: NimbleCharacter) {
	const system = actor.system;

	// Get first class for display
	const classEntries = Object.values(actor.classes ?? {});
	const classItem = classEntries[0];
	const className = classItem?.name ?? '';

	// Build ancestry/class/level string
	const ancestryName = actor.ancestry?.name ?? '';
	const characterLevel = actor.levels.character;
	const ancestryClassLevel = [ancestryName, className, `Lvl ${characterLevel}`]
		.filter(Boolean)
		.join(' ');

	// Build height/weight/speed string
	const height = system.details?.height ?? '';
	const weight = system.details?.weight ?? '';
	const walkSpeed = system.attributes.movement?.walk ?? 6;
	const heightWeightSpeed = [height, weight, `${walkSpeed} spaces`].filter(Boolean).join(', ');

	// Hit dice - only show max with die size (e.g., "5 d8")
	const hitDiceMax = actor.HitDiceManager?.max ?? 0;
	const hitDieSize = actor.HitDiceManager?.largest ?? 8;
	const hitDice = `${hitDiceMax} d${hitDieSize}`;

	// HP - only show max
	const hpMax = system.attributes.hp.max;
	const hitPoints = `${hpMax}`;

	// Combat stats
	const armor = system.attributes.armor.value.toString();
	const initiative = formatModifier(system.attributes.initiative.mod);
	// Wounds - only show max
	const woundsMax = system.attributes.wounds.max;
	const wounds = `${woundsMax}`;

	// Ability modifiers
	const abilities = {
		strength: formatModifier(system.abilities.strength.mod),
		dexterity: formatModifier(system.abilities.dexterity.mod),
		intelligence: formatModifier(system.abilities.intelligence.mod),
		will: formatModifier(system.abilities.will.mod),
	};

	// Saving throw advantage/disadvantage (positive = advantage, negative = disadvantage)
	const saveRollModes = {
		strength: system.savingThrows?.strength?.defaultRollMode ?? 0,
		dexterity: system.savingThrows?.dexterity?.defaultRollMode ?? 0,
		intelligence: system.savingThrows?.intelligence?.defaultRollMode ?? 0,
		will: system.savingThrows?.will?.defaultRollMode ?? 0,
	};

	// Skill modifiers
	const skills = {
		arcana: formatModifier(system.skills.arcana.mod),
		examination: formatModifier(system.skills.examination.mod),
		finesse: formatModifier(system.skills.finesse.mod),
		influence: formatModifier(system.skills.influence.mod),
		insight: formatModifier(system.skills.insight.mod),
		lore: formatModifier(system.skills.lore.mod),
		might: formatModifier(system.skills.might.mod),
		naturecraft: formatModifier(system.skills.naturecraft.mod),
		perception: formatModifier(system.skills.perception.mod),
		stealth: formatModifier(system.skills.stealth.mod),
	};

	return {
		characterName: actor.name ?? 'Unknown',
		ancestryClassLevel,
		heightWeightSpeed,
		hitDice,
		hitPoints,
		armor,
		initiative,
		wounds,
		abilities,
		saveRollModes,
		skills,
	};
}

/**
 * Draw styled column content with HTML formatting preserved.
 */
function drawStyledColumnContent(
	pdf: jsPDF,
	columnContent: [string, string, string],
	config: LinedTextAreaConfig,
): void {
	const { startY, leftMargin, columnWidth, columnGap, linesPerColumn, lineHeight, fontSize } =
		config;

	function getColumnX(column: number): number {
		return leftMargin + column * (columnWidth + columnGap);
	}

	const maxWidth = columnWidth - 4;

	for (let colIndex = 0; colIndex < 3; colIndex++) {
		const html = columnContent[colIndex];
		if (!html) continue;

		// Parse HTML to styled segments
		const styledLines = parseHtmlToStyledSegments(html);

		// Draw styled text
		drawStyledText({
			pdf,
			lines: styledLines,
			startX: getColumnX(colIndex),
			startY,
			maxWidth,
			lineHeight,
			fontSize,
			maxLines: linesPerColumn,
		});
	}
}

/**
 * Convert a Blob to a data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error('Failed to read blob'));
		reader.readAsDataURL(blob);
	});
}

/**
 * Generate a PDF for a character.
 * Can either save the PDF or return it for preview.
 */
async function generateCharacterPdf(
	actor: NimbleCharacter,
	options: ExportOptions,
): Promise<jsPDF> {
	const { columnContent, template = 'lined' } = options;

	// Create a new PDF document (letter size in points)
	const pdf = new jsPDF({
		orientation: 'portrait',
		unit: 'pt',
		format: [PAGE_WIDTH, PAGE_HEIGHT],
	});

	// Select template based on option
	const templateFile =
		template === 'noLines' ? 'CharacterSheet-Full-NoLines.png' : 'CharacterSheet-Full.png';
	const templateUrl = `systems/nimble/assets/pdf/${templateFile}`;

	// Load the template image
	const templateResponse = await fetch(templateUrl);

	if (!templateResponse.ok) {
		throw new Error(`Failed to load template image: ${templateResponse.statusText}`);
	}

	const templateBlob = await templateResponse.blob();
	const templateDataUrl = await blobToDataUrl(templateBlob);

	// Draw the template as background
	pdf.addImage(templateDataUrl, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

	// Extract character data
	const data = extractCharacterData(actor);

	// Helper to draw text at a position
	function drawText(text: string, position: TextPosition, useBold = false) {
		const fontStyle = useBold ? 'bold' : 'normal';
		pdf.setFont('helvetica', fontStyle);
		pdf.setFontSize(position.fontSize);
		pdf.setTextColor(0, 0, 0);

		if (position.maxWidth) {
			pdf.text(text, position.x, position.y, { maxWidth: position.maxWidth });
		} else {
			pdf.text(text, position.x, position.y, { align: 'center' });
		}
	}

	// Draw header fields
	drawText(data.characterName, pdfCoordinates.characterName, true);
	drawText(data.ancestryClassLevel, pdfCoordinates.ancestryClassLevel);
	drawText(data.heightWeightSpeed, pdfCoordinates.heightWeightSpeed);
	drawText(data.hitDice, pdfCoordinates.hitDice);

	// Draw HP and combat stats
	drawText(data.hitPoints, pdfCoordinates.hitPoints, true);
	drawText(data.armor, pdfCoordinates.armor, true);
	drawText(data.initiative, pdfCoordinates.initiative, true);
	drawText(data.wounds, pdfCoordinates.wounds, true);

	// Draw ability modifiers
	drawText(data.abilities.strength, pdfCoordinates.abilities.strength, true);
	drawText(data.abilities.dexterity, pdfCoordinates.abilities.dexterity, true);
	drawText(data.abilities.intelligence, pdfCoordinates.abilities.intelligence, true);
	drawText(data.abilities.will, pdfCoordinates.abilities.will, true);

	// Draw save advantage/disadvantage arrows as filled triangles
	function drawSaveArrow(
		rollMode: number,
		arrowPos: { upX: number; upY: number; downX: number; downY: number; fontSize: number },
	) {
		if (rollMode === 0) return;

		const size = arrowPos.fontSize * 0.4;
		pdf.setFillColor(0, 0, 0);

		if (rollMode > 0) {
			const x = arrowPos.upX;
			const y = arrowPos.upY;
			pdf.triangle(x, y - size, x - size, y + size * 0.5, x + size, y + size * 0.5, 'F');
		} else {
			const x = arrowPos.downX;
			const y = arrowPos.downY;
			pdf.triangle(x, y + size, x - size, y - size * 0.5, x + size, y - size * 0.5, 'F');
		}
	}

	drawSaveArrow(data.saveRollModes.strength, pdfCoordinates.saveArrows.strength);
	drawSaveArrow(data.saveRollModes.dexterity, pdfCoordinates.saveArrows.dexterity);
	drawSaveArrow(data.saveRollModes.intelligence, pdfCoordinates.saveArrows.intelligence);
	drawSaveArrow(data.saveRollModes.will, pdfCoordinates.saveArrows.will);

	// Draw skill modifiers
	drawText(data.skills.arcana, pdfCoordinates.skills.arcana);
	drawText(data.skills.examination, pdfCoordinates.skills.examination);
	drawText(data.skills.finesse, pdfCoordinates.skills.finesse);
	drawText(data.skills.influence, pdfCoordinates.skills.influence);
	drawText(data.skills.insight, pdfCoordinates.skills.insight);
	drawText(data.skills.lore, pdfCoordinates.skills.lore);
	drawText(data.skills.might, pdfCoordinates.skills.might);
	drawText(data.skills.naturecraft, pdfCoordinates.skills.naturecraft);
	drawText(data.skills.perception, pdfCoordinates.skills.perception);
	drawText(data.skills.stealth, pdfCoordinates.skills.stealth);

	// Draw styled column content
	drawStyledColumnContent(pdf, columnContent, pdfCoordinates.linedTextArea);

	return pdf;
}

/**
 * Export a character sheet as a PDF file.
 */
async function exportCharacterPdf(actor: NimbleCharacter, options: ExportOptions): Promise<void> {
	const pdf = await generateCharacterPdf(actor, options);

	// Create filename from character name (sanitize for filesystem)
	const safeName = (actor.name ?? 'character').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
	const filename = `${safeName}_character_sheet.pdf`;

	// Save the PDF
	pdf.save(filename);
}

/**
 * Generate a PDF and return it as a blob URL for preview.
 */
async function generatePdfPreviewUrl(
	actor: NimbleCharacter,
	options: ExportOptions,
): Promise<string> {
	const pdf = await generateCharacterPdf(actor, options);
	return pdf.output('bloburl') as unknown as string;
}

export { exportCharacterPdf, generatePdfPreviewUrl };
export type { ExportOptions, TemplateType };
