const CLASS_FEATURES_PACK_COLLECTION = 'nimble.nimble-class-features';
const ENTRY_WITH_LEVEL_CLASS = 'nimble-compendium-entry-with-level';
const LEVEL_BADGE_CLASS = 'nimble-compendium-entry-level';
const LEVEL_NAME_FLEX_CLASS = 'nimble-class-feature-name-flex';

type FeatureEntryData = {
	entryElement: HTMLElement;
	gainedAtLevel: number | null;
	nameElement: HTMLElement;
	parentElement: HTMLElement;
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
		const gainedAtLevel = toLevel(foundry.utils.getProperty(indexEntry, 'system.gainedAtLevel'));
		const title =
			(typeof indexEntry?.name === 'string' ? indexEntry.name : '') ||
			(nameElement.textContent?.trim() ?? '');

		entries.push({
			entryElement,
			gainedAtLevel,
			nameElement,
			parentElement: entryElement.parentElement,
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
			const aLevel = a.gainedAtLevel ?? Number.MAX_SAFE_INTEGER;
			const bLevel = b.gainedAtLevel ?? Number.MAX_SAFE_INTEGER;
			if (aLevel !== bLevel) return aLevel - bLevel;

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
	for (const { entryElement, gainedAtLevel, nameElement } of entries) {
		if (!gainedAtLevel) {
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

		levelBadge.textContent = String(gainedAtLevel);
		entryElement.classList.add(ENTRY_WITH_LEVEL_CLASS);
	}
}

export default function renderCompendium(application: any, element: HTMLElement) {
	const pack = application.collection as any;
	if (!pack || pack.collection !== CLASS_FEATURES_PACK_COLLECTION) return;

	void pack
		.getIndex({
			fields: ['system.gainedAtLevel'],
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
