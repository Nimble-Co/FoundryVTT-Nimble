import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const ITEM_PREFIX = 'Compendium.nimble.nimble-items.Item.';
const MAGIC_ITEM_PREFIX = 'Compendium.nimble.nimble-magic-items.Item.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

type RuleSource = Record<string, unknown> & { type?: unknown };

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

/** Rules the pack now ships for hand count and swap budget, ids included. */
const ADDED_RULES: Record<string, RuleSource> = {
	[`${MAGIC_ITEM_PREFIX}7zMQ0sJgj1mEnu4P`]: buildExtraHandsRule('sLDkQwHn2RxVbT4e', '1'),
	[`${MAGIC_ITEM_PREFIX}jz2iteYOJdO4F4LP`]: buildExtraHandsRule('Jm7pXzQ4vNc8RdWy', '2'),
	[`${MAGIC_ITEM_PREFIX}IZrL12fqKA0O05Nz`]: buildExtraHandsRule('Qp3ZfLb9TxKm2Nud', '3'),
	[`${MAGIC_ITEM_PREFIX}mqeO0sGEV1L55FeJ`]: buildExtraHandsRule('Yw6HkTr1PzVc5Dqa', '4'),
	[`${FEATURE_PREFIX}j7H3pLmQ2Vx9A4Rc`]: {
		type: 'equipmentSwapBonus',
		disabled: false,
		id: 'Ff4NsMxQ7vLb1Tpc',
		identifier: '',
		label: 'Weapon Mastery',
		predicate: {},
		priority: 1,
		value: '1',
	},
};

function buildExtraHandsRule(id: string, value: string): RuleSource {
	return {
		type: 'extraHands',
		// Granted while the weapon is equipped, which is what enables its rules.
		disabled: true,
		id,
		identifier: '',
		label: 'Weapon of Many Hands',
		predicate: {},
		priority: 1,
		value,
	};
}

export class Migration058WeaponTwoHandedOverride extends MigrationBase {
	static override readonly version = 58;

	override readonly version = Migration058WeaponTwoHandedOverride.version;

	override async updateItem(source: any): Promise<void> {
		const sourceId = toSnapshotId(this.getSourceId(source)) ?? '';

		this.#correctStrengthOverride(source, sourceId);
		this.#addMissingRule(source, sourceId);
	}

	#correctStrengthOverride(source: any, sourceId: string): void {
		if (source.type !== 'object') return;

		const wasOverride = CORRECTED_OVERRIDES[sourceId];
		if (wasOverride === undefined) return;

		const strengthRequirement = source.system?.properties?.strengthRequirement;
		if (!strengthRequirement) return;

		// Leave a copy a user has already edited away from the shipped value alone.
		if (strengthRequirement.overridesTwoHanded !== wasOverride) return;

		strengthRequirement.overridesTwoHanded = !wasOverride;
	}

	#addMissingRule(source: any, sourceId: string): void {
		const rule = ADDED_RULES[sourceId];
		if (!rule) return;

		const rules: RuleSource[] = (source.system.rules ??= []);
		if (rules.some((existing) => existing.type === rule.type)) return;

		rules.push(foundry.utils.deepClone(rule));
	}
}
