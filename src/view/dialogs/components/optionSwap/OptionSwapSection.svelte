<script lang="ts">
	import { tick } from 'svelte';

	import type { NimbleFeatureItem } from '#documents/item/feature.ts';
	import type { FeaturePeekProps } from '#types/components/FeaturePeek.d.ts';
	import type { OptionSwapSectionProps } from '#types/components/OptionSwapSection.d.ts';
	import type {
		OptionSwapCardView,
		OptionSwapChoice,
		OptionSwapPlace,
		OptionSwapPoolView,
	} from '#types/optionSwap.d.ts';

	import Hint from '#view/components/Hint.svelte';
	import localize from '#utils/localize.ts';
	import FeaturePeek from './FeaturePeek.svelte';
	import SkillMoveLine from './SkillMoveLine.svelte';
	import { createOptionSwapSectionState } from './OptionSwapSection.state.svelte.ts';

	let { document: actor, offer, onChange, onPending, onToggle }: OptionSwapSectionProps = $props();

	/** How long the pointer rests on a chip before its card opens. */
	const PEEK_DELAY = 200;

	const section = createOptionSwapSectionState(() => ({
		offer,
		skills: actor.reactive.system.skills,
		onChange,
	}));

	let peek = $state<FeaturePeekProps | null>(null);
	let peekTimer: ReturnType<typeof setTimeout> | null = null;

	/** The control standing in each place, so focus can stay there when a pick is given up. */
	let placeControls = $state<Record<string, HTMLButtonElement | undefined>>({});

	$effect(() => {
		onPending?.(section.isPending);
	});

	const placeKey = (view: OptionSwapPoolView, index: number) => `${view.pool.poolKey}:${index}`;

	function toggle() {
		section.toggleExpanded();
		onToggle?.(section.isExpanded);
	}

	/** Folding a pool changes the section height too, so the host is told to refit. */
	function toggleChoices(poolKey: string) {
		section.toggleChoices(poolKey);
		onToggle?.(section.isExpanded);
	}

	async function giveUp(view: OptionSwapPoolView, index: number) {
		hidePeek();
		section.giveUpPlace(view.pool.poolKey, index);
		// Giving a pick up unfolds the choices, so the section is taller than before.
		onToggle?.(section.isExpanded);

		await tick();
		placeControls[placeKey(view, index)]?.focus();
	}

	function fill(view: OptionSwapPoolView, feature: NimbleFeatureItem) {
		hidePeek();
		section.fillPlace(view.pool.poolKey, feature);
	}

	function fillFromChoices(view: OptionSwapPoolView) {
		if (view.showsChoices) return;
		toggleChoices(view.pool.poolKey);
	}

	function showPeek(feature: NimbleFeatureItem, anchor: HTMLElement, note = '') {
		if (peekTimer) clearTimeout(peekTimer);
		peekTimer = setTimeout(() => {
			peek = { feature, anchor, note };
		}, PEEK_DELAY);
	}

	function hidePeek() {
		if (peekTimer) clearTimeout(peekTimer);
		peekTimer = null;
		peek = null;
	}

	function peekCard(card: OptionSwapCardView, anchor: HTMLElement) {
		const item = card.itemId ? actor.items.get(card.itemId) : null;
		if (item?.type === 'feature') showPeek(item as NimbleFeatureItem, anchor);
	}

	const repeatableNote = (isRepeatable: boolean) =>
		isRepeatable ? localize('NIMBLE.optionSwap.peekRepeatable') : '';
</script>

{#snippet placeChips(view: OptionSwapPoolView, places: OptionSwapPlace[])}
	<ul class="nimble-option-swap__chips">
		{#each places as place (place.index)}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<li
				class="nimble-option-swap__chip"
				class:nimble-option-swap__chip--held={place.feature}
				class:nimble-option-swap__chip--empty={!place.feature}
				onmouseenter={(event) =>
					place.feature &&
					showPeek(place.feature, event.currentTarget, repeatableNote(place.isRepeatable))}
				onmouseleave={hidePeek}
				onfocusin={(event) =>
					place.feature &&
					showPeek(place.feature, event.currentTarget, repeatableNote(place.isRepeatable))}
				onfocusout={hidePeek}
			>
				{#if place.feature}
					<img class="nimble-option-swap__chip-img" src={place.feature.img} alt="" />
					<span class="nimble-option-swap__chip-name">{place.feature.name}</span>
					<button
						class="nimble-option-swap__check nimble-option-swap__check--on"
						type="button"
						aria-label={localize('NIMBLE.optionSwap.giveUpPick', {
							featureName: place.feature.name ?? '',
						})}
						bind:this={placeControls[placeKey(view, place.index)]}
						onclick={() => giveUp(view, place.index)}
					>
						<i class="fa-solid fa-check"></i>
					</button>
				{:else}
					<button
						class="nimble-option-swap__empty"
						type="button"
						bind:this={placeControls[placeKey(view, place.index)]}
						onclick={() => fillFromChoices(view)}
					>
						<i class="fa-regular fa-circle"></i>
						{localize('NIMBLE.optionSwap.emptyPlace')}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet choiceChips(view: OptionSwapPoolView, choices: OptionSwapChoice[])}
	<ul class="nimble-option-swap__chips">
		{#each choices as choice (choice.feature.uuid)}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<li
				class="nimble-option-swap__chip"
				class:nimble-option-swap__chip--blocked={!view.hasEmptyPlace}
				onmouseenter={(event) =>
					showPeek(choice.feature, event.currentTarget, repeatableNote(choice.isRepeatable))}
				onmouseleave={hidePeek}
				onfocusin={(event) =>
					showPeek(choice.feature, event.currentTarget, repeatableNote(choice.isRepeatable))}
				onfocusout={hidePeek}
			>
				<img class="nimble-option-swap__chip-img" src={choice.feature.img} alt="" />
				<span class="nimble-option-swap__chip-name">{choice.feature.name}</span>
				<button
					class="nimble-option-swap__check"
					type="button"
					disabled={!view.hasEmptyPlace}
					aria-label={localize('NIMBLE.optionSwap.choosePick', {
						featureName: choice.feature.name ?? '',
					})}
					onclick={() => fill(view, choice.feature)}
				></button>
			</li>
		{/each}
	</ul>
{/snippet}

{#if section.hasOffer}
	<section class="nimble-option-swap">
		<button
			class="nimble-option-swap__toggle"
			type="button"
			aria-expanded={section.isExpanded}
			onclick={toggle}
		>
			<span class="nimble-option-swap__icon">
				<i class="fa-solid fa-arrow-right-arrow-left"></i>
			</span>
			<span class="nimble-option-swap__toggle-text">
				<span class="nimble-option-swap__toggle-label">
					{localize('NIMBLE.optionSwap.toggleLabel')}
				</span>
				<span class="nimble-option-swap__toggle-hint">
					{localize('NIMBLE.optionSwap.toggleHint')}
				</span>
			</span>
			<i
				class="nimble-option-swap__chevron fa-solid fa-chevron-down"
				class:nimble-option-swap__chevron--expanded={section.isExpanded}
			></i>
		</button>

		{#if section.isExpanded}
			<div class="nimble-option-swap__body">
				{#each section.cards as card (card.key)}
					<article
						class="nimble-option-swap__card"
						class:nimble-option-swap__card--given-up={card.isGivenUp}
					>
						<header class="nimble-option-swap__card-header">
							<img
								class="nimble-option-swap__card-img"
								src={card.img}
								alt=""
								onmouseenter={(event) => peekCard(card, event.currentTarget)}
								onmouseleave={hidePeek}
							/>
							<span class="nimble-option-swap__card-title">
								<strong>{card.name}</strong>
								<small>{card.subtitle}</small>
							</span>
						</header>

						{#each card.pools as view (view.pool.poolKey)}
							<section class="nimble-option-swap__pool" data-pool-key={view.pool.poolKey}>
								<header class="nimble-option-swap__pool-header">
									<h4 class="nimble-heading" data-heading-variant="section">
										{view.pool.displayName}
									</h4>
									<span
										class="nimble-option-swap__count"
										class:nimble-option-swap__count--over={view.isOverGrant}
										class:nimble-option-swap__count--short={view.isUnderGrant}
										data-tooltip={localize('NIMBLE.optionSwap.countTooltip')}
									>
										{view.countText}
									</span>
								</header>

								{#if view.holdingsText}
									<small class="nimble-option-swap__note">{view.holdingsText}</small>
								{/if}

								{#if view.lists.length > 1}
									{#each view.lists as list (list.key)}
										{#if list.places.length > 0}
											<div class="nimble-option-swap__list">
												<h5 class="nimble-option-swap__list-title">{list.heading}</h5>
												{@render placeChips(view, list.places)}
											</div>
										{/if}
									{/each}
								{:else}
									{@render placeChips(view, view.places)}
								{/if}

								{#if view.choices.length > 0}
									<button
										class="nimble-option-swap__unfold"
										type="button"
										aria-expanded={view.showsChoices}
										onclick={() => toggleChoices(view.pool.poolKey)}
									>
										<i
											class="nimble-option-swap__chevron fa-solid fa-chevron-down"
											class:nimble-option-swap__chevron--expanded={view.showsChoices}
										></i>
										{view.choicesToggleLabel}
									</button>

									{#if view.showsChoices}
										{#if !view.hasEmptyPlace}
											<small class="nimble-option-swap__note">
												{localize('NIMBLE.optionSwap.needEmptyPlace')}
											</small>
										{/if}

										{#if view.lists.length > 1}
											{#each view.lists as list (list.key)}
												{#if list.choices.length > 0}
													<div class="nimble-option-swap__list">
														<h5 class="nimble-option-swap__list-title">{list.heading}</h5>
														{@render choiceChips(view, list.choices)}
													</div>
												{/if}
											{/each}
										{:else}
											{@render choiceChips(view, view.choices)}
										{/if}
									{/if}
								{/if}

								{#if view.status.changed}
									<Hint
										hintText={view.status.text}
										hintIcon={view.status.isReady
											? 'fa-solid fa-circle-check'
											: 'fa-solid fa-circle-exclamation'}
										hintType={view.status.isReady ? 'success' : 'warning'}
									/>
								{/if}
							</section>
						{/each}

						{#if card.isGivenUp}
							<Hint
								hintText={card.givenUpText}
								hintIcon="fa-solid fa-circle-exclamation"
								hintType="warning"
							/>
						{:else if card.offersSkillMove}
							<SkillMoveLine {section} />
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

{#if peek}
	<FeaturePeek feature={peek.feature} anchor={peek.anchor} note={peek.note} />
{/if}

<style lang="scss">
	.nimble-option-swap {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		// Matches the recovery cards above it. Foundry's button reset is undone here: its fixed
		// height would clip the two lines of text and its hover colours would not fit the cards.
		&__toggle {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
			height: auto;
			min-height: 0;
			padding: 0.625rem 0.875rem;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			text-align: left;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
			box-shadow: none;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover,
			&:focus-visible {
				color: var(--nimble-dark-text-color);
				background: var(--nimble-box-background-color);
				border-color: var(--nimble-accent-color);
				box-shadow: none;
			}
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			width: 2rem;
			height: 2rem;
			border-radius: 6px;
			font-size: 0.875rem;
			background: hsla(200, 60%, 50%, 0.15);
			color: hsl(200, 60%, 40%);
		}

		&__toggle-text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__toggle-label {
			font-weight: 600;
		}

		&__toggle-hint {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__chevron {
			flex-shrink: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			transition: transform 0.2s ease;

			&--expanded {
				transform: rotate(180deg);
			}
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0.25rem 0 0;
		}

		&__card {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
			padding: 0.625rem 0.75rem 0.75rem;
			border: 1px solid var(--nimble-card-border-color);
			border-left: 3px solid var(--nimble-accent-color);
			border-radius: 6px;

			&--given-up {
				border-left-color: var(--nimble-card-border-color);

				.nimble-option-swap__card-header {
					opacity: 0.55;
				}
			}
		}

		&__card-header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__card-img {
			flex-shrink: 0;
			width: 2rem;
			height: 2rem;
			border: none;
			border-radius: 6px;
			object-fit: cover;
			cursor: help;
		}

		&__card-title {
			display: flex;
			flex-direction: column;
			min-width: 0;

			small {
				font-size: var(--nimble-xs-text);
				color: var(--nimble-medium-text-color);
			}
		}

		&__pool {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__pool-header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__count {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);

			&--short {
				color: var(--nimble-warning-icon-color);
			}

			&--over {
				color: var(--nimble-validation-error-color);
			}
		}

		&__note {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		// One option list inside a pool, shown only while the pool draws on more than one.
		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__list-title {
			margin: 0.25rem 0 0;
			padding: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			line-height: 1.2;
			letter-spacing: 0.03em;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);
			border: 0;
		}

		&__chips {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.375rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__chip {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			min-height: 2rem;
			padding: 0.125rem 0.375rem;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 999px;
			background: var(--nimble-box-background-color);
			font-size: var(--nimble-sm-text);

			&--held {
				border-color: var(--nimble-accent-color);
			}

			&--blocked {
				opacity: 0.45;
			}

			&--empty {
				padding: 0;
				border-style: dashed;
				background: none;
			}
		}

		&__chip-img {
			flex-shrink: 0;
			width: 1.5rem;
			height: 1.5rem;
			border: none;
			border-radius: 50%;
			object-fit: cover;
		}

		&__chip-name {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		&__empty {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			width: 100%;
			height: auto;
			min-height: 2rem;
			padding: 0.125rem 0.625rem;
			border: none;
			background: none;
			box-shadow: none;
			color: var(--nimble-medium-text-color);
			font-size: var(--nimble-sm-text);
			font-style: italic;
			text-align: left;
			cursor: pointer;
		}

		&__check {
			flex: 0 0 1.125rem;
			box-sizing: border-box;
			width: 1.125rem;
			min-width: 1.125rem;
			height: 1.125rem;
			min-height: 1.125rem;
			padding: 0;
			border: 2px solid var(--nimble-medium-text-color);
			border-radius: 50%;
			background: none;
			box-shadow: none;
			color: transparent;
			font-size: 0.625rem;
			line-height: 1;
			cursor: pointer;

			&--on {
				border-color: var(--nimble-accent-color);
				background: var(--nimble-accent-color);
				color: var(--nimble-light-text-color);
			}

			&[disabled] {
				cursor: not-allowed;
			}
		}

		&__unfold {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 0.5rem;
			width: 100%;
			height: auto;
			min-height: 0;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: 1px dashed var(--nimble-card-border-color);
			border-radius: 4px;
			box-shadow: none;
			cursor: pointer;

			&:hover,
			&:focus-visible {
				color: var(--nimble-dark-text-color);
				background: transparent;
				border-color: var(--nimble-accent-color);
				box-shadow: none;
			}
		}
	}

	// The recovery cards above hard-code these dark colours, and the row is one of them.
	:global(.theme-dark) {
		.nimble-option-swap__toggle {
			background: hsl(220, 15%, 18%);
			border-color: hsl(220, 10%, 30%);
		}

		.nimble-option-swap__toggle:hover,
		.nimble-option-swap__toggle:focus-visible {
			background: hsl(220, 15%, 18%);
			border-color: var(--nimble-accent-color);
		}

		.nimble-option-swap__icon {
			background: hsla(200, 60%, 50%, 0.2);
			color: hsl(200, 60%, 60%);
		}

		.nimble-option-swap__chip {
			background: hsl(220, 15%, 18%);
			border-color: hsl(220, 10%, 30%);
		}

		.nimble-option-swap__chip--held {
			border-color: var(--nimble-accent-color);
		}
	}
</style>
