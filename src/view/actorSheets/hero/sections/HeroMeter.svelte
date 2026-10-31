<!--
@component
One meter of the rail: Wounds (toggle segments), Hit Dice (a number and Roll), Mana (a number and a bar),
a dice pool (a menu on each die, Discard all) and a charge pool (a number; a die pool rolls and spends one).
In edit mode the numbers rest, and Mana and Hit Dice get an EditZone to their configure window.
-->
<script lang="ts">
	import { askConfirm, closeConfirm } from '../../shared/sheetUiState.ts';
	import type { HeroMeterProps } from '#types/components/actorSheets/HeroMeter.d.ts';
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import EditZone from '../../parts/EditZone.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';

	let { meter, ui, perform }: HeroMeterProps = $props();

	const editing = $derived(ui.editing);
	const confirmId = $derived(`discardAll:${meter.id}`);
	let dieMenu: number | null = $state(null);

	function setFace(faces: number[], index: number, value: number, die: number) {
		const next = [...faces];
		next[index] = Math.max(1, Math.min(die, Math.floor(value)));
		void perform({ kind: 'setDiceFaces', poolId: meter.id, faces: next });
	}

	function discard(faces: number[], index: number) {
		dieMenu = null;
		void perform({
			kind: 'setDiceFaces',
			poolId: meter.id,
			faces: faces.filter((_, i) => i !== index),
		});
	}
</script>

<div
	class="meter {meter.kind === 'dicePool' || meter.kind === 'charges'
		? meter.poolKind
		: meter.kind}"
>
	{#if meter.kind === 'wounds'}
		<div class="head">
			<span class="label"><i class="fa-solid fa-bandage"></i> {meter.label}</span>
			<span class="count" class:dead={meter.dead}>
				{meter.summary}
			</span>
		</div>
		<div class="cells">
			{#each meter.segments as segment (segment.label)}
				<button
					type="button"
					class="nimble-u-reset-button toggle"
					aria-label={segment.label}
					aria-pressed={segment.on}
					data-tooltip={segment.label}
					disabled={editing}
					onclick={() => perform(segment.intent)}
				>
					<span class="segment" class:on={segment.on}></span>
				</button>
			{/each}
		</div>
	{:else if meter.kind === 'hitDice'}
		<div class="head">
			<span class="label">
				<i class="fa-solid fa-heart-circle-plus"></i>
				{meter.label} <small>{meter.sizes}</small>
			</span>
			{#if meter.typeable}
				<span class="count">
					<InlineNumber
						value={meter.value}
						label={meter.currentLabel}
						min={0}
						max={meter.max}
						width="34px"
						variant="label"
						rest={editing}
						onchange={(value) => perform({ kind: 'setHitDice', value })}
					/><span>/ {meter.max}</span>
				</span>
			{:else}
				<span class="count">{meter.summary}</span>
			{/if}
		</div>
		<div class="line">
			<div class="cells">
				{#each { length: meter.max }, index}
					<span class="pip" class:on={index < meter.value}></span>
				{/each}
			</div>
			{#if meter.edit}
				{@const edit = meter.edit}
				<button
					type="button"
					class="nimble-u-reset-button step"
					aria-label={edit.label}
					data-tooltip={edit.label}
					disabled={editing}
					onclick={() => perform(edit.intent)}
				>
					<i class="fa-solid fa-pen"></i>
				</button>
			{/if}
			<button
				type="button"
				class="nimble-u-reset-button roll"
				data-tooltip={meter.roll.hint}
				disabled={editing}
				onclick={() => perform(meter.roll.intent)}
			>
				<i class="fa-solid fa-dice-d20"></i>{meter.roll.label}
			</button>
		</div>
		{#if editing}
			<EditZone
				short={meter.label}
				label={meter.configureLabel}
				onclick={() => perform({ kind: 'configure', target: 'hitDice' })}
			/>
		{/if}
	{:else if meter.kind === 'mana'}
		<div class="head">
			<span class="label">
				<i class="fa-solid fa-droplet"></i>
				{meter.label}
				{#if meter.idle}<small>{meter.idle.note}</small>{/if}
			</span>
			{#if !meter.idle}
				<span class="count">
					<InlineNumber
						value={meter.value}
						label={meter.currentLabel}
						min={0}
						max={meter.max}
						width="34px"
						variant="label"
						rest={editing}
						onchange={(value) => perform({ kind: 'setMana', value })}
					/><span>/ {meter.max}</span>
				</span>
			{/if}
		</div>
		<div class="bar" class:idle={!!meter.idle} data-tooltip={meter.idle?.hint}>
			<div style:width="{meter.max ? Math.round((meter.value / meter.max) * 100) : 0}%"></div>
		</div>
		{#if editing}
			<EditZone
				short={meter.label}
				label={meter.configureLabel}
				onclick={() => perform({ kind: 'configure', target: 'mana' })}
			/>
		{/if}
	{:else if meter.kind === 'dicePool'}
		{@const pool = meter}
		<div class="head">
			<span class="label" data-tooltip={pool.label}
				><i class={pool.icon}></i> {pool.label} <small>d{pool.die}</small></span
			>
			<span class="count">{pool.faces.length}/{pool.max}</span>
		</div>
		<div class="line">
			<div class="cells">
				{#each { length: pool.max }, index}
					{#if index < pool.faces.length}
						<button
							type="button"
							class="nimble-u-reset-button die"
							aria-expanded={dieMenu === index}
							aria-label={pool.faceLabels[index]}
							disabled={editing}
							onclick={() => (dieMenu = dieMenu === index ? null : index)}
						>
							{pool.faces[index]}
						</button>
					{:else}
						<span class="die empty"></span>
					{/if}
				{/each}
			</div>
			{#if pool.add}
				{@const add = pool.add}
				<button
					type="button"
					class="nimble-u-reset-button step"
					aria-label={add.label}
					data-tooltip={add.hint}
					disabled={editing}
					onclick={() => perform(add.intent)}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			{/if}
			{#if pool.faces.length}
				<button
					type="button"
					class="nimble-u-reset-button step"
					aria-label={pool.text.discardAll}
					data-tooltip={pool.text.discardAll}
					disabled={editing}
					onclick={() => askConfirm(ui, confirmId)}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			{/if}
		</div>
		{#if dieMenu !== null && dieMenu < pool.faces.length}
			{@const index = dieMenu}
			<div class="menu" role="group" aria-label={pool.text.menu}>
				<span>{pool.text.setValue}</span>
				<InlineNumber
					value={pool.faces[index]}
					label={pool.text.setValue}
					min={1}
					max={pool.die}
					width="34px"
					variant="field"
					onchange={(value) => setFace(pool.faces, index, value, pool.die)}
				/>
				<button
					type="button"
					class="nimble-u-reset-button roll"
					onclick={() => discard(pool.faces, index)}
				>
					<i class="fa-solid fa-xmark"></i>{pool.text.discard}
				</button>
			</div>
		{/if}
		{#if ui.confirm === confirmId}
			<div class="ask">
				<ConfirmBar
					question={pool.text.discardAllQuestion}
					confirmLabel={pool.text.discardAll}
					onconfirm={() => {
						closeConfirm(ui);
						dieMenu = null;
						void perform({ kind: 'setDiceFaces', poolId: pool.id, faces: [] });
					}}
					oncancel={() => closeConfirm(ui)}
				/>
			</div>
		{/if}
	{:else if meter.kind === 'charges'}
		{@const pool = meter}
		<div class="head">
			<span class="label" data-tooltip={pool.label}>
				<i class={pool.icon}></i>
				{pool.label}
				{#if pool.die}<small>d{pool.die}</small>{/if}
				{#if pool.temporary}<small>{pool.temporary}</small>{/if}
			</span>
			<span class="count">
				<InlineNumber
					value={pool.value}
					label={pool.currentLabel}
					min={0}
					max={pool.max}
					width="34px"
					variant="label"
					rest={editing}
					onchange={(value) => perform({ kind: 'setPoolCharges', poolId: pool.id, value })}
				/><span>/ {pool.max}</span>
			</span>
		</div>
		<div class="cells">
			{#each { length: pool.max }, index}
				{#if pool.rollOne && index < pool.value}
					{@const rollOne = pool.rollOne}
					<button
						type="button"
						class="nimble-u-reset-button die"
						aria-label={rollOne.label}
						data-tooltip={rollOne.label}
						disabled={editing}
						onclick={() => perform(rollOne.intent)}
					>
						d{pool.die}
					</button>
				{:else if pool.die}
					<span class="die empty"></span>
				{:else}
					<span class="pip" class:on={index < pool.value}></span>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.meter {
		position: relative;
		flex-shrink: 0;
		--tone: var(--nimble-class-resource-color);
	}
	.meter.wounds {
		--tone: var(--nimble-ui-vital);
	}
	.meter.hitDice {
		--tone: var(--nimble-hit-dice-color);
	}
	.hitDice .pip.on {
		background: var(--nimble-hit-dice-fill);
	}
	.meter.mana {
		--tone: var(--nimble-pool-mana-color);
	}
	.meter.dice {
		--tone: var(--nimble-pool-dice-color);
	}
	.meter.charges {
		--tone: var(--nimble-pool-charges-color);
	}
	.meter.uses {
		--tone: var(--nimble-pool-uses-color);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 4px;
		font-size: 0.729rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		line-height: 1.15;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	.label {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.label i {
		color: var(--tone);
	}
	.label small {
		font-size: 0.688rem;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--nimble-ui-ink-muted);
	}
	.count {
		display: inline-flex;
		align-items: baseline;
		white-space: nowrap;
		color: color-mix(in srgb, var(--tone) 65%, var(--nimble-ui-fill-ink));
	}
	.count.dead {
		color: var(--nimble-ui-vital);
	}
	.line {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.cells {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 3px;
		min-height: 24px;
		align-items: center;
	}
	.toggle {
		flex: 1;
		min-width: 0;
		height: 24px;
		display: flex;
		align-items: center;
	}
	.segment,
	.pip {
		flex: 1;
		height: 10px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 3px;
	}
	.segment.on,
	.pip.on {
		border-color: color-mix(in srgb, var(--tone) 55%, #000);
		background: var(--tone);
	}
	.toggle:hover .segment {
		outline: 1px solid var(--nimble-ui-highlight);
		outline-offset: 1px;
	}
	.toggle:focus-visible {
		outline: none;
	}
	.toggle:focus-visible .segment {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.die {
		flex: 1;
		min-width: 0;
		max-width: 34px;
		height: 24px;
		display: grid;
		place-items: center;
		border-radius: 4px;
		background: var(--tone);
		font-size: 0.75rem;
		font-weight: 900;
		line-height: 1;
		color: var(--nimble-ui-tone-ink);
	}
	.die.empty {
		border: 1px solid var(--nimble-ui-ring);
		background: transparent;
	}
	button.die:hover,
	button.die[aria-expanded='true'] {
		outline: 2px solid var(--nimble-ui-highlight);
		outline-offset: 1px;
	}
	.bar {
		height: 14px;
		border: 1px solid var(--nimble-bronze);
		border-radius: 3px;
		background: var(--nimble-ui-well);
		overflow: hidden;
	}
	.bar.idle {
		border-style: dashed;
	}
	.bar div {
		height: 100%;
		background: var(--nimble-mana-fill);
	}
	.step {
		display: grid;
		place-items: center;
		flex: none;
		width: 24px;
		height: 24px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.625rem;
		color: var(--nimble-ui-ink);
	}
	.roll {
		flex: none;
		display: flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.step:hover,
	.roll:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.step:disabled,
	.roll:disabled,
	.toggle:disabled,
	button.die:disabled {
		opacity: 0.4;
		filter: saturate(0.35);
		pointer-events: none;
	}
	.menu {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.menu .roll {
		margin-left: auto;
	}
	.ask {
		margin-top: 6px;
	}
</style>
