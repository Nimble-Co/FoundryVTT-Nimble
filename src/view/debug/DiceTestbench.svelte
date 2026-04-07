<script lang="ts">
	import localize from '#utils/localize.js';
	import { hasWeaponProficiency } from '#view/sheets/components/attackUtils.js';
	import { stageAndRoll, type StagedValue } from '#view/debug/stageAndRoll.js';

	type RollModeSource = { label: string; mode: number };
	type ParsedDie = { termIndex: number; dieIndex: number; faces: number };
	type TermDump = { type: string; formula: string; results: unknown };
	type ResultDump = {
		trace: unknown;
		isCritical: boolean | undefined;
		isMiss: boolean | undefined;
		total: number | null | undefined;
		terms: TermDump[];
	};

	let selectedActorId = $state<string | null>(null);

	const actors = $derived.by(() => {
		const all = (game.actors?.contents ?? []) as Array<{ id: string; name: string; type: string }>;
		return all.filter((a) => a.type === 'character' || a.type === 'npc' || a.type === 'minion');
	});

	const selectedActor = $derived(actors.find((a) => a.id === selectedActorId) ?? null);

	// Roll Builder state
	let formula = $state('1d8');
	let isVicious = $state(false);
	let canCrit = $state(true);
	let canMiss = $state(true);
	let primaryDieAsDamage = $state(true);
	let templateShape = $state('');
	let weaponType = $state('');
	let rollModeSources = $state<RollModeSource[]>([]);
	let specificValues = $state<Array<number | null>>([]);
	let showSpecific = $state(false);

	const templateShapeOptions = [
		{ value: '', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.none' },
		{ value: 'circle', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.circle' },
		{ value: 'cone', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.cone' },
		{ value: 'emanation', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.emanation' },
		{ value: 'line', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.line' },
		{ value: 'square', labelKey: 'NIMBLE.diceTestbench.rollBuilder.templateShape.square' },
	];

	const effectiveCanCrit = $derived(templateShape !== '' ? false : canCrit);
	const effectiveCanMiss = $derived(templateShape !== '' ? false : canMiss);
	const flagsLocked = $derived(templateShape !== '');

	const netRollMode = $derived(rollModeSources.reduce((sum, s) => sum + (s.mode || 0), 0));

	const proficient = $derived.by(() => {
		if (weaponType === '') return null;
		return hasWeaponProficiency(
			selectedActor as unknown as Parameters<typeof hasWeaponProficiency>[0],
			{ system: { weaponType } },
		);
	});

	const isMinion = $derived(selectedActor?.type === 'minion');
	const critSuppressedForNonProf = $derived(proficient === false);

	// Parse formula for individual dice (for Force Specific Values)
	const parsedDice = $derived.by<ParsedDie[]>(() => {
		const result: ParsedDie[] = [];
		const re = /(\d+)?d(\d+)/g;
		let match: RegExpExecArray | null;
		let termIndex = 0;
		while ((match = re.exec(formula)) !== null) {
			const count = match[1] ? parseInt(match[1], 10) : 1;
			const faces = parseInt(match[2], 10);
			for (let i = 0; i < count; i += 1) {
				result.push({ termIndex, dieIndex: i, faces });
			}
			termIndex += 1;
		}
		return result;
	});

	// Keep specificValues array sized to parsedDice
	$effect(() => {
		if (specificValues.length !== parsedDice.length) {
			specificValues = parsedDice.map((_, i) => specificValues[i] ?? null);
		}
	});

	let lastResult = $state<ResultDump | null>(null);
	let lastError = $state<string | null>(null);

	function addRollModeSource() {
		rollModeSources = [
			...rollModeSources,
			{ label: localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.defaultLabel'), mode: 1 },
		];
	}

	function removeRollModeSource(index: number) {
		rollModeSources = rollModeSources.filter((_, i) => i !== index);
	}

	function getPrimaryFaces(): number | null {
		const first = parsedDice[0];
		return first ? first.faces : null;
	}

	async function performRoll(stagedValues: StagedValue[]) {
		lastError = null;
		try {
			const resolvedCanCrit =
				effectiveCanCrit && !isMinion && (proficient === null || proficient === true);
			const result = await stageAndRoll(
				formula,
				{
					isVicious,
					canCrit: resolvedCanCrit,
					canMiss: effectiveCanMiss,
					primaryDieAsDamage,
					rollMode: 0,
					rollModeSources: rollModeSources.map((s) => s.mode),
				},
				stagedValues,
			);
			lastResult = {
				trace: result.trace,
				isCritical: result.roll.isCritical,
				isMiss: result.roll.isMiss,
				total: result.roll.total,
				terms: result.roll.terms.map((t) => ({
					type: (t as { constructor: { name: string } }).constructor.name,
					formula: (t as { formula?: string }).formula ?? '',
					results: (t as { results?: unknown }).results,
				})),
			};
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			lastResult = null;
		}
	}

	async function onRoll() {
		await performRoll([]);
	}

	async function onForceCrit() {
		const faces = getPrimaryFaces();
		if (faces === null) {
			lastError = localize('NIMBLE.diceTestbench.rollBuilder.errors.noPrimaryDie');
			return;
		}
		await performRoll([{ value: faces, faces }]);
	}

	async function onForceMiss() {
		const faces = getPrimaryFaces();
		if (faces === null) {
			lastError = localize('NIMBLE.diceTestbench.rollBuilder.errors.noPrimaryDie');
			return;
		}
		await performRoll([{ value: 1, faces }]);
	}

	async function onRollWithSpecific() {
		const staged: StagedValue[] = [];
		for (let i = 0; i < parsedDice.length; i += 1) {
			const v = specificValues[i];
			if (v && v > 0) {
				staged.push({ value: v, faces: parsedDice[i].faces });
			} else {
				// Leave a hole — but stageAndRoll has no hole concept, so just stop staging
				// once we hit a blank (subsequent dice roll real). Use a sentinel: break.
				break;
			}
		}
		await performRoll(staged);
	}

	const resultJson = $derived(lastResult ? JSON.stringify(lastResult, null, 2) : '');
</script>

<div class="nimble-testbench">
	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.scenarios.title')}</h2>
		<p class="nimble-testbench__placeholder">
			{localize('NIMBLE.diceTestbench.scenarios.placeholder')}
		</p>
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.rollBuilder.title')}</h2>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.actorLabel')}</span>
			<select bind:value={selectedActorId}>
				<option value={null}>--</option>
				{#each actors as actor (actor.id)}
					<option value={actor.id}>{actor.name} ({actor.type})</option>
				{/each}
			</select>
		</label>
		{#if selectedActor}
			<p class="nimble-testbench__confirm">
				{localize('NIMBLE.diceTestbench.rollBuilder.selectedLabel')}: {selectedActor.name}
			</p>
		{/if}

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.formulaLabel')}</span>
			<input type="text" bind:value={formula} />
		</label>

		<div class="nimble-testbench__flags" class:is-locked={flagsLocked}>
			<label>
				<input type="checkbox" bind:checked={isVicious} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.isVicious')}
			</label>
			<label class:is-overridden={flagsLocked}>
				<input type="checkbox" bind:checked={canCrit} disabled={flagsLocked} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.canCrit')}
				{#if flagsLocked}
					<em>({localize('NIMBLE.diceTestbench.rollBuilder.flags.overriddenByAoe')})</em>
				{/if}
			</label>
			<label class:is-overridden={flagsLocked}>
				<input type="checkbox" bind:checked={canMiss} disabled={flagsLocked} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.canMiss')}
				{#if flagsLocked}
					<em>({localize('NIMBLE.diceTestbench.rollBuilder.flags.overriddenByAoe')})</em>
				{/if}
			</label>
			<label>
				<input type="checkbox" bind:checked={primaryDieAsDamage} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.primaryDieAsDamage')}
			</label>
		</div>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.templateShapeLabel')}</span>
			<select bind:value={templateShape}>
				{#each templateShapeOptions as opt (opt.value)}
					<option value={opt.value}>{localize(opt.labelKey)}</option>
				{/each}
			</select>
		</label>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.weaponTypeLabel')}</span>
			<input type="text" bind:value={weaponType} />
		</label>

		<p class="nimble-testbench__prof">
			{localize('NIMBLE.diceTestbench.rollBuilder.proficiencyLine', {
				weaponType: weaponType === '' ? '-' : weaponType,
				state:
					proficient === null
						? localize('NIMBLE.diceTestbench.rollBuilder.proficiency.na')
						: proficient
							? localize('NIMBLE.diceTestbench.rollBuilder.proficiency.yes')
							: localize('NIMBLE.diceTestbench.rollBuilder.proficiency.no'),
			})}
		</p>
		<p class="nimble-testbench__prof">
			{localize('NIMBLE.diceTestbench.rollBuilder.critSuppressedLine', {
				state: critSuppressedForNonProf
					? localize('NIMBLE.diceTestbench.rollBuilder.proficiency.yes')
					: localize('NIMBLE.diceTestbench.rollBuilder.proficiency.no'),
			})}
		</p>

		<div class="nimble-testbench__sources">
			<div class="nimble-testbench__sources-header">
				<span>{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.title')}</span>
				<button type="button" onclick={addRollModeSource}>
					{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.add')}
				</button>
			</div>
			{#each rollModeSources as src, i (i)}
				<div class="nimble-testbench__source-row">
					<input type="text" bind:value={src.label} />
					<input type="number" min="-10" max="10" bind:value={src.mode} />
					<button type="button" onclick={() => removeRollModeSource(i)}>
						{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.remove')}
					</button>
				</div>
			{/each}
			<p class="nimble-testbench__net">
				{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.net', {
					sum: String(netRollMode),
				})}
			</p>
		</div>

		<div class="nimble-testbench__actions">
			<button type="button" onclick={onRoll}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.roll')}
			</button>
			<button type="button" onclick={onForceCrit}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceCrit')}
			</button>
			<button type="button" onclick={onForceMiss}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceMiss')}
			</button>
			<button type="button" onclick={() => (showSpecific = !showSpecific)}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceSpecific')}
			</button>
		</div>

		{#if showSpecific}
			<div class="nimble-testbench__specific">
				<p>{localize('NIMBLE.diceTestbench.rollBuilder.specific.hint')}</p>
				{#each parsedDice as die, i (i)}
					<label class="nimble-testbench__specific-row">
						<span>d{die.faces} #{i + 1}</span>
						<input
							type="number"
							min="1"
							max={die.faces}
							bind:value={specificValues[i]}
							placeholder="1-{die.faces}"
						/>
					</label>
				{/each}
				<button type="button" onclick={onRollWithSpecific}>
					{localize('NIMBLE.diceTestbench.rollBuilder.specific.rollWith')}
				</button>
			</div>
		{/if}
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.results.title')}</h2>
		{#if lastError}
			<pre class="nimble-testbench__error">{lastError}</pre>
		{/if}
		{#if lastResult}
			<pre class="nimble-testbench__dump">{resultJson}</pre>
		{:else if !lastError}
			<p class="nimble-testbench__placeholder">
				{localize('NIMBLE.diceTestbench.results.placeholder')}
			</p>
		{/if}
	</section>
</div>

<style>
	.nimble-testbench {
		display: flex;
		flex-direction: row;
		gap: 0.75rem;
		height: 100%;
		padding: 0.5rem;
		background: #1a1a1a;
		color: #e0e0e0;
		font-family: sans-serif;
	}
	.nimble-testbench__col {
		flex: 1 1 0;
		min-width: 0;
		border: 1px solid #444;
		padding: 0.5rem;
		background: #222;
		overflow: auto;
	}
	.nimble-testbench__col h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		border-bottom: 1px solid #555;
		padding-bottom: 0.25rem;
	}
	.nimble-testbench__placeholder {
		color: #888;
		font-style: italic;
		font-size: 0.85rem;
	}
	.nimble-testbench__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.nimble-testbench__field span {
		font-size: 0.8rem;
		color: #bbb;
	}
	.nimble-testbench__field select,
	.nimble-testbench__field input {
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.25rem;
	}
	.nimble-testbench__confirm {
		font-size: 0.85rem;
		color: #9f9;
		margin: 0.25rem 0;
	}
	.nimble-testbench__flags {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.5rem 0;
		font-size: 0.8rem;
	}
	.nimble-testbench__flags label.is-overridden {
		opacity: 0.6;
	}
	.nimble-testbench__flags em {
		color: #f99;
		font-size: 0.75rem;
	}
	.nimble-testbench__prof {
		font-size: 0.8rem;
		color: #bbb;
		margin: 0.2rem 0;
	}
	.nimble-testbench__sources {
		border: 1px solid #444;
		padding: 0.3rem;
		margin: 0.5rem 0;
	}
	.nimble-testbench__sources-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		margin-bottom: 0.3rem;
	}
	.nimble-testbench__source-row {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.2rem;
	}
	.nimble-testbench__source-row input[type='text'] {
		flex: 1 1 auto;
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.15rem;
	}
	.nimble-testbench__source-row input[type='number'] {
		width: 3.5rem;
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.15rem;
	}
	.nimble-testbench__net {
		font-size: 0.8rem;
		color: #9cf;
		margin: 0.25rem 0 0 0;
	}
	.nimble-testbench__actions {
		display: flex;
		flex-direction: row;
		gap: 0.25rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.nimble-testbench__actions button {
		flex: 1 1 auto;
		background: #333;
		color: #e0e0e0;
		border: 1px solid #666;
		padding: 0.3rem;
		cursor: pointer;
	}
	.nimble-testbench__specific {
		margin-top: 0.5rem;
		border: 1px solid #444;
		padding: 0.3rem;
		font-size: 0.8rem;
	}
	.nimble-testbench__specific-row {
		display: flex;
		gap: 0.25rem;
		align-items: center;
		margin-bottom: 0.2rem;
	}
	.nimble-testbench__specific-row input {
		width: 4rem;
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.15rem;
	}
	.nimble-testbench__dump {
		font-family: monospace;
		font-size: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
		background: #111;
		padding: 0.4rem;
		border: 1px solid #444;
		color: #cfc;
	}
	.nimble-testbench__error {
		font-family: monospace;
		font-size: 0.75rem;
		white-space: pre-wrap;
		background: #311;
		color: #f99;
		padding: 0.4rem;
		border: 1px solid #844;
	}
</style>
