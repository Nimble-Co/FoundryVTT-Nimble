import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const ITEM_PREFIX = 'Compendium.nimble.nimble-items.Item.';

/**
 * `overridesTwoHanded` means "meeting the strength requirement lets you wield
 * this one-handed". It was authored as "this weapon has a strength
 * requirement", which inverted it on every core weapon that carries one. The
 * Longsword is the only weapon in the book whose requirement is an override
 * ("2-handed (1-handed: Req. 2 STR)"); the rest are flat requirements on a
 * weapon that stays two-handed.
 */
const CORRECTED_OVERRIDES: Record<string, boolean> = {
	[`${ITEM_PREFIX}DPfIK6l48uJ2ik2s`]: false, // Longsword
	[`${ITEM_PREFIX}ICFd5BjIIRDzA0y5`]: true, // Greatmaul
	[`${ITEM_PREFIX}n9XAnzWIUCaR6C6T`]: true, // Greataxe
	[`${ITEM_PREFIX}oRFd8K71REypDh73`]: true, // Greatsword
	[`${ITEM_PREFIX}zdZkxV0bAA2ERANt`]: true, // Handheld Ballista
	[`${ITEM_PREFIX}9PodmCbF1lkpHEIN`]: true, // Longbow
};

export class Migration067WeaponTwoHandedOverride extends MigrationBase {
	static override readonly version = 67;

	override readonly version = Migration067WeaponTwoHandedOverride.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'object') return;

		const sourceId = toSnapshotId(this.getSourceId(source)) ?? '';
		const wasOverride = CORRECTED_OVERRIDES[sourceId];
		if (wasOverride === undefined) return;

		const strengthRequirement = source.system?.properties?.strengthRequirement;
		if (!strengthRequirement) return;

		// Leave a copy a user has already edited away from the shipped value alone.
		if (strengthRequirement.overridesTwoHanded !== wasOverride) return;

		strengthRequirement.overridesTwoHanded = !wasOverride;
	}
}
