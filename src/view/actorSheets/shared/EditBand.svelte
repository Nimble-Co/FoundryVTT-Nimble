<!--
@component
The band at the top of the tab body in edit mode: what the mode does, and Done, which ends it.
It sticks to the top while the tab scrolls.
-->
<script lang="ts">
	import type { EditBandProps } from '#types/components/actorSheets/EditBand.d.ts';

	let { title, hint, done, ondone }: EditBandProps = $props();
</script>

<div class="band" role="status">
	<i class="fa-solid fa-pen"></i>
	<span>
		<b>{title}</b>
		{hint}
	</span>
	<button type="button" class="nimble-u-reset-button done" onclick={ondone}>{done}</button>
</div>

<style>
	.band {
		position: sticky;
		top: var(--edit-band-top, -10px);
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: var(--edit-band-margin, -10px -14px 12px);
		padding: 6px 10px 6px 14px;
		border-bottom: 1px solid var(--nimble-ui-own);
		background:
			linear-gradient(var(--nimble-ui-own-background), var(--nimble-ui-own-background)),
			var(--nimble-sheet-background);
		font-size: 0.893rem;
		line-height: 1.3;
	}
	.band > i {
		font-size: 0.786rem;
		color: var(--nimble-ui-own);
	}
	.band b {
		font-weight: 800;
		color: var(--nimble-ui-own);
	}
	.done {
		flex: none;
		margin-left: auto;
		height: 26px;
		padding: 0 12px;
		border-radius: 4px;
		background: var(--nimble-crimson);
		font-size: 0.857rem;
		font-weight: 700;
		color: var(--nimble-ui-fill-ink);
	}
	.done:hover {
		filter: brightness(1.15);
	}
</style>
