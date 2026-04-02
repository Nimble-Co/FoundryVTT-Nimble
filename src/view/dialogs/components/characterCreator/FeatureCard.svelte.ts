import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { DescriptionPart, SpellUuidMatch } from '#types/components/ClassFeatureSelection.d.ts';

/** Regex pattern to match @UUID references to spells */
const SPELL_UUID_PATTERN = /@UUID\[([^\]]*spell[^\]]*)\](?:\{[^}]*\})?/gi;

/**
 * Finds all spell UUID matches in a description string
 */
function findSpellUuidMatches(description: string): SpellUuidMatch[] {
	const matches: SpellUuidMatch[] = [];

	// Reset regex state
	SPELL_UUID_PATTERN.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = SPELL_UUID_PATTERN.exec(description)) !== null) {
		matches.push({
			uuid: match[1],
			start: match.index,
			end: match.index + match[0].length,
		});
	}

	return matches;
}

/**
 * Enriches a text segment using Foundry's TextEditor
 */
async function enrichText(text: string): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
}

/**
 * Attempts to fetch a spell from a UUID, returning null on failure
 */
async function fetchSpell(uuid: string): Promise<Item | null> {
	try {
		const item = (await fromUuid(uuid)) as Item | null;
		return item?.type === 'spell' ? item : null;
	} catch {
		return null;
	}
}

/**
 * Processes a description with spell references, splitting into parts
 */
async function processDescriptionWithSpells(
	description: string,
	matches: SpellUuidMatch[],
): Promise<DescriptionPart[]> {
	const parts: DescriptionPart[] = [];
	let lastIndex = 0;

	for (const match of matches) {
		// Add text before this match
		if (match.start > lastIndex) {
			const textBefore = description.slice(lastIndex, match.start);
			const enrichedText = await enrichText(textBefore);
			if (enrichedText.trim()) {
				parts.push({ type: 'text', content: enrichedText });
			}
		}

		// Fetch and add the spell
		const spell = await fetchSpell(match.uuid);
		if (spell) {
			parts.push({ type: 'spell', content: '', spell });
		} else {
			// Fallback: render as regular content link
			const fallbackText = description.slice(match.start, match.end);
			const enrichedFallback = await enrichText(fallbackText);
			parts.push({ type: 'text', content: enrichedFallback });
		}

		lastIndex = match.end;
	}

	// Add remaining text after last match
	if (lastIndex < description.length) {
		const textAfter = description.slice(lastIndex);
		const enrichedText = await enrichText(textAfter);
		if (enrichedText.trim()) {
			parts.push({ type: 'text', content: enrichedText });
		}
	}

	return parts;
}

/**
 * Parses a feature description, extracting spell references as separate parts
 */
async function parseDescription(description: string | undefined): Promise<DescriptionPart[]> {
	if (!description) {
		return [];
	}

	const matches = findSpellUuidMatches(description);

	if (matches.length === 0) {
		// No spell references, just enrich the whole thing
		const enrichedHtml = await enrichText(description);
		return [{ type: 'text', content: enrichedHtml }];
	}

	return processDescriptionWithSpells(description, matches);
}

/**
 * Creates reactive state for the FeatureCard component
 *
 * @param getFeature - Getter function that returns the feature item
 * @returns Object containing state and actions for the feature card
 */
export function createFeatureCardState(getFeature: () => NimbleFeatureItem) {
	let isExpanded = $state(false);
	let descriptionParts = $state<DescriptionPart[]>([]);

	// Parse description when feature changes
	$effect(() => {
		const feature = getFeature();
		parseDescription(feature?.system?.description).then((parts) => {
			descriptionParts = parts;
		});
	});

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function viewDetails(event: MouseEvent) {
		event.stopPropagation();
		getFeature().sheet?.render(true);
	}

	return {
		get isExpanded() {
			return isExpanded;
		},
		get descriptionParts() {
			return descriptionParts;
		},
		toggleExpanded,
		viewDetails,
	};
}
