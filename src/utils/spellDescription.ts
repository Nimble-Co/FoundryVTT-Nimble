export interface SpellDescriptionParts {
	baseEffect?: string;
	higherLevelEffect?: string;
	upcastEffect?: string;
}

/**
 * Combines spell description parts into a single HTML string
 */
export function combineSpellDescriptionParts(
	description: SpellDescriptionParts | string | null | undefined,
): string {
	if (typeof description === 'string') {
		return description;
	}

	if (!description || typeof description !== 'object') {
		return '';
	}

	const parts: string[] = [];
	if (description.baseEffect) parts.push(description.baseEffect);
	if (description.higherLevelEffect) {
		parts.push(`<p><strong>Higher Levels:</strong> ${description.higherLevelEffect}</p>`);
	}
	if (description.upcastEffect) {
		parts.push(`<p><strong>Upcast:</strong> ${description.upcastEffect}</p>`);
	}

	return parts.join('');
}

/**
 * Enriches HTML text using Foundry's TextEditor
 */
export async function enrichSpellText(text: string): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
}

/**
 * Fetches a spell by UUID and returns its combined description
 */
export async function fetchSpellDescriptionByUuid(uuid: string): Promise<string> {
	try {
		const spell = (await fromUuid(uuid)) as Item | null;
		if (!spell) return '';

		const system = spell.system as { description?: SpellDescriptionParts };
		return combineSpellDescriptionParts(system?.description);
	} catch {
		return '';
	}
}
