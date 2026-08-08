import type { AoETemplateConfig } from './buildAoERegionShape.js';
import { placeAoERegion } from './placeAoERegion.js';

interface AoECapableMessage extends ChatMessage {
	addTokensInRegionAsTargets(region: RegionDocument): Promise<void>;
}

/**
 * Resolve the display name for the placed region, mirroring how the chat
 * cards label their template section: spell cards use spellName, object cards
 * hide the public name while unidentified, everything else uses system.name.
 */
function resolveAoEName(message: ChatMessage): string {
	const system = message.system as Record<string, unknown>;
	const rawName = system.name;
	if (typeof rawName === 'object' && rawName !== null) {
		const objectName = rawName as { public?: string; unidentified?: string };
		return (system.isIdentified ? objectName.public : objectName.unidentified) ?? '';
	}
	return String(system.spellName ?? rawName ?? message.flavor ?? '');
}

/**
 * Begin interactive AoE placement for a freshly posted activation card and add
 * the tokens inside the placed region to the card's target list.
 *
 * Fire-and-forget companion to item activation: does nothing when the item has
 * no AoE template or no scene is being viewed. The card's place button remains
 * as the retry path (after a cancel, or to place the area again).
 */
export async function placeAoEForMessage(message: ChatMessage): Promise<void> {
	const system = message.system as {
		activation?: { acquireTargetsFromTemplate?: boolean; template?: AoETemplateConfig };
	};
	// Only intentional AoE items (flag + shape): a bare template shape can be a
	// stale leftover in item data.
	if (!system.activation?.acquireTargetsFromTemplate) return;
	const template = system.activation.template;
	if (!template?.shape) return;
	if (!canvas?.ready || !canvas.scene) return;

	const region = await placeAoERegion(template, { name: resolveAoEName(message) });
	if (region) await (message as AoECapableMessage).addTokensInRegionAsTargets?.(region);
}
