<script lang="ts">
	import type { MigrationPanesProps } from './MigrationPanes.types.ts';

	let { side, main }: MigrationPanesProps = $props();
</script>

<div class="nimble-world-migration__panes">
	<div class="nimble-world-migration__pane nimble-world-migration__pane--side">
		{@render side()}
	</div>
	<div class="nimble-world-migration__pane">
		{@render main()}
	</div>
</div>

<style lang="scss">
	.nimble-world-migration {
		&__panes {
			display: grid;
			flex: 1 1 auto;
			grid-template-columns: 15rem minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
			gap: 0.5rem;
			min-height: min(22rem, 45vh);
		}

		&__pane {
			display: flex;
			flex-direction: column;
			min-width: 0;
			min-height: 0;
			padding: 0.375rem 0.5rem;
			overflow-y: auto;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			&--side {
				overflow: hidden;
			}
		}
	}

	@container nimble-world-migration (width < 34rem) {
		.nimble-world-migration__panes {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.nimble-world-migration__pane--side {
			max-height: 12rem;
		}
	}
</style>
