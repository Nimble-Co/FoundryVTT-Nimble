import { MigrationBase } from '../MigrationBase.js';

const CELESTIAL_SOURCE_ID = 'Compendium.nimble.nimble-ancestries.Item.puHj7KBjvyb5mVHA';

const CELESTIAL_SAVING_THROW_RULE = {
	type: 'savingThrowRollMode',
	label: 'Highborn',
	value: 0,
	target: 'disadvantaged',
	mode: 'set',
} as const;

/**
 * Fixes Celestial ancestry characters whose "remove disadvantage on saves"
 * benefit was not applied during character creation.
 *
 * Root cause: `getChoicesFromCompendium` returned world-item UUIDs before
 * compendium UUIDs. If a world-level Celestial ancestry existed without the
 * `savingThrowRollMode` rule (imported before that rule was added to the pack),
 * `resolveSavingThrowRollModes` would miss it and leave the class's disadvantaged
 * save at -1 instead of 0.
 *
 * For each affected character this migration:
 * 1. Adds the missing `savingThrowRollMode` rule to the embedded ancestry item so
 *    the "Reset to Class Defaults" button works correctly going forward.
 * 2. Sets the class's disadvantaged save `defaultRollMode` to 0 on the actor.
 */
class Migration022CelestialSavingThrow extends MigrationBase {
	static override readonly version = 22;

	override readonly version = Migration022CelestialSavingThrow.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];

		const celestialAncestry = items.find((item) => {
			if (item?.type !== 'ancestry') return false;
			const sourceId = item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId;
			return sourceId === CELESTIAL_SOURCE_ID || item?.name === 'Celestial';
		});

		if (!celestialAncestry) return;

		const rules: any[] = Array.isArray(celestialAncestry?.system?.rules)
			? celestialAncestry.system.rules
			: [];

		const hasNeutralizeRule = rules.some(
			(rule) =>
				rule?.type === 'savingThrowRollMode' &&
				rule?.target === 'disadvantaged' &&
				rule?.mode === 'set' &&
				rule?.value === 0,
		);

		if (!hasNeutralizeRule && celestialAncestry.system) {
			if (!Array.isArray(celestialAncestry.system.rules)) {
				celestialAncestry.system.rules = [];
			}
			celestialAncestry.system.rules.push({ ...CELESTIAL_SAVING_THROW_RULE });
		}

		const classItem = items.find((item) => item?.type === 'class');
		const disadvantagedSave = classItem?.system?.savingThrows?.disadvantage;
		if (!disadvantagedSave) return;

		const savingThrows = source.system?.savingThrows;
		if (savingThrows?.[disadvantagedSave]?.defaultRollMode === -1) {
			savingThrows[disadvantagedSave].defaultRollMode = 0;
		}
	}
}

export { Migration022CelestialSavingThrow };
