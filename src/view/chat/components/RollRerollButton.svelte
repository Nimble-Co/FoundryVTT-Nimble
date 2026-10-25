<script lang="ts">
	import type { RollRerollButtonProps } from '#types/components/RollRerollButton.d.ts';

	import { createRollRerollButtonState } from './RollRerollButton.svelte.ts';

	let { choices, disabled = false, onChoose }: RollRerollButtonProps = $props();

	const menuId = $props.id();

	const rerollButton = createRollRerollButtonState(() => ({ choices, onChoose }));
	const { elements, choiceText, onTriggerClick, choose, onMenuKeydown, onWindowPointerDown } =
		rerollButton;
	let single = $derived(rerollButton.single);
	let menuOpen = $derived(rerollButton.menuOpen);
	let triggerLabel = $derived(rerollButton.triggerLabel);
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<button
	bind:this={elements.trigger}
	class="nimble-roll-reroll"
	type="button"
	{disabled}
	aria-label={triggerLabel}
	aria-haspopup={single ? undefined : 'menu'}
	aria-expanded={single ? undefined : menuOpen}
	aria-controls={menuOpen ? menuId : undefined}
	data-tooltip={triggerLabel}
	onclick={onTriggerClick}
>
	<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
</button>

{#if menuOpen}
	<ul
		bind:this={elements.menu}
		id={menuId}
		class="nimble-roll-reroll-menu"
		role="menu"
		aria-label={triggerLabel}
		tabindex="-1"
		onkeydown={onMenuKeydown}
	>
		{#each choices as choice, index (choice.id)}
			<li role="none">
				<button
					bind:this={elements.items[index]}
					class="nimble-button nimble-roll-reroll-menu__item"
					type="button"
					role="menuitem"
					tabindex="-1"
					aria-label={choiceText(choice)}
					{disabled}
					onclick={() => choose(choice.id)}
				>
					<span class="nimble-roll-reroll-menu__label">{choice.label}</span>
					{#if choice.cost}
						<span class="nimble-roll-reroll-menu__cost">{choice.cost}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
	.nimble-roll-reroll {
		grid-area: rollAction;
		align-self: center;
		display: grid;
		place-items: center;
		width: 1.625rem;
		height: 1.625rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		line-height: 1;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-basic-button-background-color);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
		cursor: pointer;

		&:hover:not(:disabled) {
			color: var(--nimble-dark-text-hover-color);
			filter: brightness(1.1);
		}

		&:focus-visible {
			outline: 2px solid var(--nimble-input-border-color);
			outline-offset: 1px;
		}

		&:disabled {
			cursor: default;
			opacity: 0.6;
		}
	}

	.nimble-roll-reroll-menu {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.375rem 0 0;
		padding: 0;
		list-style: none;
		// Clears the chat log's bottom fade and its jump-to-bottom button.
		scroll-margin-block-end: 3rem;

		&__item {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			width: 100%;
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-sm-text);
			text-align: left;

			&:focus-visible {
				outline: 2px solid var(--nimble-input-border-color);
				outline-offset: -2px;
			}
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__cost {
			flex: none;
			margin-left: auto;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}
	}
</style>
