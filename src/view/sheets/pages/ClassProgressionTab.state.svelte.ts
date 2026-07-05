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
import localize from '#utils/localize.js';
import { SUBCLASS_LEVELS } from './ClassProgressionTabConstants.js';
import {
	collectSelectionGroups,
	formatGroupName,
	getAbilityScoreEntry,
	getGroupLevels,
	getItemSource,
	isSubclassLevel,
} from './ClassProgressionTabUtils.js';

export function createClassProgressionTabState(getItem: () => NimbleClassItem) {
	let progressionData = $state<Map<number, ClassProgressionLevelData>>(new Map());
	let subclasses = $state<SubclassChoice[]>([]);
	let subclassProgressionData = $state<Map<string, Map<number, NimbleFeatureItem[]>>>(new Map());
	let isLoading = $state(true);
	let expandedGroups = $state<Set<string>>(new Set());
	let expandedSubclasses = $state<Set<string>>(new Set());
	let enrichedFeatureDescriptions = $state<Map<string, string>>(new Map());

	const identifier = $derived(getItem().reactive.system.identifier);
	const classSource = $derived(getItemSource(getItem().uuid ?? ''));
	const groupIdentifiers = $derived(getItem().reactive.system.groupIdentifiers || []);
	const abilityScoreData = $derived(getItem().reactive.system.abilityScoreData);
	const keyAbilityScores = $derived(getItem().reactive.system.keyAbilityScores || []);
	const selectionGroups = $derived.by(() => collectSelectionGroups(progressionData));

	async function loadProgressionData(): Promise<void> {
		if (!identifier) return;

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

	$effect(() => {
		const featuresToEnrich: NimbleFeatureItem[] = [];

		for (const [, levelMap] of subclassProgressionData) {
			for (const [, features] of levelMap) {
				featuresToEnrich.push(...features);
			}
		}
		for (const [, features] of selectionGroups) {
			featuresToEnrich.push(...features);
		}

		let cancelled = false;

		async function enrich(): Promise<void> {
			const result = new Map<string, string>();
			await Promise.all(
				featuresToEnrich.map(async (feature) => {
					const desc = feature.system?.description ?? '';
					if (!desc) return;
					result.set(
						feature.uuid ?? '',
						await foundry.applications.ux.TextEditor.implementation.enrichHTML(desc),
					);
				}),
			);
			if (!cancelled) enrichedFeatureDescriptions = result;
		}

		enrich();
		return () => {
			cancelled = true;
		};
	});

	function getSourceTag(uuid: string): 'world' | 'pack' | null {
		const itemSource = getItemSource(uuid);
		if (itemSource === classSource) return null;
		return itemSource === 'world' ? 'world' : 'pack';
	}

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
		fromUuid(uuid).then((subclass) => {
			if (subclass) {
				(subclass as Item).sheet?.render(true);
			}
		});
	}

	async function createItem(data: Record<string, unknown>): Promise<Item | undefined> {
		const [item] = await Item.createDocuments([data] as unknown as Item.CreateData[]);
		return item;
	}

	async function handleAddFeature(level: number, classIdentifier: string): Promise<void> {
		const created = await createItem({
			name: localize('NIMBLE.classSheet.progressionNewFeatureName', { level: String(level) }),
			type: 'feature',
			system: {
				featureType: 'class',
				class: classIdentifier,
				gainedAtLevel: level,
				gainedAtLevels: [level],
				group: `${classIdentifier}-progression`,
				subclass: false,
			},
		});
		created?.sheet?.render(true);
	}

	async function handleAddSubclass(): Promise<void> {
		const created = await createItem({
			name: localize('NIMBLE.classSheet.progressionNewSubclassName', {
				className: getItem().name,
			}),
			type: 'subclass',
			system: { parentClass: identifier },
		});
		created?.sheet?.render(true);
	}

	async function handleAddSubclassFeature(
		subclassIdentifier: string,
		subclassName: string,
		level: number,
	): Promise<void> {
		const created = await createItem({
			name: localize('NIMBLE.classSheet.progressionNewSubclassFeatureName', {
				subclassName,
				level: String(level),
			}),
			type: 'feature',
			system: {
				featureType: 'class',
				class: identifier,
				gainedAtLevel: level,
				gainedAtLevels: [level],
				group: subclassIdentifier,
				subclass: true,
			},
		});
		created?.sheet?.render(true);
	}

	function generateUniqueFeatureName(groupName: string): string {
		const base = localize('NIMBLE.classSheet.progressionNewGroupFeatureName', {
			groupName: formatGroupName(groupName),
		});
		const taken = new Set<string>();
		for (const item of game.items) {
			if (
				item.type === 'feature' &&
				(item as unknown as NimbleFeatureItem).system?.group === groupName
			) {
				taken.add(item.name);
			}
		}
		if (!taken.has(base)) return base;
		let n = 2;
		while (taken.has(`${base} ${n}`)) n++;
		return `${base} ${n}`;
	}

	async function handleAddFeatureToGroup(
		event: MouseEvent,
		groupName: string,
		levels: number[],
	): Promise<void> {
		event.stopPropagation();
		const created = await createItem({
			name: generateUniqueFeatureName(groupName),
			type: 'feature',
			system: {
				featureType: 'class',
				class: identifier,
				gainedAtLevel: levels[0],
				gainedAtLevels: levels,
				group: groupName,
				subclass: false,
			},
		});
		created?.sheet?.render(true);
	}

	async function handleDeleteWorldItem(uuid: string, name: string): Promise<void> {
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: localize('NIMBLE.classSheet.progressionDeleteWorldItemTitle') },
			content: `<p>${localize('NIMBLE.classSheet.progressionDeleteWorldItemContent', { name })}</p>`,
			yes: { label: localize('NIMBLE.classSheet.progressionDeleteWorldItemConfirm') },
			no: { label: localize('NIMBLE.classSheet.progressionDeleteWorldItemCancel') },
		});
		if (confirmed !== true) return;
		const item = await fromUuid(uuid as `Item.${string}`);
		if (item) await (item as Item).delete();
	}

	async function handleAddNewFeatureChoice(): Promise<void> {
		const newGroupName = `${identifier}-choice-${selectionGroups.size + 1}`;
		const created = await createItem({
			name: localize('NIMBLE.classSheet.progressionNewFeatureChoiceName'),
			type: 'feature',
			system: {
				featureType: 'class',
				class: identifier,
				gainedAtLevel: 1,
				gainedAtLevels: [1],
				group: newGroupName,
				subclass: false,
			},
		});
		created?.sheet?.render(true);
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
		get enrichedFeatureDescriptions() {
			return enrichedFeatureDescriptions;
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
		getSourceTag,
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
		handleDeleteWorldItem,
		handleAddFeature,
		handleAddSubclass,
		handleAddSubclassFeature,
		handleAddFeatureToGroup,
		handleAddNewFeatureChoice,
	};
}
