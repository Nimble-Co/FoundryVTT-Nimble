import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { NimbleObjectItem } from '#documents/item/object.js';
import type { NimbleSpellItem } from '#documents/item/spell.js';

/** Estimated characters per column based on PDF config */
const CHARS_PER_COLUMN = 1150;

interface ContentSection {
	header: string;
	items: string[];
}

interface ContentSectionHtml {
	header: string;
	items: string[];
}

interface SelectableItem {
	id: string;
	category: string;
	label: string;
	content: string;
	contentHtml: string;
}

/**
 * Strip HTML tags from a string, preserving line breaks from block elements.
 */
function stripHtml(html: string): string {
	if (!html) return '';
	const processed = html
		.replace(/<\/p>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/li>/gi, '\n');

	const temp = document.createElement('div');
	temp.innerHTML = processed;
	const text = temp.textContent ?? temp.innerText ?? '';
	return text
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0)
		.join(' | ');
}

/**
 * Extract mechanical abilities from ancestry/background description.
 */
function extractMechanicalAbilities(html: string): string {
	if (!html) return '';

	const hrParts = html.split(/<hr\s*\/?>/i);
	const mechanicalPart = hrParts.length > 1 ? hrParts.slice(1).join('') : html;

	const processed = mechanicalPart
		.replace(/<\/p>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<\/li>/gi, '\n')
		.replace(/<strong>([^<]*)<\/strong>/gi, '[$1]');

	const temp = document.createElement('div');
	temp.innerHTML = processed;
	const text = temp.textContent ?? temp.innerText ?? '';

	return text
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0)
		.join(' | ');
}

/**
 * Extract mechanical abilities from ancestry/background description as HTML.
 */
function extractMechanicalAbilitiesHtml(html: string): string {
	if (!html) return '';

	const hrParts = html.split(/<hr\s*\/?>/i);
	const mechanicalPart = hrParts.length > 1 ? hrParts.slice(1).join('') : html;

	// Clean up HTML but preserve <strong> tags
	const temp = document.createElement('div');
	temp.innerHTML = mechanicalPart;

	// Process text nodes and strong tags
	function processNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return (node.textContent ?? '').replace(/\s+/g, ' ');
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return '';
		}

		const element = node as Element;
		const tagName = element.tagName.toLowerCase();
		const childContent = Array.from(node.childNodes).map(processNode).join('');

		if (tagName === 'strong' || tagName === 'b') {
			return `<strong>${childContent}</strong>`;
		}
		if (tagName === 'em' || tagName === 'i') {
			return `<em>${childContent}</em>`;
		}
		if (tagName === 'p' || tagName === 'div' || tagName === 'li') {
			return `${childContent} | `;
		}
		if (tagName === 'br') {
			return ' | ';
		}

		return childContent;
	}

	const result = processNode(temp).trim();
	// Clean up trailing separators
	return result.replace(/\s*\|\s*$/, '').replace(/\s*\|\s*\|\s*/g, ' | ');
}

/**
 * Check if a feature is about spell/mana progression.
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
 * Extract ancestry content.
 */
function extractAncestrySection(actor: NimbleCharacter): ContentSection | null {
	const ancestry = actor.ancestry;
	if (!ancestry) return null;

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
 * Extract ancestry content as HTML.
 */
function extractAncestrySectionHtml(actor: NimbleCharacter): ContentSectionHtml | null {
	const ancestry = actor.ancestry;
	if (!ancestry) return null;

	const abilities = extractMechanicalAbilitiesHtml(ancestry.system.description);
	const header = abilities
		? `<strong>ANCESTRY:</strong> ${ancestry.name} - ${abilities}`
		: `<strong>ANCESTRY:</strong> ${ancestry.name}`;

	return {
		header,
		items: [],
	};
}

/**
 * Extract background content.
 */
function extractBackgroundSection(actor: NimbleCharacter): ContentSection | null {
	const background = actor.background;
	if (!background) return null;

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
 * Extract background content as HTML.
 */
function extractBackgroundSectionHtml(actor: NimbleCharacter): ContentSectionHtml | null {
	const background = actor.background;
	if (!background) return null;

	const abilities = extractMechanicalAbilitiesHtml(background.system.description);
	const header = abilities
		? `<strong>BACKGROUND:</strong> ${background.name} - ${abilities}`
		: `<strong>BACKGROUND:</strong> ${background.name}`;

	return {
		header,
		items: [],
	};
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
		}) as NimbleFeatureItem[];

		// Sort features by level, then by name
		classFeatures.sort((a, b) => {
			const levelDiff = (a.system.gainedAtLevel ?? 0) - (b.system.gainedAtLevel ?? 0);
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		if (classFeatures.length > 0) {
			const items: string[] = [];
			for (const feature of classFeatures) {
				if (isSpellProgressionFeature(feature.name ?? '')) continue;

				const feat = feature as NimbleFeatureItem;
				const level = feat.system.gainedAtLevel;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feat.system.description);
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
 * Extract class features grouped by class as HTML.
 */
function extractClassFeaturesSectionHtml(actor: NimbleCharacter): ContentSectionHtml[] {
	const sections: ContentSectionHtml[] = [];
	const classes = actor.classes ?? {};

	for (const [classId, classItem] of Object.entries(classes)) {
		const classFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			return feature.system.class === classId || feature.system.class === classItem.identifier;
		}) as NimbleFeatureItem[];

		// Sort features by level, then by name
		classFeatures.sort((a, b) => {
			const levelDiff = (a.system.gainedAtLevel ?? 0) - (b.system.gainedAtLevel ?? 0);
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		if (classFeatures.length > 0) {
			const items: string[] = [];
			for (const feature of classFeatures) {
				if (isSpellProgressionFeature(feature.name ?? '')) continue;

				const feat = feature as NimbleFeatureItem;
				const level = feat.system.gainedAtLevel;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feat.system.description);
				if (desc) {
					items.push(`• <strong>${feature.name}${levelStr}:</strong> ${desc}`);
				} else {
					items.push(`• <strong>${feature.name}${levelStr}</strong>`);
				}
			}

			if (items.length > 0) {
				sections.push({
					header: `<strong>${classItem.name.toUpperCase()} FEATURES</strong>`,
					items,
				});
			}
		}
	}

	return sections;
}

/**
 * Extract detailed information from a spell.
 */
function extractSpellDetails(spell: NimbleSpellItem): string {
	const parts: string[] = [];
	const properties = spell.system.properties;
	const cost = spell.system.activation?.cost;
	const template = spell.system.activation?.template;

	// Build casting time string (e.g., "1 action AOE", "1 action self", "casting time 1 minute")
	const hasTemplate =
		template?.shape && template.shape !== 'none' && (template.radius || template.length);
	const hasRange = properties?.selected?.includes('range') && properties.range?.max;
	const hasReach = properties?.selected?.includes('reach') && properties.reach?.min;

	if (cost?.type && cost.type !== 'none' && cost.type !== 'mana') {
		let castingTimeStr = cost.quantity > 1 ? `${cost.quantity} ${cost.type}s` : `1 ${cost.type}`;

		// Add target type suffix
		if (hasTemplate) {
			castingTimeStr += ' AOE';
		} else if (!hasRange && !hasReach) {
			castingTimeStr += ' self';
		}

		parts.push(castingTimeStr);
	}

	// Mana cost
	if (cost?.quantity && cost.quantity > 0 && cost.type === 'mana') {
		parts.push(`${cost.quantity} Mana`);
	}

	// Range or reach
	if (hasRange) {
		parts.push(`Range ${properties.range.min}-${properties.range.max}`);
	} else if (hasReach) {
		const reachStr = properties.reach.max
			? `${properties.reach.min}-${properties.reach.max}`
			: `${properties.reach.min}`;
		parts.push(`Reach ${reachStr}`);
	}

	// Duration (skip if "none")
	const duration = spell.system.activation?.duration;
	if (duration?.quantity && duration.quantity > 0 && duration.type && duration.type !== 'none') {
		const durationStr =
			duration.quantity === 1 ? duration.type : `${duration.quantity} ${duration.type}s`;
		parts.push(durationStr);
	}

	// Concentration
	if (properties?.selected?.includes('concentration')) {
		parts.push('Conc.');
	}

	// Template/AoE details (size info)
	if (hasTemplate) {
		let aoeStr = '';
		if (template.shape === 'circle' || template.shape === 'emanation') {
			aoeStr = `${template.radius} sp ${template.shape}`;
		} else if (template.shape === 'cone') {
			aoeStr = `${template.length} sp cone`;
		} else if (template.shape === 'line') {
			aoeStr = `${template.length}x${template.width} line`;
		} else if (template.shape === 'square') {
			aoeStr = `${template.length} sp square`;
		}
		if (aoeStr) parts.push(aoeStr);
	}

	// Base effect description (stripped)
	const baseEffect = stripHtml(spell.system.description?.baseEffect ?? '');
	if (baseEffect) {
		parts.push(baseEffect);
	}

	return parts.join(' | ');
}

/**
 * Extract spells grouped by tier with details.
 */
function extractSpellsSection(actor: NimbleCharacter): ContentSection | null {
	const spells = actor.items.filter((item) => item.isType('spell')) as NimbleSpellItem[];

	if (spells.length === 0) return null;

	spells.sort((a, b) => {
		const tierDiff = (a.system.tier ?? 0) - (b.system.tier ?? 0);
		if (tierDiff !== 0) return tierDiff;
		return (a.name ?? '').localeCompare(b.name ?? '');
	});

	const spellsByTier: Record<number, NimbleSpellItem[]> = {};
	for (const spell of spells) {
		const tier = spell.system.tier ?? 0;
		if (!spellsByTier[tier]) spellsByTier[tier] = [];
		spellsByTier[tier].push(spell);
	}

	const items: string[] = [];

	for (const tier of Object.keys(spellsByTier)
		.map(Number)
		.sort((a, b) => a - b)) {
		const tierSpells = spellsByTier[tier];
		const tierLabel = tier === 0 ? 'CANTRIPS' : `TIER ${tier}`;
		items.push(tierLabel);
		for (const spell of tierSpells) {
			const details = extractSpellDetails(spell);
			if (details) {
				items.push(`• ${spell.name}: ${details}`);
			} else {
				items.push(`• ${spell.name}`);
			}
		}
	}

	return {
		header: 'SPELLS',
		items,
	};
}

/**
 * Extract spells grouped by tier with details as HTML.
 */
function extractSpellsSectionHtml(actor: NimbleCharacter): ContentSectionHtml | null {
	const spells = actor.items.filter((item) => item.isType('spell')) as NimbleSpellItem[];

	if (spells.length === 0) return null;

	spells.sort((a, b) => {
		const tierDiff = (a.system.tier ?? 0) - (b.system.tier ?? 0);
		if (tierDiff !== 0) return tierDiff;
		return (a.name ?? '').localeCompare(b.name ?? '');
	});

	const spellsByTier: Record<number, NimbleSpellItem[]> = {};
	for (const spell of spells) {
		const tier = spell.system.tier ?? 0;
		if (!spellsByTier[tier]) spellsByTier[tier] = [];
		spellsByTier[tier].push(spell);
	}

	const items: string[] = [];

	for (const tier of Object.keys(spellsByTier)
		.map(Number)
		.sort((a, b) => a - b)) {
		const tierSpells = spellsByTier[tier];
		const tierLabel = tier === 0 ? 'CANTRIPS' : `TIER ${tier}`;
		items.push(`<strong>${tierLabel}</strong>`);
		for (const spell of tierSpells) {
			const details = extractSpellDetails(spell);
			if (details) {
				items.push(`• <strong>${spell.name}:</strong> ${details}`);
			} else {
				items.push(`• <strong>${spell.name}</strong>`);
			}
		}
	}

	return {
		header: '<strong>SPELLS</strong>',
		items,
	};
}

/**
 * Extract detailed information from an inventory item.
 */
function extractItemDetails(obj: NimbleObjectItem): string {
	const parts: string[] = [];

	// Item name with quantity and equipped status
	const qty = obj.system.quantity ?? 1;
	const qtyStr = qty > 1 ? ` (x${qty})` : '';
	const equipped = obj.system.equipped ? ' [E]' : '';
	parts.push(`${obj.name}${qtyStr}${equipped}`);

	// Object type
	const objectType = obj.system.objectType;
	if (objectType) {
		parts.push(`Type: ${objectType}`);
	}

	// For weapons: extract damage from activation effects
	const damageEffects = obj.system.activation?.effects?.filter(
		(effect: { type?: string }) => effect.type === 'damage',
	);
	if (damageEffects && damageEffects.length > 0) {
		const damageStrs = damageEffects.map((effect: { formula?: string; damageType?: string }) => {
			const formula = effect.formula ?? '';
			const damageType = effect.damageType ?? '';
			return damageType ? `${formula} ${damageType}` : formula;
		});
		parts.push(`Damage: ${damageStrs.join(', ')}`);
	}

	// For armor: extract AC from rules
	const acRules = (
		obj.system as { rules?: Array<{ type?: string; formula?: string; label?: string }> }
	).rules?.filter((rule) => rule.type === 'armorClass');
	if (acRules && acRules.length > 0) {
		const acStrs = acRules.map((rule) => rule.formula ?? rule.label ?? '');
		parts.push(`AC: ${acStrs.join(', ')}`);
	}

	// Properties
	const properties = obj.system.properties?.selected;
	if (properties && properties.length > 0) {
		parts.push(`Props: ${properties.join(', ')}`);
	}

	// Strength requirement
	const strReq = obj.system.properties?.strengthRequirement?.value;
	if (strReq && strReq > 0) {
		parts.push(`Req STR: ${strReq}`);
	}

	// Reach (if not default)
	const reach = obj.system.properties?.reach;
	if (reach && (reach.min !== 1 || reach.max !== null)) {
		const reachStr = reach.max ? `${reach.min}-${reach.max}` : `${reach.min}`;
		parts.push(`Reach: ${reachStr}`);
	}

	// Range (for ranged weapons)
	const range = obj.system.properties?.range;
	if (range && range.max !== null) {
		parts.push(`Range: ${range.min}-${range.max}`);
	}

	// Description (stripped of HTML)
	const desc = stripHtml(obj.system.description?.public ?? '');
	if (desc) {
		parts.push(desc);
	}

	return parts.join(' | ');
}

/**
 * Extract inventory items with full details.
 */
function extractInventorySection(actor: NimbleCharacter): ContentSection | null {
	const objects = actor.items.filter((item) => item.isType('object')) as NimbleObjectItem[];

	if (objects.length === 0) return null;

	const items: string[] = [];
	for (const obj of objects) {
		items.push(`• ${extractItemDetails(obj)}`);
	}

	return {
		header: 'INVENTORY',
		items,
	};
}

/**
 * Extract inventory items with full details as HTML.
 */
function extractInventorySectionHtml(actor: NimbleCharacter): ContentSectionHtml | null {
	const objects = actor.items.filter((item) => item.isType('object')) as NimbleObjectItem[];

	if (objects.length === 0) return null;

	const items: string[] = [];
	for (const obj of objects) {
		const qty = obj.system.quantity ?? 1;
		const qtyStr = qty > 1 ? ` (x${qty})` : '';
		const equipped = obj.system.equipped ? ' [E]' : '';
		const details = extractItemDetails(obj);
		// Make the item name bold
		items.push(
			`• <strong>${obj.name}${qtyStr}${equipped}:</strong> ${details.substring(details.indexOf('|') + 1).trim()}`,
		);
	}

	return {
		header: '<strong>INVENTORY</strong>',
		items,
	};
}

/**
 * Convert content sections to a flat string array for distribution.
 */
function sectionsToLines(sections: ContentSection[]): string[] {
	const lines: string[] = [];
	for (const section of sections) {
		lines.push(section.header);
		for (const item of section.items) {
			if (item) lines.push(item);
		}
	}
	return lines;
}

/**
 * Convert HTML content sections to a flat string array for distribution.
 */
function sectionsToLinesHtml(sections: ContentSectionHtml[]): string[] {
	const lines: string[] = [];
	for (const section of sections) {
		lines.push(section.header);
		for (const item of section.items) {
			if (item) lines.push(item);
		}
	}
	return lines;
}

/**
 * Distribute lines across columns, balancing content evenly.
 */
function distributeToColumns(lines: string[]): [string, string, string] {
	const totalLines = lines.length;
	const linesPerColumn = Math.ceil(totalLines / 3);

	const column1Lines = lines.slice(0, linesPerColumn);
	const column2Lines = lines.slice(linesPerColumn, linesPerColumn * 2);
	const column3Lines = lines.slice(linesPerColumn * 2);

	return [column1Lines.join('\n'), column2Lines.join('\n'), column3Lines.join('\n')];
}

/**
 * Distribute HTML lines across columns, balancing content evenly.
 */
function distributeToColumnsHtml(lines: string[]): [string, string, string] {
	const totalLines = lines.length;
	const linesPerColumn = Math.ceil(totalLines / 3);

	const column1Lines = lines.slice(0, linesPerColumn);
	const column2Lines = lines.slice(linesPerColumn, linesPerColumn * 2);
	const column3Lines = lines.slice(linesPerColumn * 2);

	return [column1Lines.join('<br>'), column2Lines.join('<br>'), column3Lines.join('<br>')];
}

/**
 * Generate initial column content from a character.
 * Returns a tuple of 3 strings, one for each column.
 */
function generateInitialColumnContent(actor: NimbleCharacter): [string, string, string] {
	const contentSections: ContentSection[] = [];

	const ancestrySection = extractAncestrySection(actor);
	if (ancestrySection) contentSections.push(ancestrySection);

	const backgroundSection = extractBackgroundSection(actor);
	if (backgroundSection) contentSections.push(backgroundSection);

	const classFeaturesSections = extractClassFeaturesSection(actor);
	contentSections.push(...classFeaturesSections);

	const spellsSection = extractSpellsSection(actor);
	if (spellsSection) contentSections.push(spellsSection);

	const inventorySection = extractInventorySection(actor);
	if (inventorySection) contentSections.push(inventorySection);

	const lines = sectionsToLines(contentSections);
	return distributeToColumns(lines);
}

/**
 * Generate initial column content from a character as HTML.
 * Returns a tuple of 3 HTML strings, one for each column.
 */
function generateInitialColumnContentHtml(actor: NimbleCharacter): [string, string, string] {
	const contentSections: ContentSectionHtml[] = [];

	const ancestrySection = extractAncestrySectionHtml(actor);
	if (ancestrySection) contentSections.push(ancestrySection);

	const backgroundSection = extractBackgroundSectionHtml(actor);
	if (backgroundSection) contentSections.push(backgroundSection);

	const classFeaturesSections = extractClassFeaturesSectionHtml(actor);
	contentSections.push(...classFeaturesSections);

	const spellsSection = extractSpellsSectionHtml(actor);
	if (spellsSection) contentSections.push(spellsSection);

	const inventorySection = extractInventorySectionHtml(actor);
	if (inventorySection) contentSections.push(inventorySection);

	const lines = sectionsToLinesHtml(contentSections);
	return distributeToColumnsHtml(lines);
}

/**
 * Get selectable items that can be inserted into columns.
 */
function getSelectableItems(actor: NimbleCharacter): SelectableItem[] {
	const items: SelectableItem[] = [];

	// Ancestry
	const ancestry = actor.ancestry;
	if (ancestry) {
		const abilities = extractMechanicalAbilities(ancestry.system.description);
		const abilitiesHtml = extractMechanicalAbilitiesHtml(ancestry.system.description);
		const content = abilities
			? `ANCESTRY: ${ancestry.name} - ${abilities}`
			: `ANCESTRY: ${ancestry.name}`;
		const contentHtml = abilitiesHtml
			? `<strong>ANCESTRY:</strong> ${ancestry.name} - ${abilitiesHtml}`
			: `<strong>ANCESTRY:</strong> ${ancestry.name}`;

		// Get size category display name
		const sizeCategory = actor.system.attributes.sizeCategory ?? 'medium';
		const { sizeCategories } = CONFIG.NIMBLE;
		const sizeLabel = game.i18n.localize(sizeCategories[sizeCategory] ?? sizeCategory);
		const ancestryLabel = `${ancestry.name ?? 'Unknown Ancestry'} (${sizeLabel})`;

		items.push({
			id: `ancestry-${ancestry.id}`,
			category: 'ancestry',
			label: ancestryLabel,
			content,
			contentHtml,
		});
	}

	// Background
	const background = actor.background;
	if (background) {
		const abilities = extractMechanicalAbilities(background.system.description);
		const abilitiesHtml = extractMechanicalAbilitiesHtml(background.system.description);
		const content = abilities
			? `BACKGROUND: ${background.name} - ${abilities}`
			: `BACKGROUND: ${background.name}`;
		const contentHtml = abilitiesHtml
			? `<strong>BACKGROUND:</strong> ${background.name} - ${abilitiesHtml}`
			: `<strong>BACKGROUND:</strong> ${background.name}`;
		items.push({
			id: `background-${background.id}`,
			category: 'background',
			label: background.name ?? 'Unknown Background',
			content,
			contentHtml,
		});
	}

	// Class features
	const classes = actor.classes ?? {};
	for (const [classId, classItem] of Object.entries(classes)) {
		const classFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			return feature.system.class === classId || feature.system.class === classItem.identifier;
		}) as NimbleFeatureItem[];

		// Sort features by level, then by name
		classFeatures.sort((a, b) => {
			const levelDiff = (a.system.gainedAtLevel ?? 0) - (b.system.gainedAtLevel ?? 0);
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		for (const feature of classFeatures) {
			if (isSpellProgressionFeature(feature.name ?? '')) continue;

			const feat = feature as NimbleFeatureItem;
			const level = feat.system.gainedAtLevel;
			const levelStr = level ? ` (Lvl ${level})` : '';
			const desc = stripHtml(feat.system.description);
			const content = desc
				? `• ${feature.name}${levelStr}: ${desc}`
				: `• ${feature.name}${levelStr}`;
			const contentHtml = desc
				? `• <strong>${feature.name}${levelStr}:</strong> ${desc}`
				: `• <strong>${feature.name}${levelStr}</strong>`;

			items.push({
				id: `feature-${feature.id}`,
				category: 'features',
				label: `${feature.name}${levelStr}`,
				content,
				contentHtml,
			});
		}
	}

	// Spells (individual spells with details)
	const spells = actor.items.filter((item) => item.isType('spell')) as NimbleSpellItem[];
	if (spells.length > 0) {
		// Sort by: utility first, then cantrips, then by tier, then alphabetically
		spells.sort((a, b) => {
			const aIsUtility = a.system.properties?.selected?.includes('utilitySpell') ? 1 : 0;
			const bIsUtility = b.system.properties?.selected?.includes('utilitySpell') ? 1 : 0;

			// Utility spells come first
			if (aIsUtility !== bIsUtility) return bIsUtility - aIsUtility;

			// Then sort by tier (cantrips/tier 0 first)
			const tierDiff = (a.system.tier ?? 0) - (b.system.tier ?? 0);
			if (tierDiff !== 0) return tierDiff;

			// Then alphabetically
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		for (const spell of spells) {
			const tier = spell.system.tier ?? 0;
			const isUtility = spell.system.properties?.selected?.includes('utilitySpell');
			const tierLabel = isUtility ? 'Utility' : tier === 0 ? 'Cantrip' : `Tier ${tier}`;
			const details = extractSpellDetails(spell);
			const content = details ? `• ${spell.name}: ${details}` : `• ${spell.name}`;
			const contentHtml = details
				? `• <strong>${spell.name}:</strong> ${details}`
				: `• <strong>${spell.name}</strong>`;

			items.push({
				id: `spell-${spell.id}`,
				category: 'spells',
				label: `${spell.name} (${tierLabel})`,
				content,
				contentHtml,
			});
		}
	}

	// Inventory items
	const objects = actor.items.filter((item) => item.isType('object')) as NimbleObjectItem[];
	for (const obj of objects) {
		const qty = obj.system.quantity ?? 1;
		const qtyStr = qty > 1 ? ` (x${qty})` : '';
		const equipped = obj.system.equipped ? ' [E]' : '';
		const details = extractItemDetails(obj);
		const content = `• ${details}`;
		const contentHtml = `• <strong>${obj.name}${qtyStr}${equipped}:</strong> ${details.substring(details.indexOf('|') + 1).trim() || 'No details'}`;

		items.push({
			id: `inventory-${obj.id}`,
			category: 'inventory',
			label: `${obj.name}${qtyStr}${equipped}`,
			content,
			contentHtml,
		});
	}

	return items;
}

export {
	CHARS_PER_COLUMN,
	generateInitialColumnContent,
	generateInitialColumnContentHtml,
	getSelectableItems,
	type ContentSection,
	type SelectableItem,
};
