<!--
@component
Asks once before something that you cannot take back (Delete, end an effect), in the place where you clicked.
It is a bar, not a second window. Foundry has no undo, so the question comes before the act.
-->
<script lang="ts">
	import type { ConfirmBarProps } from '#types/components/actorSheets/ConfirmBar.d.ts';
	import { onMount } from 'svelte';
	import localize from '#utils/localize.js';

	let { question, confirmLabel, cancelLabel, onconfirm, oncancel }: ConfirmBarProps = $props();

	let cancelButton: HTMLButtonElement | undefined;

	// Focus goes to the safe answer when the bar opens, and back to the trigger when it closes.
	onMount(() => {
		const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		cancelButton?.focus();
		return () => {
			if (trigger?.isConnected) trigger.focus();
		};
	});
</script>

<div class="ask" role="alertdialog" aria-label={question}>
	<span class="q">{question}</span>
	<button type="button" class="nimble-u-reset-button yes" onclick={onconfirm}>
		{confirmLabel ?? localize('NIMBLE.actorSheet.parts.confirmBar.confirm')}
	</button>
	<button
		type="button"
		class="nimble-u-reset-button no"
		bind:this={cancelButton}
		onclick={oncancel}
	>
		{cancelLabel ?? localize('NIMBLE.actorSheet.parts.confirmBar.cancel')}
	</button>
</div>

<style>
	.ask {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 8px;
		padding: 7px 8px;
		border: 1px solid var(--nimble-ui-own);
		border-radius: 4px;
		background: var(--nimble-ui-own-background);
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink);
	}
	.q {
		flex: 1 1 100%;
	}
	button {
		height: 26px;
		padding: 0 10px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.yes {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.yes:hover {
		filter: brightness(1.15);
	}
	.no {
		border: 1px solid var(--nimble-ui-ring);
		color: var(--nimble-ui-ink);
	}
	.no:hover {
		border-color: var(--nimble-ui-highlight);
	}
</style>
