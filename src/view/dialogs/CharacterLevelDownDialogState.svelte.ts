import { SUBCLASS_LEVEL } from './const/levelUpConstants.ts';

/** Structural type for what the factory accesses on a class item */
interface ClassItemShape {
	name?: string;
	system?: { classLevel?: number; hitDieSize?: number };
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
		}>;
	};
	classes: Record<string, ClassItemShape | undefined>;
	items: {
		filter(
			fn: (i: { type: string; system?: { parentClass?: string } }) => boolean,
		): Array<{ name: string; img?: string }>;
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
	const removesClass = $derived(Boolean(lastHistory) && currentLevel <= 1);
	const removedClassName = $derived(characterClass?.name || lastHistory?.classIdentifier || '');

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
	const classIdentifier = $derived(lastHistory?.classIdentifier ?? '');
	const subclasses = $derived(
		getActor().items.filter((item) => {
			if (item.type !== 'subclass') return false;
			const parent = item.system?.parentClass ?? '';
			return parent === '' || parent === classIdentifier;
		}),
	);
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
		get removesClass() {
			return removesClass;
		},
		get removedClassName() {
			return removedClassName;
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
		submit,
	};
}
