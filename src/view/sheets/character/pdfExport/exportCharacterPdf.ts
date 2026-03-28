import { jsPDF } from 'jspdf';

import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { NimbleObjectItem } from '#documents/item/object.js';
import type { NimbleSpellItem } from '#documents/item/spell.js';

import { type LinedTextAreaConfig, pdfCoordinates, type TextPosition } from './pdfCoordinates.ts';

/** PDF page dimensions in points (letter size) */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

interface ContentSection {
	header: string;
	items: string[];
}

/**
 * Strip HTML tags from a string, preserving line breaks from block elements.
 */
function stripHtml(html: string): string {
	if (!html) return '';
	// Replace block-level elements with newlines before stripping
	const processed = html
		.replace(/<\/p>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/li>/gi, '\n');

	const temp = document.createElement('div');
	temp.innerHTML = processed;
	const text = temp.textContent ?? temp.innerText ?? '';
	// Normalize multiple spaces (but preserve newlines)
	return text
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0)
		.join(' | ');
}

/**
 * Extract mechanical abilities from ancestry/background description.
 * These are typically after an <hr> tag, with ability names in <strong> tags.
 */
function extractMechanicalAbilities(html: string): string {
	if (!html) return '';

	// Split on <hr> and take the part after it (mechanical abilities)
	const hrParts = html.split(/<hr\s*\/?>/i);
	const mechanicalPart = hrParts.length > 1 ? hrParts.slice(1).join('') : html;

	// Process the mechanical part
	const processed = mechanicalPart
		.replace(/<\/p>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/li>/gi, '\n')
		// Make strong text stand out with brackets
		.replace(/<strong>([^<]*)<\/strong>/gi, '[$1]');

	const temp = document.createElement('div');
	temp.innerHTML = processed;
	const text = temp.textContent ?? temp.innerText ?? '';

	// Normalize whitespace and join lines
	return text
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0)
		.join(' | ');
}

/**
 * Format a modifier value with a sign prefix.
 * @param value - The numeric modifier value
 * @returns A string like "+3" or "-1" or "0"
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
 * Extract ancestry and its associated features.
 */
function extractAncestrySection(actor: NimbleCharacter): ContentSection | null {
	const ancestry = actor.ancestry;
	if (!ancestry) return null;

	// Extract mechanical abilities (after <hr> tag) and combine with header
	const abilities = extractMechanicalAbilities(ancestry.system.description);
	const header = abilities
		? `ANCESTRY: ${ancestry.name} - ${abilities}`
		: `ANCESTRY: ${ancestry.name}`;

	return {
		header,
		items: [],
	};
}

/**
 * Extract background and its associated features.
 */
function extractBackgroundSection(actor: NimbleCharacter): ContentSection | null {
	const background = actor.background;
	if (!background) return null;

	// Extract mechanical abilities (after <hr> tag) and combine with header
	const abilities = extractMechanicalAbilities(background.system.description);
	const header = abilities
		? `BACKGROUND: ${background.name} - ${abilities}`
		: `BACKGROUND: ${background.name}`;

	return {
		header,
		items: [],
	};
}

/**
 * Check if a feature is about spell/mana progression (should be skipped since spells list covers it).
 */
function isSpellProgressionFeature(name: string): boolean {
	const lowerName = name.toLowerCase();
	return (
		lowerName.includes('unlock tier') ||
		lowerName.includes('mana and unlock') ||
		(lowerName.includes('unlock') && lowerName.includes('spell')) ||
		lowerName === 'master of storms' ||
		lowerName === 'stormcaller' ||
		lowerName.includes('learn a utility spell')
	);
}

/**
 * Extract class features grouped by class.
 */
function extractClassFeaturesSection(actor: NimbleCharacter): ContentSection[] {
	const sections: ContentSection[] = [];
	const classes = actor.classes ?? {};

	for (const [classId, classItem] of Object.entries(classes)) {
		const classFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			return feature.system.class === classId || feature.system.class === classItem.identifier;
		});

		if (classFeatures.length > 0) {
			const items: string[] = [];
			for (const feature of classFeatures) {
				// Skip spell progression features
				if (isSpellProgressionFeature(feature.name ?? '')) continue;

				const feat = feature as NimbleFeatureItem;
				const level = feat.system.gainedAtLevel;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feat.system.description);
				// Combine name, level, and description for compact display
				if (desc) {
					items.push(`• ${feature.name}${levelStr}: ${desc}`);
				} else {
					items.push(`• ${feature.name}${levelStr}`);
				}
			}

			if (items.length > 0) {
				sections.push({
					header: `${classItem.name.toUpperCase()} FEATURES`,
					items,
				});
			}
		}
	}

	return sections;
}

/**
 * Extract spells grouped by tier.
 */
function extractSpellsSection(actor: NimbleCharacter): ContentSection | null {
	const spells = actor.items.filter((item) => item.isType('spell')) as NimbleSpellItem[];

	if (spells.length === 0) return null;

	// Sort by tier, then by name
	spells.sort((a, b) => {
		const tierDiff = (a.system.tier ?? 0) - (b.system.tier ?? 0);
		if (tierDiff !== 0) return tierDiff;
		return (a.name ?? '').localeCompare(b.name ?? '');
	});

	// Group spells by tier
	const spellsByTier: Record<number, NimbleSpellItem[]> = {};
	for (const spell of spells) {
		const tier = spell.system.tier ?? 0;
		if (!spellsByTier[tier]) spellsByTier[tier] = [];
		spellsByTier[tier].push(spell);
	}

	const items: string[] = [];

	// Output each tier with spell names on the same line (no descriptions for compactness)
	for (const tier of Object.keys(spellsByTier)
		.map(Number)
		.sort((a, b) => a - b)) {
		const tierSpells = spellsByTier[tier];
		const spellNames = tierSpells.map((spell) => spell.name ?? '');
		items.push(`Tier ${tier}: ${spellNames.join(' | ')}`);
	}

	return {
		header: 'SPELLS',
		items,
	};
}

/**
 * Extract inventory items as a simple list.
 */
function extractInventorySection(actor: NimbleCharacter): ContentSection | null {
	const objects = actor.items.filter((item) => item.isType('object')) as NimbleObjectItem[];

	if (objects.length === 0) return null;

	// Combine all items into one line separated by |
	const itemList = objects.map((obj) => {
		const qty = obj.system.quantity ?? 1;
		const qtyStr = qty > 1 ? ` (x${qty})` : '';
		const equipped = obj.system.equipped ? ' [E]' : '';
		return `${obj.name}${qtyStr}${equipped}`;
	});

	return {
		header: 'INVENTORY',
		items: [itemList.join(' | ')],
	};
}

/**
 * Draw content sections in the lined text area using a multi-column layout.
 */
function drawLinedTextContent(
	pdf: jsPDF,
	sections: ContentSection[],
	config: LinedTextAreaConfig,
): void {
	const {
		startY,
		leftMargin,
		columnWidth,
		columnGap,
		columnCount,
		linesPerColumn,
		lineHeight,
		fontSize,
		headerFontSize,
	} = config;

	let currentColumn = 0;
	let currentLine = 0;
	const maxLines = linesPerColumn * columnCount;
	let totalLinesUsed = 0;

	function getColumnX(column: number): number {
		return leftMargin + column * (columnWidth + columnGap);
	}

	function getLineY(line: number): number {
		return startY + line * lineHeight;
	}

	function advanceLine(): boolean {
		currentLine++;
		totalLinesUsed++;

		// Move to next column if current column is full
		if (currentLine >= linesPerColumn) {
			currentLine = 0;
			currentColumn++;
		}

		return totalLinesUsed < maxLines;
	}

	function drawText(text: string, isHeader: boolean): boolean {
		if (totalLinesUsed >= maxLines) return false;

		pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
		pdf.setFontSize(isHeader ? headerFontSize : fontSize);
		pdf.setTextColor(0, 0, 0);

		const maxWidth = columnWidth - 4;

		// Split text into multiple lines that fit within column width
		const lines = pdf.splitTextToSize(text, maxWidth);

		for (const line of lines) {
			if (totalLinesUsed >= maxLines) return false;

			const x = getColumnX(currentColumn);
			const y = getLineY(currentLine);

			pdf.text(line, x, y);

			if (!advanceLine()) return false;
		}

		return true;
	}

	for (const section of sections) {
		// Draw header
		if (!drawText(section.header, true)) break;

		// Draw items
		for (const item of section.items) {
			if (item === '') {
				// Empty string means skip a line for spacing, but don't waste lines
				continue;
			}
			if (!drawText(item, false)) break;
		}
	}
}

/**
 * Export a character sheet as a PDF file.
 * @param actor - The NimbleCharacter to export
 * @throws Error if the export fails
 */
async function exportCharacterPdf(actor: NimbleCharacter): Promise<void> {
	// Create a new PDF document (letter size in points)
	const pdf = new jsPDF({
		orientation: 'portrait',
		unit: 'pt',
		format: [PAGE_WIDTH, PAGE_HEIGHT],
	});

	// Load the template image
	const templateUrl = 'systems/nimble/assets/pdf/CharacterSheet-Full.png';
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
	// Coordinates are already in top-left origin (jsPDF native)
	function drawText(text: string, position: TextPosition, useBold = false) {
		const fontStyle = useBold ? 'bold' : 'normal';
		pdf.setFont('helvetica', fontStyle);
		pdf.setFontSize(position.fontSize);
		pdf.setTextColor(0, 0, 0);

		if (position.maxWidth) {
			// Left-aligned text with max width
			pdf.text(text, position.x, position.y, { maxWidth: position.maxWidth });
		} else {
			// Centered text
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
		if (rollMode === 0) return; // Normal, no arrow needed

		const size = arrowPos.fontSize * 0.4; // Triangle size based on font size
		pdf.setFillColor(0, 0, 0);

		if (rollMode > 0) {
			// Advantage - draw up arrow (pointing up)
			const x = arrowPos.upX;
			const y = arrowPos.upY;
			pdf.triangle(x, y - size, x - size, y + size * 0.5, x + size, y + size * 0.5, 'F');
		} else {
			// Disadvantage - draw down arrow (pointing down)
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

	// Extract and draw content sections in the lined text area
	const contentSections: ContentSection[] = [];

	// Add ancestry section
	const ancestrySection = extractAncestrySection(actor);
	if (ancestrySection) contentSections.push(ancestrySection);

	// Add background section
	const backgroundSection = extractBackgroundSection(actor);
	if (backgroundSection) contentSections.push(backgroundSection);

	// Add class features sections
	const classFeaturesSections = extractClassFeaturesSection(actor);
	contentSections.push(...classFeaturesSections);

	// Add spells section
	const spellsSection = extractSpellsSection(actor);
	if (spellsSection) contentSections.push(spellsSection);

	// Add inventory section
	const inventorySection = extractInventorySection(actor);
	if (inventorySection) contentSections.push(inventorySection);

	// Draw all sections in the lined text area
	drawLinedTextContent(pdf, contentSections, pdfCoordinates.linedTextArea);

	// Create filename from character name (sanitize for filesystem)
	const safeName = (actor.name ?? 'character').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
	const filename = `${safeName}_character_sheet.pdf`;

	// Save the PDF
	pdf.save(filename);
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

export { exportCharacterPdf };
