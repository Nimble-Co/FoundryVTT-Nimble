<!--
@component
The band at the top of the tab body in edit mode: what the mode does, and Done, which ends it.
It sticks to the top while the tab scrolls. It fills the padding of the tab body: 10 by 14 px, or 8 by 12 px with `tight`.
-->
<script lang="ts">
	import type { EditBandProps } from '#types/components/actorSheets/EditBand.d.ts';

	let { title, hint, done, ondone, tight = false }: EditBandProps = $props();
</script>

<div class="band" class:tight role="status">
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
		top: -10px;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: -10px -14px 12px;
		padding: 6px 10px 6px 14px;
		border-bottom: 1px solid var(--nimble-ui-own);
		background:
			linear-gradient(var(--nimble-ui-own-background), var(--nimble-ui-own-background)),
			var(--nimble-sheet-background);
		font-size: 0.781rem;
		line-height: 1.3;
	}
	.tight {
		top: -8px;
		margin: -8px -12px 10px;
	}
	.band > i {
		font-size: 0.688rem;
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
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--nimble-ui-fill-ink);
	}
	.done:hover {
		filter: brightness(1.15);
	}
</style>
