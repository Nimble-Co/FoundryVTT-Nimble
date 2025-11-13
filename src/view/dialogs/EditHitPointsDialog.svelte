<script>
	const startingHpByHitDie = {
		6: 10,
		8: 13,
		10: 17,
		12: 20,
	};

	function submit() {
		const updates = {
			classUpdates: classHpData.map((cls) => ({
				id: cls.id,
				hpData: cls.hpData,
			})),
			bonus: hpBonus,
		};
		dialog.submit(updates);
	}

	let { document, dialog } = $props();

	let classHpData = $state([]);
	let hpBonus = $state(document.system.attributes.hp.bonus || 0);

	$effect(() => {
		classHpData = Object.values(document.classes ?? {}).map((cls) => ({
			id: cls.id,
			name: cls.name,
			hitDie: cls.system.hitDieSize,
			startingHp: startingHpByHitDie[cls.system.hitDieSize] || 0,
			hpData: [...cls.system.hpData],
			maxHp: cls.maxHp,
		}));
	});

	function updateHpData(classIndex, levelIndex, value) {
		classHpData[classIndex].hpData[levelIndex] = Number.parseInt(value) || 0;
		// Recalculate maxHp for that class
		const cls = classHpData[classIndex];
		cls.maxHp = cls.startingHp + cls.hpData.reduce((acc, val) => acc + val, 0);
		classHpData = [...classHpData]; // Trigger reactivity
	}

	let totalMaxHp = $derived.by(() => {
		const classTotal = classHpData.reduce((acc, cls) => acc + cls.maxHp, 0);
		return classTotal + hpBonus;
	});
</script>

<section class="nimble-sheet__body">
	<h3>Edit Hit Points</h3>

	{#each classHpData as cls, classIndex}
		<div class="class-section">
			<h4>{cls.name} (d{cls.hitDie})</h4>
			<p>Starting HP: {cls.startingHp}</p>
			<div class="levels">
				{#each cls.hpData as hp, levelIndex}
					<label>
						Level {levelIndex + 2} HP Gain:
						<input
							type="number"
							value={hp}
							oninput={(e) => updateHpData(classIndex, levelIndex, e.target.value)}
						/>
					</label>
				{/each}
			</div>
			<p>Class Max HP: {cls.maxHp}</p>
		</div>
	{/each}

	<div class="bonus-section">
		<label>
			Static HP Bonus:
			<input type="number" bind:value={hpBonus} />
		</label>
	</div>

	<div class="total">
		<strong>Total Max HP: {totalMaxHp}</strong>
	</div>
</section>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}> Submit </button>
</footer>

<style lang="scss">
	.class-section {
		border: 1px solid #ccc;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.levels {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	input {
		width: 4rem;
	}

	.bonus-section {
		margin-top: 1rem;
	}

	.total {
		margin-top: 1rem;
		font-size: 1.2em;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}
</style>
