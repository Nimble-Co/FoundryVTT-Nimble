const CLASS_FEATURES_PACK_COLLECTION = 'nimble.nimble-class-features';
const ENTRY_WITH_LEVEL_CLASS = 'nimble-compendium-entry-with-level';
const LEVEL_BADGE_CLASS = 'nimble-compendium-entry-level';
const LEVEL_NAME_FLEX_CLASS = 'nimble-class-feature-name-flex';

type FeatureEntryData = {
	entryElement: HTMLElement;
	gainedAtLevels: number[];
	nameElement: HTMLElement;
	parentElement: HTMLElement;
	sortLevel: number | null;
	title: string;
};

function toLevel(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) && value > 0 ? value : null;
	}

	if (typeof value === 'string') {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}

	return null;
}

function toLevels(value: unknown): number[] {
	const levels = new Set<number>();

	const pushLevel = (candidate: unknown) => {
		const parsed = toLevel(candidate);
		if (parsed !== null) levels.add(parsed);
	};

	if (Array.isArray(value)) {
		for (const candidate of value) {
			pushLevel(candidate);
		}
	} else if (typeof value === 'string' && value.includes(',')) {
		for (const candidate of value.split(',')) {
			pushLevel(candidate);
		}
	} else if (typeof value === 'string') {
		const matches = value.match(/\d+/g);
		if (matches && matches.length > 1) {
			for (const candidate of matches) {
				pushLevel(candidate);
			}
		} else {
			pushLevel(value);
		}
	} else {
		pushLevel(value);
	}

	return [...levels].sort((a, b) => a - b);
}

function getFeatureLevels(indexEntry: any): number[] {
	const gainedAtLevels = toLevels(foundry.utils.getProperty(indexEntry, 'system.gainedAtLevels'));
	if (gainedAtLevels.length > 0) return gainedAtLevels;

	return toLevels(foundry.utils.getProperty(indexEntry, 'system.gainedAtLevel'));
}

function removeLevelBadge(entryElement: HTMLElement) {
	entryElement.classList.remove(ENTRY_WITH_LEVEL_CLASS);
	entryElement.querySelector(`.${LEVEL_NAME_FLEX_CLASS}`)?.classList.remove(LEVEL_NAME_FLEX_CLASS);
	entryElement.querySelector(`.${LEVEL_BADGE_CLASS}`)?.remove();
}

function collectClassFeatureEntryData(pack: any, element: HTMLElement): FeatureEntryData[] {
	const entries: FeatureEntryData[] = [];

	for (const entryElement of element.querySelectorAll<HTMLElement>('[data-entry-id]')) {
		const entryId = entryElement.dataset.entryId;
		if (!entryId) continue;
		if (!entryElement.parentElement) continue;

		const nameElement =
			entryElement.querySelector<HTMLElement>('.entry-name') ??
			entryElement.querySelector<HTMLElement>('a') ??
			entryElement;

		const indexEntry = pack.index.get(entryId);
		const gainedAtLevels = getFeatureLevels(indexEntry);
		const title =
			(typeof indexEntry?.name === 'string' ? indexEntry.name : '') ||
			(nameElement.textContent?.trim() ?? '');

		entries.push({
			entryElement,
			gainedAtLevels,
			nameElement,
			parentElement: entryElement.parentElement,
			sortLevel: gainedAtLevels[0] ?? null,
			title,
		});
	}

	return entries;
}

function sortClassFeatureEntries(entries: FeatureEntryData[]) {
	const groupedByParent = new Map<HTMLElement, FeatureEntryData[]>();

	for (const entry of entries) {
		const groupedEntries = groupedByParent.get(entry.parentElement) ?? [];
		groupedEntries.push(entry);
		groupedByParent.set(entry.parentElement, groupedEntries);
	}

	for (const [parentElement, groupedEntries] of groupedByParent) {
		groupedEntries.sort((a, b) => {
			const aLevel = a.sortLevel ?? Number.MAX_SAFE_INTEGER;
			const bLevel = b.sortLevel ?? Number.MAX_SAFE_INTEGER;
			if (aLevel !== bLevel) return aLevel - bLevel;

			const aIsSingleLevel = a.gainedAtLevels.length === 1;
			const bIsSingleLevel = b.gainedAtLevels.length === 1;
			if (aIsSingleLevel !== bIsSingleLevel) {
				return aIsSingleLevel ? -1 : 1;
			}

			return a.title.localeCompare(b.title, undefined, {
				numeric: true,
				sensitivity: 'base',
			});
		});

		for (const entry of groupedEntries) {
			parentElement.append(entry.entryElement);
		}
	}
}

function applyClassFeatureLevelsToEntries(entries: FeatureEntryData[]) {
	for (const { entryElement, gainedAtLevels, nameElement } of entries) {
		if (gainedAtLevels.length < 1) {
			removeLevelBadge(entryElement);
			continue;
		}

		nameElement.classList.add(LEVEL_NAME_FLEX_CLASS);
		nameElement.style.setProperty('display', 'flex', 'important');
		nameElement.style.setProperty('align-items', 'center', 'important');
		nameElement.style.setProperty('width', '100%', 'important');
		nameElement.style.setProperty('min-width', '0', 'important');

		let levelBadge = nameElement.querySelector<HTMLElement>(`.${LEVEL_BADGE_CLASS}`);
		if (!levelBadge) {
			levelBadge = document.createElement('span');
			levelBadge.classList.add(LEVEL_BADGE_CLASS);
			nameElement.append(levelBadge);
		}

		levelBadge.style.setProperty('margin-left', 'auto', 'important');
		levelBadge.style.setProperty('margin-right', '6px', 'important');
		levelBadge.style.setProperty('display', 'inline-block', 'important');
		levelBadge.style.setProperty('white-space', 'nowrap', 'important');

		levelBadge.textContent = gainedAtLevels.join(', ');
		entryElement.classList.add(ENTRY_WITH_LEVEL_CLASS);
	}
}

export default function renderCompendium(application: any, element: HTMLElement) {
	const pack = application.collection as any;
	if (!pack || pack.collection !== CLASS_FEATURES_PACK_COLLECTION) return;

	void pack
		.getIndex({
			fields: ['system.gainedAtLevel', 'system.gainedAtLevels'],
		})
		.then(() => {
			const entryData = collectClassFeatureEntryData(pack, element);
			sortClassFeatureEntries(entryData);
			applyClassFeatureLevelsToEntries(entryData);
		})
		.catch((error) => {
			console.error('Nimble: Failed to apply class feature level labels in compendium', error);
		});
}
