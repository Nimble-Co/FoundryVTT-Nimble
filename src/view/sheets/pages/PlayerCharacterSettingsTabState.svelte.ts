import { SYSTEM_ID } from '#system';

export function createPlayerCharacterSettingsTabState(
	getActor: () => any,
	getEditingEnabled: () => boolean,
) {
	const flags = $derived(getActor().reactive.flags[SYSTEM_ID]);
	const editingEnabled = $derived(getEditingEnabled());

	const automaticallyExecuteAvailableMacros = $derived(
		flags?.automaticallyExecuteAvailableMacros ?? true,
	);
	const actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	const actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	const actorImageScale = $derived(flags?.actorImageScale ?? 100);
	const bonusInventorySlots = $derived(getActor().reactive?.system?.inventory?.bonusSlots ?? 0);
	const compactSkillsView = $derived(flags?.compactSkillsView ?? true);
	const includeCurrencyBulk = $derived(flags?.includeCurrencyBulk ?? true);
	const showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
	const showPassiveSkillScores = $derived(flags?.showPassiveSkillScores ?? false);
	const trackInventorySlots = $derived(flags?.trackInventorySlots ?? true);
	const highestUnlockedSpellTier = $derived(
		getActor().reactive?.system?.resources?.highestUnlockedSpellTier ?? 0,
	);

	function updateBonusInventorySlots(newValue: number) {
		if (newValue < 0) return;
		getActor().update({ 'system.inventory.bonusSlots': newValue });
	}

	async function updateHighestUnlockedSpellTier(newValue: number) {
		if (newValue < 0) return;
		await getActor().update({ 'system.resources.highestUnlockedSpellTier': newValue });
	}

	return {
		get editingEnabled() {
			return editingEnabled;
		},
		get automaticallyExecuteAvailableMacros() {
			return automaticallyExecuteAvailableMacros;
		},
		get actorImageXOffset() {
			return actorImageXOffset;
		},
		get actorImageYOffset() {
			return actorImageYOffset;
		},
		get actorImageScale() {
			return actorImageScale;
		},
		get bonusInventorySlots() {
			return bonusInventorySlots;
		},
		get compactSkillsView() {
			return compactSkillsView;
		},
		get includeCurrencyBulk() {
			return includeCurrencyBulk;
		},
		get showEmbeddedDocumentImages() {
			return showEmbeddedDocumentImages;
		},
		get showPassiveSkillScores() {
			return showPassiveSkillScores;
		},
		get trackInventorySlots() {
			return trackInventorySlots;
		},
		get highestUnlockedSpellTier() {
			return highestUnlockedSpellTier;
		},
		updateBonusInventorySlots,
		updateHighestUnlockedSpellTier,
	};
}
