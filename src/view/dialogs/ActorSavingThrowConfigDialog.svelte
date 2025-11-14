<script>
	function formatRollModeLabel(value) {
		if (value > 0) return `Adv × ${value}`;
		if (value < 0) return `Dis × ${Math.abs(value)}`;

		return '-';
	}

	function toggleSavingThrowRollMode(savingThrow, rollMode) {
		return document.update({
			[`system.savingThrows.${savingThrow}.defaultRollMode`]: rollMode,
		});
	}

	const { savingThrows } = CONFIG.NIMBLE;

	let { document } = $props();
</script>

<section class="nimble-sheet__body nimble-sheet__body--ability-score-config">
	<table
		class="nimble-ability-score-config-table"
		style="--nimble-table-column-width: calc((100% - 4rem) / 7)px"
	>
		<thead>
			<tr>
				<th></th>

				{#each [-3, -2, -1, 0, 1, 2, 3] as rollMode}
					<th
						class="nimble-heading nimble-ability-score-config-header"
						data-heading-variant="section"
						scope="col"
					>
						{formatRollModeLabel(rollMode)}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody>
			{#each Object.entries(savingThrows) as [key, savingThrowLabel]}
				{@const currenSavingThrowRollMode =
					document.reactive.system.savingThrows[key]?.defaultRollMode ?? 0}

				<tr>
					<th
						class="nimble-heading nimble-ability-score-config-header"
						data-heading-variant="section"
						scope="row"
					>
						{savingThrowLabel}
					</th>

					{#each [-3, -2, -1, 0, 1, 2, 3] as rollMode}
						<td>
							<button
								class="nimble-ability-score-config-button"
								class:nimble-ability-score-config-button--active={rollMode ===
									currenSavingThrowRollMode}
								aria-label="Toggle Saving Throw Roll Mode"
								data-tooltip="Toggle Saving Throw Roll Mode"
								onclick={() => toggleSavingThrowRollMode(key, rollMode)}
							>
							</button>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style lang="scss">
	.nimble-ability-score-config-table {
		table-layout: fixed;
		empty-cells: show;
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		box-shadow: var(--nimble-box-shadow);

		td,
		th {
			text-align: center;
			vertical-align: middle;
			padding: 0;
		}

		th:first-of-type {
			width: 6rem;
		}

		tr {
			height: 2.25rem;
		}
	}

	.nimble-heading.nimble-ability-score-config-header {
		display: table-cell;
		height: 100%;
	}

	.nimble-ability-score-config-button {
		height: 2rem;
		width: 2rem;
		margin: 0 auto;
		padding: 0;
		font-size: var(--nimble-md-text);
		color: var(--nimble-medium-text-color);
		background: transparent;
		border: 0;
		transition: var(--nimble-standard-transition);

		&:active,
		&:focus,
		&:hover {
			color: var(--nimble-dark-text-color);
			background: transparent;
			border: 0;
			box-shadow: none;
			outline: none;
		}

		&:hover {
			transform: scale(1.2);
		}

		&::before {
			content: '\f111';
			font: var(--fa-font-regular);
		}

		&--active {
			color: var(--nimble-dark-text-color);

			&::before {
				content: '\f192';
			}
		}
	}
</style>
