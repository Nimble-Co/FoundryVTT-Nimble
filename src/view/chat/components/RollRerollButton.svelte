<script lang="ts">
	import type { RollRerollButtonProps } from '#types/components/RollRerollButton.d.ts';

	import ChoiceMenu from './ChoiceMenu.svelte';
	import { createRollRerollButtonState } from './RollRerollButton.svelte.ts';

	let { sections, disabled = false, onChoose }: RollRerollButtonProps = $props();

	const menuId = $props.id();

	const rerollButton = createRollRerollButtonState(() => ({ sections, onChoose }));
	const { elements, onTriggerClick, choose, closeMenu } = rerollButton;
	let single = $derived(rerollButton.single);
	let menuOpen = $derived(rerollButton.menuOpen);
	let triggerLabel = $derived(rerollButton.triggerLabel);
	let icon = $derived(rerollButton.changesOnly ? 'fa-pen' : 'fa-rotate-left');

	export function focus() {
		elements.trigger?.focus();
	}
</script>

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
	<i class="fa-solid {icon}" aria-hidden="true"></i>
</button>

{#if menuOpen}
	<ChoiceMenu
		id={menuId}
		class="nimble-roll-reroll-menu"
		label={triggerLabel}
		{sections}
		{disabled}
		trigger={elements.trigger}
		onchoose={choose}
		onclose={closeMenu}
	/>
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
			outline: 2px solid var(--nimble-dark-text-color);
			outline-offset: 1px;
		}

		&:disabled {
			cursor: default;
			opacity: 0.6;
		}
	}

	:global(.nimble-choice-menu.nimble-roll-reroll-menu) {
		grid-column: 1 / -1;
		margin-top: 0.375rem;
	}
</style>
