// `NimbleAncestryItem` and `NimbleAncestryBonusItem` are global ambient types
// (src/documents/item/item.d.ts).

interface AncestryBonusSelectionStateParams {
	getSelectedAncestry: () => NimbleAncestryItem | null;
	setSelectedAncestryBonus: (bonus: NimbleAncestryBonusItem | null) => void;
	setAncestryBonusConfirmed: (confirmed: boolean) => void;
}

/**
 * Reactive state for the ancestry-bonus step. Tracks whether the player is
 * confirming their current bonus or browsing the full list, and resolves a
 * browsed pick into a full document so its rules are available downstream.
 * Lives in `.svelte.ts` because it uses runes; called once during component init.
 */
export function createAncestryBonusSelectionState(params: AncestryBonusSelectionStateParams) {
	const { getSelectedAncestry, setSelectedAncestryBonus, setAncestryBonusConfirmed } = params;

	/** Local UI mode: false = confirm the default/current bonus, true = browse the full list. */
	let browsing = $state(false);

	/**
	 * Effect-local memo, deliberately not `$state` — it exists only to detect a
	 * change of ancestry, and making it reactive would re-trigger this effect.
	 */
	let previousAncestry: NimbleAncestryItem | null = null;

	const defaultBonusUuid = $derived(getSelectedAncestry()?.system?.defaultBonus ?? '');

	// Picking a new ancestry sends us back to the confirm view for that ancestry's default.
	$effect(() => {
		const ancestry = getSelectedAncestry();
		if (previousAncestry === ancestry) return;
		previousAncestry = ancestry;
		browsing = false;
	});

	async function handleBonusSelection(bonus: NimbleAncestryBonusItem): Promise<void> {
		// Resolve the full document so its rules are available, then drop back to the confirm
		// view so the player lands on the same Confirm / Change buttons with their new pick.
		const resolved = await fromUuid(bonus.uuid as `Item.${string}`);
		setSelectedAncestryBonus(resolved as NimbleAncestryBonusItem | null);
		browsing = false;
	}

	function confirmSelection(): void {
		setAncestryBonusConfirmed(true);
		browsing = false;
	}

	function editSelection(): void {
		setAncestryBonusConfirmed(false);
		browsing = false;
	}

	function startBrowsing(): void {
		browsing = true;
	}

	return {
		get browsing() {
			return browsing;
		},
		get defaultBonusUuid() {
			return defaultBonusUuid;
		},
		handleBonusSelection,
		confirmSelection,
		editSelection,
		startBrowsing,
	};
}
