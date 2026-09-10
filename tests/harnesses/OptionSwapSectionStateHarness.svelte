<script lang="ts">
	import { untrack } from 'svelte';

	import type { OptionSwapChange, ResolvedOptionSwapOffer } from '../../types/optionSwap.d.ts';

	import {
		createOptionSwapSectionState,
		type OptionSwapSectionState,
		type OptionSwapSkillData,
	} from '../../src/view/dialogs/components/optionSwap/OptionSwapSection.state.svelte.ts';

	interface Props {
		props: {
			offer: ResolvedOptionSwapOffer | null;
			skills: Record<string, OptionSwapSkillData>;
			onChange: (change: OptionSwapChange) => void;
		};
		/** Hands the state object back so a test can drive the actions. */
		onready?: (state: OptionSwapSectionState) => void;
	}

	let { props, onready }: Props = $props();

	const sectionState = createOptionSwapSectionState(() => props);

	// Capturing the initial `onready` is the intent, hence the untrack.
	untrack(() => onready?.(sectionState));

	// Serialized rather than read straight off the state, so every assertion goes through a
	// real render and proves the value is reactive.
	const snapshot = $derived(
		JSON.stringify({
			isPending: sectionState.isPending,
			skillMoveSummary: sectionState.skillMoveSummary,
			hasUnplacedPoint: sectionState.hasUnplacedPoint,
			cards: sectionState.cards.map((card) => ({
				name: card.name,
				subtitle: card.subtitle,
				offersSkillMove: card.offersSkillMove,
				isGivenUp: card.isGivenUp,
				givenUpText: card.givenUpText,
				pools: card.pools.map((view) => ({
					poolKey: view.pool.poolKey,
					places: view.places.map((place) => place.feature?.name ?? null),
					choices: view.choices.map((choice) => choice.feature.name),
					lists: view.lists.map((list) => ({
						key: list.key,
						heading: list.heading,
						places: list.places.map((place) => place.feature?.name ?? null),
						choices: list.choices.map((choice) => choice.feature.name),
					})),
					countText: view.countText,
					holdingsText: view.holdingsText,
					hasEmptyPlace: view.hasEmptyPlace,
					showsChoices: view.showsChoices,
					choicesToggleLabel: view.choicesToggleLabel,
					status: view.status,
				})),
			})),
		}),
	);
</script>

<div data-testid="snapshot">{snapshot}</div>
