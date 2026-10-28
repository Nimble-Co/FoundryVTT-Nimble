<!--
@component
Asks once before something that you cannot take back (Delete, end an effect), in the place where you clicked.
It is a bar, not a second window. Foundry has no undo, so the question comes before the act.
-->
<script lang="ts">
	import localize from '#utils/localize.js';

	interface Props {
		question: string;
		/** default "Delete" */
		confirmLabel?: string;
		/** default "Keep" */
		cancelLabel?: string;
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let { question, confirmLabel, cancelLabel, onconfirm, oncancel }: Props = $props();
</script>

<div class="ask" role="alertdialog" aria-label={question}>
	<span class="q">{question}</span>
	<button type="button" class="nimble-u-reset-button yes" onclick={onconfirm}>
		{confirmLabel ?? localize('NIMBLE.actorSheet.parts.confirmBar.confirm')}
	</button>
	<button type="button" class="nimble-u-reset-button no" onclick={oncancel}>
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
		font-size: 0.893rem;
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
		font-size: 0.857rem;
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
