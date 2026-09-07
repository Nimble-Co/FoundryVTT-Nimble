import { SUBCLASS_LEVEL } from './const/levelUpConstants.ts';

/** Structural type for what the factory accesses on a class item */
interface ClassItemShape {
	system?: { classLevel?: number; hitDieSize?: number };
}

/** Structural type for an item as accessed by the level-down dialog. */
interface LevelDownItem {
	type: string;
	name: string;
	img?: string;
	system?: {
		levelUpOptions?: Array<{
			label?: string;
			rules?: Array<{ type?: string; poolIdentifier?: string }>;
		}>;
	};
}

/** Structural type for what the factory accesses on the actor document */
interface LevelDownActor {
	system: {
		levelUpHistory: Array<{
			classIdentifier: string;
			level: number;
			hpIncrease: number;
			hitDieAdded: boolean;
			skillIncreases: Record<string, number>;
			abilityIncreases: Record<string, number>;
			grantedFeatureIds: string[];
			grantedSpellIds?: string[];
			poolMaxBonuses?: Record<string, number>;
			removedSpells?: Array<{ uuid: string; name: string; img: string }>;
			convertedSpells?: Array<{ uuid: string; fromSchool: string; toSchool: string }>;
		}>;
	};
	classes: Record<string, ClassItemShape | undefined>;
	items: {
		filter(
			fn: (i: { type: string }) => boolean,
		): Array<{ name: string; img?: string; _stats?: { compendiumSource?: string } }>;
		get(id: string): { name: string; img?: string } | undefined;
	};
}

/**
 * Creates reactive state for the CharacterLevelDownDialog component.
 *
 * Derives all display data from the actor's level-up history, including
 * skill/ability changes, subclass removal, and granted features to revert.
 */
export function createLevelDownState(
	getActor: () => LevelDownActor,
	getDialog: () => { submit(data: Record<string, unknown>): void },
) {
	const levelUpHistory = $derived(getActor().system.levelUpHistory);
	const lastHistory = $derived(levelUpHistory[levelUpHistory.length - 1]);

	const characterClass = $derived(
		lastHistory
			? (getActor().classes[lastHistory.classIdentifier] as ClassItemShape | undefined)
			: undefined,
	);

	const currentLevel = $derived(characterClass?.system?.classLevel ?? 1);
	const newLevel = $derived(currentLevel - 1);

	// Get skill names for display
	const skillChanges = $derived(
		Object.entries(lastHistory?.skillIncreases ?? {})
			.filter(([, value]) => (value as number) > 0)
			.map(([key, value]) => ({
				name: CONFIG.NIMBLE.skills[key]?.label ?? key,
				points: value as number,
			})),
	);

	// Get ability score names for display
	const abilityChanges = $derived(
		Object.entries(lastHistory?.abilityIncreases ?? {})
			.filter(([, value]) => (value as number) > 0)
			.map(([key, value]) => ({
				name: CONFIG.NIMBLE.abilities[key]?.label ?? key,
				points: value as number,
			})),
	);

	// Check if subclass will be removed
	const willRemoveSubclass = $derived(lastHistory?.level <= SUBCLASS_LEVEL);
	const subclasses = $derived(getActor().items.filter((i) => i.type === 'subclass'));
	const hasSubclass = $derived(subclasses.length > 0);

	// Get granted features that will be removed
	const grantedFeatures = $derived(
		(lastHistory?.grantedFeatureIds ?? [])
			.map((id) => getActor().items.get(id))
			.filter((item): item is NonNullable<typeof item> => item !== undefined),
	);

	// Get granted spells that will be removed
	const grantedSpells = $derived(
		(lastHistory?.grantedSpellIds ?? [])
			.map((id) => getActor().items.get(id))
			.filter((item): item is NonNullable<typeof item> => item !== undefined),
	);

	// Get pool max bonuses (e.g. "+1 Max Combat Die") that will be reverted. These are stored on
	// the history entry rather than as a distinct granted item on repeat selections, so they would
	// otherwise be invisible in the revert preview. Labels are sourced from the feature option that
	// defines the bonus (stripping its leading "+N"), falling back to a humanized pool identifier.
	const poolBonusChanges = $derived.by(() => {
		const bonuses = lastHistory?.poolMaxBonuses ?? {};
		const entries = Object.entries(bonuses).filter(([, amount]) => amount > 0);
		if (entries.length === 0) return [];

		const labelByPool = new Map<string, string>();
		const items = getActor().items.filter(() => true) as unknown as LevelDownItem[];
		for (const item of items) {
			for (const option of item.system?.levelUpOptions ?? []) {
				for (const rule of option.rules ?? []) {
					if (rule.type !== 'poolMaxBonus' || typeof rule.poolIdentifier !== 'string') continue;
					if (labelByPool.has(rule.poolIdentifier)) continue;
					const raw = option.label ?? rule.poolIdentifier;
					labelByPool.set(rule.poolIdentifier, raw.replace(/^\+\d+\s*/, ''));
				}
			}
		}

		const humanize = (poolId: string) =>
			poolId
				.split('-')
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(' ');

		return entries.map(([poolId, amount]) => ({
			name: labelByPool.get(poolId) ?? humanize(poolId),
			amount,
		}));
	});

	// Get spells that were removed during subclass selection and will be restored
	const removedSpells = $derived(lastHistory?.removedSpells ?? []);

	// Get spells retagged by a restrictSpellSchools exception that will be reverted
	// to their original school. Names/images come from the owned spell items.
	const revertedSpells = $derived.by(() => {
		const converted = lastHistory?.convertedSpells ?? [];
		if (converted.length === 0) return [];

		const ownedSpells = getActor().items.filter((i) => i.type === 'spell');
		return converted.map((entry) => {
			const owned = ownedSpells.find((s) => s._stats?.compendiumSource === entry.uuid);
			return {
				uuid: entry.uuid,
				name: owned?.name ?? '',
				img: owned?.img ?? 'icons/svg/item-bag.svg',
			};
		});
	});

	function submit() {
		getDialog().submit({
			confirmed: true,
		});
	}

	return {
		get lastHistory() {
			return lastHistory;
		},
		get characterClass() {
			return characterClass;
		},
		get currentLevel() {
			return currentLevel;
		},
		get newLevel() {
			return newLevel;
		},
		get skillChanges() {
			return skillChanges;
		},
		get abilityChanges() {
			return abilityChanges;
		},
		get willRemoveSubclass() {
			return willRemoveSubclass;
		},
		get subclasses() {
			return subclasses;
		},
		get hasSubclass() {
			return hasSubclass;
		},
		get grantedFeatures() {
			return grantedFeatures;
		},
		get grantedSpells() {
			return grantedSpells;
		},
		get poolBonusChanges() {
			return poolBonusChanges;
		},
		get removedSpells() {
			return removedSpells;
		},
		get revertedSpells() {
			return revertedSpells;
		},
		submit,
	};
}
