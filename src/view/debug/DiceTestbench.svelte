<script lang="ts">
	import localize from '#utils/localize.js';
	import { scenarios } from '#view/debug/scenarios.js';
	import { templateShapeOptions } from './DiceTestbench.constants.js';
	import { createDiceTestbenchState } from './DiceTestbench.state.svelte.ts';

	const state = createDiceTestbenchState();
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
						class:nimble-testbench__scenario--active={state.activeScenarioId === scenario.id}
						onclick={() => state.applyScenario(scenario)}
					>
						{scenario.label}
					</button>
				</li>
			{/each}
		</ul>
		{#if state.activeScenario?.note}
			<p class="nimble-testbench__scenario-note">{state.activeScenario.note}</p>
		{/if}
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.rollBuilder.title')}</h2>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.actorLabel')}</span>
			<select bind:value={state.selectedActorId}>
				<option value={null}>--</option>
				{#each state.actors as actor (actor.id)}
					<option value={actor.id}>{actor.name} ({actor.type})</option>
				{/each}
			</select>
		</label>
		{#if state.selectedActor}
			<p class="nimble-testbench__confirm">
				{localize('NIMBLE.diceTestbench.rollBuilder.selectedLabel')}: {state.selectedActor.name}
				<span class="nimble-testbench__actor-type">({state.selectedActor.type})</span>
			</p>
			<p class="nimble-testbench__hint">
				{localize('NIMBLE.diceTestbench.rollBuilder.actorContextHint')}
			</p>
		{/if}

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.formulaLabel')}</span>
			<input type="text" bind:value={state.formula} />
		</label>

		<div class="nimble-testbench__flags" class:is-locked={state.flagsLocked}>
			<label>
				<input type="checkbox" bind:checked={state.isVicious} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.isVicious')}
			</label>
			<label class:is-overridden={state.flagsLocked}>
				<input type="checkbox" bind:checked={state.canCrit} disabled={state.flagsLocked} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.canCrit')}
				{#if state.flagsLocked}
					<em>({localize('NIMBLE.diceTestbench.rollBuilder.flags.overriddenByAoe')})</em>
				{/if}
			</label>
			<label class:is-overridden={state.flagsLocked}>
				<input type="checkbox" bind:checked={state.canMiss} disabled={state.flagsLocked} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.canMiss')}
				{#if state.flagsLocked}
					<em>({localize('NIMBLE.diceTestbench.rollBuilder.flags.overriddenByAoe')})</em>
				{/if}
			</label>
			<label>
				<input type="checkbox" bind:checked={state.primaryDieAsDamage} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.primaryDieAsDamage')}
			</label>
			<label>
				<input type="checkbox" bind:checked={state.brutalPrimary} />
				{localize('NIMBLE.diceTestbench.rollBuilder.flags.brutalPrimary')}
			</label>
		</div>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.templateShapeLabel')}</span>
			<select bind:value={state.templateShape}>
				{#each templateShapeOptions as opt (opt.value)}
					<option value={opt.value}>{localize(opt.labelKey)}</option>
				{/each}
			</select>
		</label>

		<label class="nimble-testbench__field">
			<span>{localize('NIMBLE.diceTestbench.rollBuilder.weaponTypeLabel')}</span>
			<input type="text" list="nimble-testbench-weapon-types" bind:value={state.weaponType} />
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
				weaponType: state.weaponType === '' ? '-' : state.weaponType,
				state:
					state.proficient === null
						? localize('NIMBLE.diceTestbench.rollBuilder.proficiency.na')
						: state.proficient
							? localize('NIMBLE.diceTestbench.rollBuilder.proficiency.yes')
							: localize('NIMBLE.diceTestbench.rollBuilder.proficiency.no'),
			})}
		</p>
		<p class="nimble-testbench__prof">
			{localize('NIMBLE.diceTestbench.rollBuilder.critSuppressedLine', {
				state: state.critSuppressedForNonProf
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
					<input type="number" min="0" max="10" bind:value={state.advCount} />
				</label>
				<label class="nimble-testbench__counter">
					<span>{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.disLabel')}</span>
					<input type="number" min="0" max="10" bind:value={state.disCount} />
				</label>
			</div>
			<p class="nimble-testbench__net">
				{localize('NIMBLE.diceTestbench.rollBuilder.rollModeSources.net', {
					sum: String(state.netRollMode),
				})}
			</p>
		</div>

		<div class="nimble-testbench__resolved">
			<div class="nimble-testbench__resolved-title">
				{localize('NIMBLE.diceTestbench.rollBuilder.resolved.title')}
			</div>
			<div class="nimble-testbench__resolved-row">
				<span>canCrit:</span>
				<strong class:is-off={!state.resolvedCanCrit}>{String(state.resolvedCanCrit)}</strong>
				{#if state.critSuppressionReason}
					<em>— {state.critSuppressionReason}</em>
				{/if}
			</div>
			<div class="nimble-testbench__resolved-row">
				<span>canMiss:</span>
				<strong class:is-off={!state.resolvedCanMiss}>{String(state.resolvedCanMiss)}</strong>
				{#if state.missSuppressionReason}
					<em>— {state.missSuppressionReason}</em>
				{/if}
			</div>
		</div>

		<div class="nimble-testbench__force-row">
			<label class="nimble-testbench__force">
				<input
					type="checkbox"
					checked={state.forceCrit}
					onchange={(e) => state.setForceCrit((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceCrit')}</span>
			</label>
			<label class="nimble-testbench__force">
				<input
					type="checkbox"
					checked={state.forceMiss}
					onchange={(e) => state.setForceMiss((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceMiss')}</span>
			</label>
		</div>

		<div class="nimble-testbench__actions">
			<button type="button" onclick={state.onRoll}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.roll')}
			</button>
			<button type="button" onclick={() => (state.showSpecific = !state.showSpecific)}>
				{localize('NIMBLE.diceTestbench.rollBuilder.actions.forceSpecific')}
			</button>
		</div>

		{#if state.showSpecific}
			<div class="nimble-testbench__specific">
				<p>{localize('NIMBLE.diceTestbench.rollBuilder.specific.hint')}</p>
				{#each state.parsedDice as die, i (i)}
					<label class="nimble-testbench__specific-row">
						<span>d{die.faces} #{i + 1}</span>
						<input
							type="number"
							min="1"
							max={die.faces}
							bind:value={state.specificValues[i]}
							placeholder="1-{die.faces}"
						/>
					</label>
				{/each}
				<button type="button" onclick={state.onRollWithSpecific}>
					{localize('NIMBLE.diceTestbench.rollBuilder.specific.rollWith')}
				</button>
			</div>
		{/if}
	</section>

	<section class="nimble-testbench__col">
		<h2>{localize('NIMBLE.diceTestbench.results.title')}</h2>
		{#if state.lastError}
			<pre class="nimble-testbench__error">{state.lastError}</pre>
		{/if}
		{#if state.lastResult && !state.lastError}
			<div class="nimble-testbench__outcome nimble-testbench__outcome--{state.outcomeBadge.kind}">
				<span class="nimble-testbench__outcome-label">{state.outcomeBadge.label}</span>
				<span class="nimble-testbench__outcome-total">
					{localize('NIMBLE.diceTestbench.results.totalLabel', {
						total: String(state.lastResult.total ?? 0),
					})}
				</span>
			</div>

			{#if state.categorizedPrimary.length > 0}
				{#each state.categorizedPrimary as term, ti (ti)}
					{@const kept = term.dice.filter((d) => d.category === 'kept')}
					{@const dropped = term.dice.filter((d) => d.category === 'dropped')}
					{@const critRerolls = term.dice.filter((d) => d.category === 'critReroll')}
					{@const viciousChain = term.dice.filter((d) => d.category === 'viciousChain')}
					{@const viciousBonus = term.dice.filter((d) => d.category === 'viciousBonus')}

					{#if kept.length > 0}
						<div class="nimble-testbench__group">
							<div class="nimble-testbench__group-label">
								{localize('NIMBLE.diceTestbench.results.basePool')}
							</div>
							<div class="nimble-testbench__die-row">
								{#each kept as r, ri (ri)}
									<div
										class="nimble-testbench__die nimble-testbench__die--primary"
										class:nimble-testbench__die--exploded={r.exploded}
									>
										<div class="nimble-testbench__die-value">{r.result}</div>
										<div class="nimble-testbench__die-faces">d{term.faces}</div>
										{#if r.exploded}
											<div class="nimble-testbench__die-tag">
												{localize('NIMBLE.diceTestbench.results.exploded')}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if dropped.length > 0}
						<div class="nimble-testbench__group">
							<div class="nimble-testbench__group-label">
								{localize('NIMBLE.diceTestbench.results.dropped')}
							</div>
							<div class="nimble-testbench__die-row">
								{#each dropped as r, ri (ri)}
									<div
										class="nimble-testbench__die nimble-testbench__die--primary nimble-testbench__die--discarded"
									>
										<div class="nimble-testbench__die-value">{r.result}</div>
										<div class="nimble-testbench__die-faces">d{term.faces}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if critRerolls.length > 0}
						<div class="nimble-testbench__group">
							<div class="nimble-testbench__group-label">
								{localize('NIMBLE.diceTestbench.results.critRerolls')}
							</div>
							<div class="nimble-testbench__die-row">
								{#each critRerolls as r, ri (ri)}
									<div
										class="nimble-testbench__die nimble-testbench__die--primary nimble-testbench__die--exploded"
									>
										<div class="nimble-testbench__die-value">{r.result}</div>
										<div class="nimble-testbench__die-faces">d{term.faces}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if viciousChain.length > 0}
						<div class="nimble-testbench__group">
							<div class="nimble-testbench__group-label">
								{localize('NIMBLE.diceTestbench.results.viciousChain')}
							</div>
							<div class="nimble-testbench__die-row">
								{#each viciousChain as r, ri (ri)}
									<div
										class="nimble-testbench__die nimble-testbench__die--vicious-chain"
										class:nimble-testbench__die--exploded={r.exploded}
									>
										<div class="nimble-testbench__die-value">{r.result}</div>
										<div class="nimble-testbench__die-faces">d{term.faces}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if viciousBonus.length > 0}
						<div class="nimble-testbench__group">
							<div class="nimble-testbench__group-label">
								{localize('NIMBLE.diceTestbench.results.viciousBonus')}
							</div>
							<div class="nimble-testbench__die-row">
								{#each viciousBonus as r, ri (ri)}
									<div class="nimble-testbench__die nimble-testbench__die--vicious-bonus">
										<div class="nimble-testbench__die-value">{r.result}</div>
										<div class="nimble-testbench__die-faces">d{term.faces}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{/if}

			{#if state.bonusDieTerms.length > 0}
				<div class="nimble-testbench__group">
					<div class="nimble-testbench__group-label">
						{localize('NIMBLE.diceTestbench.results.bonusDice')}
					</div>
					{#each state.bonusDieTerms as term, ti (ti)}
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

			{#if state.numericTerms.length > 0}
				<div class="nimble-testbench__group">
					<div class="nimble-testbench__group-label">
						{localize('NIMBLE.diceTestbench.results.flatBonuses')}
					</div>
					<div class="nimble-testbench__flat-row">
						{#each state.numericTerms as term, ti (ti)}
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
						state: String(state.lastResult.trace.isCritical),
					})}
				</span>
				<span>
					{localize('NIMBLE.diceTestbench.results.traceIsMiss', {
						state: String(state.lastResult.trace.isMiss),
					})}
				</span>
				<span>critCount: {state.lastResult.trace.critCount}</span>
				{#if state.lastResult.trace.stagedValuesRemaining > 0}
					<span class="nimble-testbench__trace-warning">
						{localize('NIMBLE.diceTestbench.results.stagedRemaining', {
							count: String(state.lastResult.trace.stagedValuesRemaining),
						})}
					</span>
				{/if}
			</div>

			<div class="nimble-testbench__raw-toggle">
				<label>
					<input type="checkbox" bind:checked={state.showRawJson} />
					<span>{localize('NIMBLE.diceTestbench.results.showRawJson')}</span>
				</label>
			</div>
			{#if state.showRawJson}
				<pre class="nimble-testbench__dump">{state.resultJson}</pre>
			{/if}
		{:else if !state.lastError}
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
	.nimble-testbench__actor-type {
		color: #888;
		font-size: 0.75rem;
		margin-left: 0.25rem;
	}
	.nimble-testbench__resolved {
		margin: 0.5rem 0;
		padding: 0.4rem 0.5rem;
		border: 1px solid #444;
		background: #181818;
		font-size: 0.75rem;
	}
	.nimble-testbench__resolved-title {
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.65rem;
		margin-bottom: 0.25rem;
	}
	.nimble-testbench__resolved-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.1rem 0;
		color: #cfc;
	}
	.nimble-testbench__resolved-row span {
		color: #aaa;
	}
	.nimble-testbench__resolved-row strong.is-off {
		color: #f99;
	}
	.nimble-testbench__resolved-row em {
		color: #888;
		font-style: italic;
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
	.nimble-testbench__die--vicious-chain {
		border-color: #d65;
		background: #2a1009;
		color: #fbb;
	}
	.nimble-testbench__die--vicious-bonus {
		border-color: #c4a;
		background: #2a0a20;
		color: #fbe;
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
