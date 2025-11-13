<script>
	let { document } = $props();

	const { movementTypes } = CONFIG.NIMBLE;
</script>

<section class="nimble-sheet__body nimble-sheet__body--movement-config">
	<table class="nimble-movement-config-table">
		<thead>
			<tr>
				{#each Object.keys(document.reactive?.system?.attributes?.movement) as key}
					{@const movementType = movementTypes[key] ?? key}

					<th>{movementType}</th>
				{/each}
			</tr>
		</thead>

		<tbody>
			<tr>
				{#each Object.entries(document.reactive?.system?.attributes?.movement) as [key, distance]}
					<td>
						<input
							class="nimble-movement-config__field"
							type="number"
							value={distance}
							onchange={({ target }) =>
								document.update({
									[`system.attributes.movement.${key}`]: target.value,
								})}
						/>
					</td>
				{/each}
			</tr>
		</tbody>
	</table>

	<aside>Note: All measurements are given in grid spaces.</aside>
</section>

<style lang="scss">
	.nimble-movement-config-table {
		text-align: center;
		vertical-align: middle;

		thead {
			text-align: center;
		}

		td {
			font-size: var(--nimble-md-text);
		}
	}

	aside {
		font-size: var(--nimble-sm-text);
		font-weight: 500;
	}
</style>
