<script lang="ts">
	import localize from '#utils/localize.js';
	import { hasWeaponProficiency } from '#view/sheets/components/attackUtils.js';
	import { scenarios, type Scenario } from '#view/debug/scenarios.js';
	import { stageAndRoll, type StagedValue } from '#view/debug/stageAndRoll.js';

	type ParsedDie = { termIndex: number; dieIndex: number; faces: number };
	type DieResultDump = {
		result: number;
		active: boolean;
		discarded: boolean;
		exploded: boolean;
	};
	type TermDump = {
		type: string;
		formula: string;
		faces: number | null;
		results: DieResultDump[] | null;
		number: number | null;
		operator: string | null;
	};
	type TraceDump = {
		isCritical: boolean;
		isMiss: boolean;
		total: number;
		stagedValuesRemaining: number;
	};
	type ResultDump = {
		trace: TraceDump;
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
	let advCount = $state(0);
	let disCount = $state(0);
	let forceCrit = $state(false);
	let forceMiss = $state(false);
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

	const netRollMode = $derived(advCount - disCount);

	const rollModeSourcesArray = $derived([
		...Array.from({ length: advCount }, () => 1),
		...Array.from({ length: disCount }, () => -1),
	]);

	function setForceCrit(value: boolean) {
		forceCrit = value;
		if (value) forceMiss = false;
	}

	function setForceMiss(value: boolean) {
		forceMiss = value;
		if (value) forceCrit = false;
	}

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
	let showRawJson = $state(false);

	const outcomeBadge = $derived.by<{ label: string; kind: 'crit' | 'miss' | 'hit' | 'none' }>(
		() => {
			if (!lastResult) return { label: '', kind: 'none' };
			if (lastResult.isCritical) {
				return { label: localize('NIMBLE.diceTestbench.results.crit'), kind: 'crit' };
			}
			if (lastResult.isMiss) {
				return { label: localize('NIMBLE.diceTestbench.results.miss'), kind: 'miss' };
			}
			return { label: localize('NIMBLE.diceTestbench.results.hit'), kind: 'hit' };
		},
	);

	const primaryTerms = $derived(lastResult?.terms.filter((t) => t.type === 'PrimaryDie') ?? []);
	const bonusDieTerms = $derived(
		lastResult?.terms.filter((t) => t.type === 'Die' || t.type === 'NimbleDie') ?? [],
	);
	const numericTerms = $derived(
		lastResult?.terms.filter((t) => t.type === 'NumericTerm' && t.number !== null) ?? [],
	);

	let activeScenarioId = $state<string | null>(null);
	const activeScenario = $derived(scenarios.find((s) => s.id === activeScenarioId) ?? null);

	function applyScenario(scenario: Scenario) {
		activeScenarioId = scenario.id;
		formula = scenario.formula ?? '1d8';
		isVicious = scenario.isVicious ?? false;
		canCrit = scenario.canCrit ?? true;
		canMiss = scenario.canMiss ?? true;
		primaryDieAsDamage = scenario.primaryDieAsDamage ?? true;
		templateShape = scenario.templateShape ?? '';
		weaponType = scenario.weaponType ?? '';
		advCount = scenario.advCount ?? 0;
		disCount = scenario.disCount ?? 0;
		forceCrit = scenario.forceCrit ?? false;
		forceMiss = scenario.forceMiss ?? false;
		specificValues = [];
		showSpecific = false;
		lastResult = null;
		lastError = null;
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
					rollModeSources: rollModeSourcesArray,
				},
				stagedValues,
			);
			lastResult = {
				trace: result.trace,
				isCritical: result.roll.isCritical,
				isMiss: result.roll.isMiss,
				total: result.roll.total,
				terms: result.roll.terms.map((t) => {
					const anyT = t as {
						constructor: { name: string };
						formula?: string;
						faces?: number;
						results?: Array<{
							result: number;
							active?: boolean;
							discarded?: boolean;
							exploded?: boolean;
						}>;
						number?: number;
						operator?: string;
					};
					const isDie = Array.isArray(anyT.results);
					return {
						type: anyT.constructor.name,
						formula: anyT.formula ?? '',
						faces: typeof anyT.faces === 'number' ? anyT.faces : null,
						results: isDie
							? (anyT.results ?? []).map((r) => ({
									result: r.result,
									active: r.active !== false,
									discarded: r.discarded === true,
									exploded: r.exploded === true,
								}))
							: null,
						number: typeof anyT.number === 'number' && !isDie ? anyT.number : null,
						operator: typeof anyT.operator === 'string' ? anyT.operator : null,
					};
				}),
			};
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			lastResult = null;
		}
	}

	async function onRoll() {
		if (forceCrit || forceMiss) {
			const faces = getPrimaryFaces();
			if (faces === null) {
				lastError = localize('NIMBLE.diceTestbench.rollBuilder.errors.noPrimaryDie');
				return;
			}
			const value = forceCrit ? faces : 1;
			await performRoll([{ value, faces }]);
			return;
		}
		await performRoll([]);
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
	<section class="nimble-testbench__col nimble-testbench__col--scenarios">
		<h2>{localize('NIMBLE.diceTestbench.scenarios.title')}</h2>
		<p class="nimble-testbench__hint">
			{localize('NIMBLE.diceTestbench.scenarios.hint')}
		</p>
		<ul class="nimble-testbench__scenario-list">
			{#each scenarios as scenario (scenario.id)}
				<li>
					<button
						type="button"
						class="nimble-testbench__scenario"
						class:nimble-testbench__scenario--active={activeScenarioId === scenario.id}
						onclick={() => applyScenario(scenario)}
					>
						{scenario.label}
					</button>
				</li>
			{/each}
		</ul>
		{#if activeScenario?.note}
			<p class="nimble-testbench__scenario-note">{activeScenario.note}</p>
		{/if}
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
			<input type="text" list="nimble-testbench-weapon-types" bind:value={weaponType} />
		</label>
		<datalist id="nimble-testbench-weapon-types">
			<option value="">(none — permissive, anyone can crit)</option>
			<option value="Unarmed Strike"></option>
			<option value="Battleaxe"></option>
			<option value="Club/Mace"></option>
			<option value="Crossbow"></option>
			<option value="Dagger"></option>
			<option value="Glaive"></option>
			<option value="Greataxe"></option>
			<option value="Greatmaul"></option>
			<option value="Greatsword"></option>
			<option value="Hand Axe"></option>
			<option value="Handheld Ballista"></option>
			<option value="Javelins"></option>
			<option value="Longbow"></option>
			<option value="Longsword"></option>
			<option value="Pole Hammer"></option>
			<option value="Rapier"></option>
			<option value="Short Sword"></option>
			<option value="Shortbow"></option>
			<option value="Sickle"></option>
			<option value="Sling"></option>
			<option value="Spear"></option>
			<option value="Staff"></option>
			<option value="Throwing Hammers"></option>
		</datalist>
		<p class="nimble-testbench__hint">
			{localize('NIMBLE.diceTestbench.rollBuilder.weaponTypeHint')}
		</p>

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
			<span class="nimble-testbench__sources-title">
				{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.title')}
			</span>
			<p class="nimble-testbench__hint">
				{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.hint')}
			</p>
			<div class="nimble-testbench__counter-row">
				<label class="nimble-testbench__counter">
					<span>{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.advLabel')}</span>
					<input type="number" min="0" max="10" bind:value={advCount} />
				</label>
				<label class="nimble-testbench__counter">
					<span>{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.disLabel')}</span>
					<input type="number" min="0" max="10" bind:value={disCount} />
				</label>
			</div>
			<p class="nimble-testbench__net">
				{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.net', {
					sum: String(netRollMode),
				})}
			</p>
		</div>

		<div class="nimble-testbench__force-row">
			<label class="nimble-testbench__force">
				<input
					type="checkbox"
					checked={forceCrit}
					onchange={(e) => setForceCrit((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceCrit')}</span>
			</label>
			<label class="nimble-testbench__force">
				<input
					type="checkbox"
					checked={forceMiss}
					onchange={(e) => setForceMiss((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceMiss')}</span>
			</label>
		</div>

		<div class="nimble-testbench__actions">
			<button type="button" onclick={onRoll}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.roll')}
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
		{#if lastResult && !lastError}
			<div class="nimble-testbench__outcome nimble-testbench__outcome--{outcomeBadge.kind}">
				<span class="nimble-testbench__outcome-label">{outcomeBadge.label}</span>
				<span class="nimble-testbench__outcome-total">
					{localize('NIMBLE.diceTestbench.results.totalLabel', {
						total: String(lastResult.total ?? 0),
					})}
				</span>
			</div>

			{#if primaryTerms.length > 0}
				<div class="nimble-testbench__group">
					<div class="nimble-testbench__group-label">
						{localize('NIMBLE.diceTestbench.results.primaryPool')}
					</div>
					{#each primaryTerms as term (term.formula)}
						<div class="nimble-testbench__die-row">
							{#each term.results ?? [] as r, ri (ri)}
								<div
									class="nimble-testbench__die nimble-testbench__die--primary"
									class:nimble-testbench__die--discarded={r.discarded}
									class:nimble-testbench__die--exploded={r.exploded}
								>
									<div class="nimble-testbench__die-value">{r.result}</div>
									<div class="nimble-testbench__die-faces">d{term.faces}</div>
									{#if r.discarded}
										<div class="nimble-testbench__die-tag">
											{localize('NIMBLE.diceTestbench.results.dropped')}
										</div>
									{/if}
									{#if r.exploded}
										<div class="nimble-testbench__die-tag">
											{localize('NIMBLE.diceTestbench.results.exploded')}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}

			{#if bonusDieTerms.length > 0}
				<div class="nimble-testbench__group">
					<div class="nimble-testbench__group-label">
						{localize('NIMBLE.diceTestbench.results.bonusDice')}
					</div>
					{#each bonusDieTerms as term, ti (ti)}
						<div class="nimble-testbench__die-row">
							{#each term.results ?? [] as r, ri (ri)}
								<div
									class="nimble-testbench__die nimble-testbench__die--bonus"
									class:nimble-testbench__die--discarded={r.discarded}
									class:nimble-testbench__die--exploded={r.exploded}
								>
									<div class="nimble-testbench__die-value">{r.result}</div>
									<div class="nimble-testbench__die-faces">d{term.faces}</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}

			{#if numericTerms.length > 0}
				<div class="nimble-testbench__group">
					<div class="nimble-testbench__group-label">
						{localize('NIMBLE.diceTestbench.results.flatBonuses')}
					</div>
					<div class="nimble-testbench__flat-row">
						{#each numericTerms as term, ti (ti)}
							<span class="nimble-testbench__flat">
								{(term.number ?? 0) >= 0 ? '+' : ''}{term.number}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="nimble-testbench__trace">
				<span>
					{localize('NIMBLE.diceTestbench.results.traceIsCritical', {
						state: String(lastResult.trace.isCritical),
					})}
				</span>
				<span>
					{localize('NIMBLE.diceTestbench.results.traceIsMiss', {
						state: String(lastResult.trace.isMiss),
					})}
				</span>
				{#if lastResult.trace.stagedValuesRemaining > 0}
					<span class="nimble-testbench__trace-warning">
						{localize('NIMBLE.diceTestbench.results.stagedRemaining', {
							count: String(lastResult.trace.stagedValuesRemaining),
						})}
					</span>
				{/if}
			</div>

			<div class="nimble-testbench__raw-toggle">
				<label>
					<input type="checkbox" bind:checked={showRawJson} />
					<span>{localize('NIMBLE.diceTestbench.results.showRawJson')}</span>
				</label>
			</div>
			{#if showRawJson}
				<pre class="nimble-testbench__dump">{resultJson}</pre>
			{/if}
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
	.nimble-testbench__hint {
		font-size: 0.75rem;
		color: #999;
		font-style: italic;
		margin: 0.2rem 0 0.4rem 0;
		line-height: 1.35;
	}
	.nimble-testbench__sources {
		border: 1px solid #444;
		padding: 0.3rem;
		margin: 0.5rem 0;
	}
	.nimble-testbench__sources-title {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		margin-bottom: 0.3rem;
	}
	.nimble-testbench__counter-row {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.3rem;
	}
	.nimble-testbench__counter {
		display: flex;
		flex-direction: column;
		font-size: 0.75rem;
		gap: 0.15rem;
	}
	.nimble-testbench__counter input[type='number'] {
		width: 4rem;
		background: #111;
		color: #e0e0e0;
		border: 1px solid #555;
		padding: 0.15rem;
	}
	.nimble-testbench__force-row {
		display: flex;
		gap: 1rem;
		margin: 0.4rem 0;
	}
	.nimble-testbench__force {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		cursor: pointer;
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
	.nimble-testbench__outcome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.7rem;
		margin-bottom: 0.6rem;
		border: 2px solid;
		border-radius: 3px;
		font-weight: 700;
	}
	.nimble-testbench__outcome--crit {
		border-color: #f5c542;
		background: #3a2d0a;
		color: #ffe48a;
	}
	.nimble-testbench__outcome--hit {
		border-color: #5a9;
		background: #0f2a20;
		color: #9fc;
	}
	.nimble-testbench__outcome--miss {
		border-color: #a55;
		background: #2d0f0f;
		color: #f99;
	}
	.nimble-testbench__outcome-label {
		font-size: 1rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.nimble-testbench__outcome-total {
		font-size: 1.1rem;
	}
	.nimble-testbench__group {
		margin-bottom: 0.6rem;
	}
	.nimble-testbench__group-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
		margin-bottom: 0.3rem;
	}
	.nimble-testbench__die-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.3rem;
	}
	.nimble-testbench__die {
		position: relative;
		min-width: 2.8rem;
		padding: 0.3rem 0.4rem 0.4rem 0.4rem;
		border: 2px solid #666;
		background: #181818;
		text-align: center;
		border-radius: 3px;
	}
	.nimble-testbench__die--primary {
		border-color: #f5c542;
		background: #2a2107;
	}
	.nimble-testbench__die--bonus {
		border-color: #6a8;
		background: #0f1a15;
	}
	.nimble-testbench__die--discarded {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.nimble-testbench__die--exploded {
		box-shadow: 0 0 6px #f5c542 inset;
	}
	.nimble-testbench__die-value {
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.1;
	}
	.nimble-testbench__die-faces {
		font-size: 0.65rem;
		color: #aaa;
	}
	.nimble-testbench__die-tag {
		font-size: 0.55rem;
		color: #f99;
		margin-top: 0.1rem;
		text-decoration: none;
	}
	.nimble-testbench__flat-row {
		display: flex;
		gap: 0.4rem;
	}
	.nimble-testbench__flat {
		font-size: 1rem;
		font-weight: 600;
		color: #cfc;
		padding: 0.2rem 0.5rem;
		border: 1px solid #444;
		background: #181818;
	}
	.nimble-testbench__trace {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.7rem;
		color: #888;
		margin: 0.5rem 0;
		padding: 0.3rem;
		border-top: 1px solid #333;
	}
	.nimble-testbench__trace-warning {
		color: #fb3;
	}
	.nimble-testbench__raw-toggle {
		font-size: 0.75rem;
		margin: 0.4rem 0 0.3rem 0;
	}
	.nimble-testbench__raw-toggle label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
		color: #888;
	}
	.nimble-testbench__col--scenarios {
		flex: 0 0 14rem;
	}
	.nimble-testbench__scenario-list {
		list-style: none;
		padding: 0;
		margin: 0.3rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.nimble-testbench__scenario {
		width: 100%;
		text-align: left;
		padding: 0.35rem 0.5rem;
		background: #1c1c1c;
		border: 1px solid #444;
		color: #e0e0e0;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.nimble-testbench__scenario:hover {
		background: #2a2a2a;
		border-color: #666;
	}
	.nimble-testbench__scenario--active {
		background: #2a2107;
		border-color: #f5c542;
		color: #ffe48a;
	}
	.nimble-testbench__scenario-note {
		font-size: 0.75rem;
		color: #aaa;
		font-style: italic;
		line-height: 1.35;
		margin: 0.4rem 0 0 0;
		padding: 0.4rem;
		background: #1c1c1c;
		border: 1px solid #333;
	}
</style>
