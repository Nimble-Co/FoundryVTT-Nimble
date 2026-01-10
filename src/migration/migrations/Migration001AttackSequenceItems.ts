import { MigrationBase } from '../MigrationBase.js';

/**
 * Generate a Foundry-compatible 16-character random ID
 */
function generateId(): string {
	// Use Foundry's randomID if available, otherwise generate our own
	if (typeof foundry !== 'undefined' && foundry?.utils?.randomID) {
		return foundry.utils.randomID();
	}
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Migration to convert actor-level attackSequence field to item-based attackSequence.
 *
 * For actors that have system.attackSequence set:
 * 1. Creates a new monsterFeature item with subtype 'attackSequence'
 * 2. Sets all action items' parentItemId to reference the new attackSequence item
 * 3. Clears the actor-level attackSequence field
 *
 * Note: The parentItemId references may become stale if Foundry regenerates IDs
 * (e.g., when importing from compendium). The rendering logic handles this gracefully
 * by treating actions with invalid parentItemId as orphans.
 */
class Migration001AttackSequenceItems extends MigrationBase {
	static override readonly version = 1;

	override readonly version = Migration001AttackSequenceItems.version;

	override async updateActor(source: any): Promise<void> {
		// Only process actors that have embedded items (monsters, characters, etc.)
		if (!source.items) return;

		// Check if actor has an attackSequence field with content
		const attackSequenceDescription = source.system?.attackSequence;

		// Check if there's already an attackSequence item
		const existingAttackSequence = source.items.find(
			(item: any) => item.type === 'monsterFeature' && item.system?.subtype === 'attackSequence',
		);

		if (existingAttackSequence) {
			// Already has an attackSequence item - link orphan actions to it and clear field
			const attackSequenceId = existingAttackSequence._id;
			if (attackSequenceId) {
				let linkedCount = 0;
				for (const item of source.items) {
					if (item.type === 'monsterFeature' && item.system?.subtype === 'action') {
						// Link actions that have no parent or have a stale parent
						if (!item.system.parentItemId || item.system.parentItemId !== attackSequenceId) {
							item.system.parentItemId = attackSequenceId;
							linkedCount++;
						}
					}
				}
				if (linkedCount > 0) {
					console.log(
						`Nimble Migration | ${source.name}: linked ${linkedCount} actions to existing attackSequence`,
					);
				}
			}
			if (attackSequenceDescription) {
				source.system.attackSequence = '';
			}
			return;
		}

		// If no attackSequence item and no description, nothing to do
		if (!attackSequenceDescription || attackSequenceDescription.trim() === '') return;

		// Generate ID for the new attackSequence item
		const attackSequenceId = generateId();

		// Create the new attackSequence item
		const attackSequenceItem: Record<string, any> = {
			_id: attackSequenceId,
			name: 'Attack Sequence',
			type: 'monsterFeature',
			img: 'icons/svg/sword.svg',
			system: {
				macro: '',
				identifier: 'attack-sequence',
				rules: [],
				activation: {
					acquireTargetsFromTemplate: false,
					cost: {
						details: '',
						quantity: 1,
						type: 'none',
						isReaction: false,
					},
					duration: {
						details: '',
						quantity: 1,
						type: 'none',
					},
					effects: [],
					showDescription: true,
					targets: {
						count: 1,
						restrictions: '',
					},
					template: {
						length: 1,
						radius: 1,
						shape: '',
						width: 1,
					},
				},
				description: attackSequenceDescription,
				subtype: 'attackSequence',
				parentItemId: '',
			},
			effects: [],
			folder: null,
			sort: 0,
			flags: {},
		};

		// Add the attackSequence item to the actor's items
		source.items.push(attackSequenceItem);

		// Update all action items to reference the new attackSequence as their parent
		let linkedCount = 0;
		for (const item of source.items) {
			if (item.type === 'monsterFeature' && item.system?.subtype === 'action') {
				// Link all actions to the new attackSequence (overwrite any stale parentItemId)
				item.system.parentItemId = attackSequenceId;
				linkedCount++;
			}
		}

		// Clear the actor-level attackSequence field
		source.system.attackSequence = '';

		console.log(
			`Nimble Migration | ${source.name}: created attackSequence item and linked ${linkedCount} actions`,
		);
	}
}

export { Migration001AttackSequenceItems };
