import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleClassItem } from '#documents/item/class.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { NimbleObjectItem } from '#documents/item/object.js';
import type { NimbleSpellItem } from '#documents/item/spell.js';
import type { NimbleSubclassItem } from '#documents/item/subclass.js';

/** Estimated characters per column based on PDF config */
const CHARS_PER_COLUMN = 1150;

/** FoundryVTT adds String.prototype.slugify at runtime; this cast surfaces it to TypeScript. */
type FoundryString = string & { slugify(opts: { strict: boolean }): string };
function slugify(str: string): string {
	return (str as FoundryString).slugify({ strict: true });
}

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
 * Extract class features grouped by class, including group-selection features
 * and a separate section for each subclass.
 */
function extractClassFeaturesSection(actor: NimbleCharacter): ContentSection[] {
	const sections: ContentSection[] = [];
	const classes = actor.classes ?? {};

	for (const [classId, classItem] of Object.entries(classes)) {
		const groupIdentifiers: string[] = (classItem as NimbleClassItem).system.groupIdentifiers ?? [];

		// Subclass items for this class — computed first so we can exclude their features below
		const subclassItems = actor.items.filter(
			(i) =>
				i.type === 'subclass' &&
				(i as NimbleSubclassItem).system.parentClass === classItem.identifier,
		) as NimbleSubclassItem[];

		// Collect IDs of features that belong to a real subclass section so they can be excluded
		const subclassFeatureIds = new Set<string>();
		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			for (const item of actor.items) {
				if (!item.isType('feature') || !item.id) continue;
				const feature = item as NimbleFeatureItem;
				if (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				) {
					subclassFeatureIds.add(item.id);
				}
			}
		}

		// Inclusive OR: class match OR group match — handles features where system.class may not
		// match classId exactly (e.g. authored with an old ID or a different identifier convention)
		const allClassFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			if (item.id && subclassFeatureIds.has(item.id)) return false;
			const classMatch =
				feature.system.class === classId || feature.system.class === classItem.identifier;
			const groupMatch =
				!!feature.system.group &&
				feature.system.group !== 'ungrouped' &&
				groupIdentifiers.includes(feature.system.group);
			return classMatch || groupMatch;
		}) as NimbleFeatureItem[];

		allClassFeatures.sort((a, b) => {
			const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
			const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
			const levelDiff = aLevel - bLevel;
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		if (allClassFeatures.length > 0) {
			const items: string[] = [];
			for (const feature of allClassFeatures) {
				if (isSpellProgressionFeature(feature.name ?? '')) continue;
				const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feature.system.description);
				items.push(desc ? `• ${feature.name}${levelStr}: ${desc}` : `• ${feature.name}${levelStr}`);
			}
			if (items.length > 0) {
				sections.push({ header: `${classItem.name.toUpperCase()} FEATURES`, items });
			}
		}

		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			const subclassFeatures = actor.items.filter((item) => {
				if (!item.isType('feature')) return false;
				const feature = item as NimbleFeatureItem;
				return (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				);
			}) as NimbleFeatureItem[];

			subclassFeatures.sort((a, b) => {
				const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
				const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
				const levelDiff = aLevel - bLevel;
				if (levelDiff !== 0) return levelDiff;
				return (a.name ?? '').localeCompare(b.name ?? '');
			});

			if (subclassFeatures.length > 0) {
				const items: string[] = [];
				for (const feature of subclassFeatures) {
					const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
					const levelStr = level ? ` (Lvl ${level})` : '';
					const desc = stripHtml(feature.system.description);
					items.push(
						desc ? `• ${feature.name}${levelStr}: ${desc}` : `• ${feature.name}${levelStr}`,
					);
				}
				sections.push({ header: `${subclassItem.name.toUpperCase()} (SUBCLASS)`, items });
			}
		}
	}

	return sections;
}

/**
 * Extract class features grouped by class as HTML, including group-selection features
 * and a separate section for each subclass.
 */
function extractClassFeaturesSectionHtml(actor: NimbleCharacter): ContentSectionHtml[] {
	const sections: ContentSectionHtml[] = [];
	const classes = actor.classes ?? {};

	for (const [classId, classItem] of Object.entries(classes)) {
		const groupIdentifiers: string[] = (classItem as NimbleClassItem).system.groupIdentifiers ?? [];

		// Subclass items for this class — computed first so we can exclude their features below
		const subclassItems = actor.items.filter(
			(i) =>
				i.type === 'subclass' &&
				(i as NimbleSubclassItem).system.parentClass === classItem.identifier,
		) as NimbleSubclassItem[];

		// Collect IDs of features that belong to a real subclass section so they can be excluded
		const subclassFeatureIds = new Set<string>();
		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			for (const item of actor.items) {
				if (!item.isType('feature') || !item.id) continue;
				const feature = item as NimbleFeatureItem;
				if (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				) {
					subclassFeatureIds.add(item.id);
				}
			}
		}

		// Inclusive OR: class match OR group match — handles features where system.class may not
		// match classId exactly (e.g. authored with an old ID or a different identifier convention)
		const allClassFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			if (item.id && subclassFeatureIds.has(item.id)) return false;
			const classMatch =
				feature.system.class === classId || feature.system.class === classItem.identifier;
			const groupMatch =
				!!feature.system.group &&
				feature.system.group !== 'ungrouped' &&
				groupIdentifiers.includes(feature.system.group);
			return classMatch || groupMatch;
		}) as NimbleFeatureItem[];

		allClassFeatures.sort((a, b) => {
			const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
			const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
			const levelDiff = aLevel - bLevel;
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		if (allClassFeatures.length > 0) {
			const items: string[] = [];
			for (const feature of allClassFeatures) {
				if (isSpellProgressionFeature(feature.name ?? '')) continue;
				const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feature.system.description);
				items.push(
					desc
						? `• <strong>${feature.name}${levelStr}:</strong> ${desc}`
						: `• <strong>${feature.name}${levelStr}</strong>`,
				);
			}
			if (items.length > 0) {
				sections.push({
					header: `<strong>${classItem.name.toUpperCase()} FEATURES</strong>`,
					items,
				});
			}
		}

		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			const subclassFeatures = actor.items.filter((item) => {
				if (!item.isType('feature')) return false;
				const feature = item as NimbleFeatureItem;
				return (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				);
			}) as NimbleFeatureItem[];

			subclassFeatures.sort((a, b) => {
				const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
				const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
				const levelDiff = aLevel - bLevel;
				if (levelDiff !== 0) return levelDiff;
				return (a.name ?? '').localeCompare(b.name ?? '');
			});

			if (subclassFeatures.length > 0) {
				const items: string[] = [];
				for (const feature of subclassFeatures) {
					const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
					const levelStr = level ? ` (Lvl ${level})` : '';
					const desc = stripHtml(feature.system.description);
					items.push(
						desc
							? `• <strong>${feature.name}${levelStr}:</strong> ${desc}`
							: `• <strong>${feature.name}${levelStr}</strong>`,
					);
				}
				sections.push({
					header: `<strong>${subclassItem.name.toUpperCase()} (SUBCLASS)</strong>`,
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
	const { gp, sp, cp } = actor.system.currency;

	if (objects.length === 0 && gp.value === 0 && sp.value === 0 && cp.value === 0) return null;

	const items: string[] = [];

	// Currency always first
	items.push(`• Currency: ${gp.value} GP, ${sp.value} SP, ${cp.value} CP`);

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
	const { gp, sp, cp } = actor.system.currency;

	if (objects.length === 0 && gp.value === 0 && sp.value === 0 && cp.value === 0) return null;

	const items: string[] = [];

	// Currency always first
	items.push(`• <strong>Currency:</strong> ${gp.value} GP, ${sp.value} SP, ${cp.value} CP`);

	for (const obj of objects) {
		const qty = obj.system.quantity ?? 1;
		const qtyStr = qty > 1 ? ` (x${qty})` : '';
		const equipped = obj.system.equipped ? ' [E]' : '';
		const details = extractItemDetails(obj);
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

	// Class features (regular + group-selection) and subclass features
	const classes = actor.classes ?? {};
	for (const [classId, classItem] of Object.entries(classes)) {
		const groupIdentifiers: string[] = (classItem as NimbleClassItem).system.groupIdentifiers ?? [];

		// Subclass items for this class — computed first so we can exclude their features below
		const subclassItems = actor.items.filter(
			(i) =>
				i.type === 'subclass' &&
				(i as NimbleSubclassItem).system.parentClass === classItem.identifier,
		) as NimbleSubclassItem[];

		// Collect IDs of features that belong to a real subclass section so they can be excluded
		const subclassFeatureIds = new Set<string>();
		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			for (const item of actor.items) {
				if (!item.isType('feature') || !item.id) continue;
				const feature = item as NimbleFeatureItem;
				if (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				) {
					subclassFeatureIds.add(item.id);
				}
			}
		}

		// Inclusive OR: class match OR group match — handles features where system.class may not
		// match classId exactly (e.g. authored with an old ID or a different identifier convention)
		const allClassFeatures = actor.items.filter((item) => {
			if (!item.isType('feature')) return false;
			const feature = item as NimbleFeatureItem;
			if (item.id && subclassFeatureIds.has(item.id)) return false;
			const classMatch =
				feature.system.class === classId || feature.system.class === classItem.identifier;
			const groupMatch =
				!!feature.system.group &&
				feature.system.group !== 'ungrouped' &&
				groupIdentifiers.includes(feature.system.group);
			return classMatch || groupMatch;
		}) as NimbleFeatureItem[];

		allClassFeatures.sort((a, b) => {
			const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
			const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
			const levelDiff = aLevel - bLevel;
			if (levelDiff !== 0) return levelDiff;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		for (const feature of allClassFeatures) {
			if (isSpellProgressionFeature(feature.name ?? '')) continue;
			const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
			const levelStr = level ? ` (Lvl ${level})` : '';
			const desc = stripHtml(feature.system.description);
			items.push({
				id: `feature-${feature.id}`,
				category: 'features',
				label: `${feature.name}${levelStr}`,
				content: desc ? `• ${feature.name}${levelStr}: ${desc}` : `• ${feature.name}${levelStr}`,
				contentHtml: desc
					? `• <strong>${feature.name}${levelStr}:</strong> ${desc}`
					: `• <strong>${feature.name}${levelStr}</strong>`,
			});
		}

		// Subclass features in their own category
		for (const subclassItem of subclassItems) {
			const subclassGroupKey = slugify(subclassItem.name ?? '');
			const subclassFeatures = actor.items.filter((item) => {
				if (!item.isType('feature')) return false;
				const feature = item as NimbleFeatureItem;
				return (
					feature.system.subclass === true &&
					(feature.system.class === classId || feature.system.class === classItem.identifier) &&
					feature.system.group === subclassGroupKey
				);
			}) as NimbleFeatureItem[];

			subclassFeatures.sort((a, b) => {
				const aLevel = a.system.gainedAtLevel ?? a.system.gainedAtLevels[0] ?? 0;
				const bLevel = b.system.gainedAtLevel ?? b.system.gainedAtLevels[0] ?? 0;
				const levelDiff = aLevel - bLevel;
				if (levelDiff !== 0) return levelDiff;
				return (a.name ?? '').localeCompare(b.name ?? '');
			});

			for (const feature of subclassFeatures) {
				const level = feature.system.gainedAtLevel ?? feature.system.gainedAtLevels[0] ?? null;
				const levelStr = level ? ` (Lvl ${level})` : '';
				const desc = stripHtml(feature.system.description);
				items.push({
					id: `subclass-feature-${feature.id}`,
					category: 'subclassFeatures',
					label: `${feature.name}${levelStr}`,
					content: desc ? `• ${feature.name}${levelStr}: ${desc}` : `• ${feature.name}${levelStr}`,
					contentHtml: desc
						? `• <strong>${feature.name}${levelStr}:</strong> ${desc}`
						: `• <strong>${feature.name}${levelStr}</strong>`,
				});
			}
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

	// Inventory items — currency always first, then individual objects
	const objects = actor.items.filter((item) => item.isType('object')) as NimbleObjectItem[];
	const { gp, sp, cp } = actor.system.currency;
	const currencyText = `${gp.value} GP, ${sp.value} SP, ${cp.value} CP`;
	items.push({
		id: 'currency',
		category: 'inventory',
		label: `Currency: ${currencyText}`,
		content: `• Currency: ${currencyText}`,
		contentHtml: `• <strong>Currency:</strong> ${currencyText}`,
	});

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

	// Character notes
	const notes = (actor.system as { details?: { notes?: string } }).details?.notes;
	if (notes && notes.trim()) {
		items.push({
			id: 'character-notes',
			category: 'character',
			label: 'Character Notes',
			content: stripHtml(notes) || notes,
			contentHtml: notes,
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
