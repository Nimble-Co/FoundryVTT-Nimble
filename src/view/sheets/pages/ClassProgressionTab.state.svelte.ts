import type { NimbleClassItem } from '#documents/item/class.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	ClassProgressionLevelData,
	SubclassChoice,
} from '#types/components/ClassProgressionTab.d.ts';
import buildSubclassFeatureIndex from '#utils/buildSubclassFeatureIndex.js';
import getClassProgressionData from '#utils/getClassProgressionData.js';
import getSubclassChoices from '#utils/getSubclassChoices.js';
import getSubclassFeaturesFromIndex from '#utils/getSubclassFeatures.js';
import { SUBCLASS_LEVELS } from './ClassProgressionTabConstants.js';
import {
	collectSelectionGroups,
	formatGroupName,
	getAbilityScoreEntry,
	getGroupLevels,
	isSubclassLevel,
} from './ClassProgressionTabUtils.js';

export function createClassProgressionTabState(getItem: () => NimbleClassItem) {
	let progressionData = $state<Map<number, ClassProgressionLevelData>>(new Map());
	let subclasses = $state<SubclassChoice[]>([]);
	let subclassProgressionData = $state<Map<string, Map<number, NimbleFeatureItem[]>>>(new Map());
	let isLoading = $state(true);
	let expandedGroups = $state<Set<string>>(new Set());
	let expandedSubclasses = $state<Set<string>>(new Set());

	const identifier = $derived(getItem().reactive.system.identifier);
	const groupIdentifiers = $derived(getItem().reactive.system.groupIdentifiers || []);
	const abilityScoreData = $derived(getItem().reactive.system.abilityScoreData);
	const keyAbilityScores = $derived(getItem().reactive.system.keyAbilityScores || []);
	const selectionGroups = $derived.by(() => collectSelectionGroups(progressionData));

	async function loadProgressionData(): Promise<void> {
		if (!identifier) return;

		isLoading = true;

		const [progression, subclassChoices, subclassIndex] = await Promise.all([
			getClassProgressionData(identifier, groupIdentifiers),
			getSubclassChoices(identifier),
			buildSubclassFeatureIndex(),
		]);

		progressionData = progression;
		subclasses = subclassChoices;

		const subclassData = new Map<string, Map<number, NimbleFeatureItem[]>>();
		await Promise.all(
			subclassChoices.map(async (subclass) => {
				const levelMap = new Map<number, NimbleFeatureItem[]>();
				await Promise.all(
					SUBCLASS_LEVELS.map(async (level) => {
						const features = await getSubclassFeaturesFromIndex(
							subclassIndex,
							identifier,
							subclass.identifier,
							level,
						);
						if (features.length > 0) levelMap.set(level, features);
					}),
				);
				subclassData.set(subclass.identifier, levelMap);
			}),
		);
		subclassProgressionData = subclassData;

		isLoading = false;
	}

	$effect(() => {
		if (!identifier) return;
		loadProgressionData();
	});

	$effect(() => {
		if (!identifier) return;
		// Capture for reactive tracking so the effect re-runs when groupIdentifiers changes
		const capturedGroupIdentifiers = groupIdentifiers;

		function isRelevantItem(item: Item): boolean {
			if (item.type === 'subclass') {
				const subclass = item as { system?: { parentClass?: string } };
				return subclass.system?.parentClass === identifier;
			}
			if (item.type === 'feature') {
				const feature = item as { system?: { class?: string; group?: string } };
				if (feature.system?.class === identifier) return true;
				if (feature.system?.group && capturedGroupIdentifiers.includes(feature.system.group))
					return true;
			}
			return false;
		}

		function onItemChange(item: Item): void {
			if (isRelevantItem(item)) {
				loadProgressionData();
			}
		}

		const hookIds = [
			Hooks.on('createItem', onItemChange),
			Hooks.on('updateItem', onItemChange),
			Hooks.on('deleteItem', onItemChange),
		];

		return () => {
			Hooks.off('createItem', hookIds[0]);
			Hooks.off('updateItem', hookIds[1]);
			Hooks.off('deleteItem', hookIds[2]);
		};
	});

	function toggleGroup(groupName: string): void {
		const updated = new Set(expandedGroups);
		if (updated.has(groupName)) {
			updated.delete(groupName);
		} else {
			updated.add(groupName);
		}
		expandedGroups = updated;
	}

	function toggleSubclass(uuid: string): void {
		const updated = new Set(expandedSubclasses);
		if (updated.has(uuid)) {
			updated.delete(uuid);
		} else {
			updated.add(uuid);
		}
		expandedSubclasses = updated;
	}

	function handleFeatureClick(feature: NimbleFeatureItem): void {
		feature.sheet?.render(true);
	}

	function handleSubclassClick(uuid: string): void {
		// @ts-expect-error — Foundry's fromUuid accepts any string at runtime
		fromUuid(uuid).then((subclass) => {
			if (subclass) {
				(subclass as Item).sheet?.render(true);
			}
		});
	}

	async function handleAddFeature(level: number, classIdentifier: string): Promise<void> {
		const [createdFeature] = await Item.createDocuments([
			{
				name: `New Feature (Level ${level})`,
				type: 'feature',
				system: {
					featureType: 'class',
					class: classIdentifier,
					gainedAtLevel: level,
					gainedAtLevels: [level],
					group: `${classIdentifier}-progression`,
					subclass: false,
				},
			},
		] as unknown as Item.CreateData[]);
		createdFeature?.sheet?.render(true);
	}

	async function handleAddSubclass(): Promise<void> {
		const [createdSubclass] = await Item.createDocuments([
			{
				name: `New ${getItem().name} Subclass`,
				type: 'subclass',
				system: { parentClass: identifier },
			},
		] as unknown as Item.CreateData[]);
		createdSubclass?.sheet?.render(true);
	}

	async function handleAddSubclassFeature(
		subclassIdentifier: string,
		subclassName: string,
		level: number,
	): Promise<void> {
		const [createdFeature] = await Item.createDocuments([
			{
				name: `New ${subclassName} Feature (Level ${level})`,
				type: 'feature',
				system: {
					featureType: 'class',
					class: identifier,
					gainedAtLevel: level,
					gainedAtLevels: [level],
					group: subclassIdentifier,
					subclass: true,
				},
			},
		] as unknown as Item.CreateData[]);
		createdFeature?.sheet?.render(true);
	}

	async function handleAddFeatureToGroup(
		event: MouseEvent,
		groupName: string,
		levels: number[],
	): Promise<void> {
		event.stopPropagation();
		const [createdFeature] = await Item.createDocuments([
			{
				name: `New ${formatGroupName(groupName)} Feature`,
				type: 'feature',
				system: {
					featureType: 'class',
					class: identifier,
					gainedAtLevel: levels[0],
					gainedAtLevels: levels,
					group: groupName,
					subclass: false,
				},
			},
		] as unknown as Item.CreateData[]);
		createdFeature?.sheet?.render(true);
	}

	async function handleAddNewFeatureChoice(): Promise<void> {
		const newGroupName = `${identifier}-choice-${selectionGroups.size + 1}`;
		const [createdFeature] = await Item.createDocuments([
			{
				name: `New Feature Choice`,
				type: 'feature',
				system: {
					featureType: 'class',
					class: identifier,
					gainedAtLevel: 1,
					gainedAtLevels: [1],
					group: newGroupName,
					subclass: false,
				},
			},
		] as unknown as Item.CreateData[]);
		createdFeature?.sheet?.render(true);
	}

	return {
		get isLoading() {
			return isLoading;
		},
		get progressionData() {
			return progressionData;
		},
		get subclasses() {
			return subclasses;
		},
		get subclassProgressionData() {
			return subclassProgressionData;
		},
		get selectionGroups() {
			return selectionGroups;
		},
		get identifier() {
			return identifier;
		},
		get keyAbilityScores() {
			return keyAbilityScores;
		},
		get className() {
			return getItem().name;
		},
		SUBCLASS_LEVELS,
		isGroupExpanded: (groupName: string) => expandedGroups.has(groupName),
		isSubclassExpanded: (uuid: string) => expandedSubclasses.has(uuid),
		isSubclassLevel,
		getAbilityScoreEntry: (level: number) => getAbilityScoreEntry(level, abilityScoreData),
		getGroupLevels: (groupName: string) => getGroupLevels(progressionData, groupName),
		formatGroupName,
		toggleGroup,
		toggleSubclass,
		handleFeatureClick,
		handleSubclassClick,
		handleAddFeature,
		handleAddSubclass,
		handleAddSubclassFeature,
		handleAddFeatureToGroup,
		handleAddNewFeatureChoice,
	};
}
