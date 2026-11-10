<!--
@component
The Changes tab of the effect window: core's changes to the data of the holder, one row each.
-->
<script lang="ts">
	import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
	import localize from '#utils/localize.js';

	interface Change {
		key: string;
		type: string;
		value: unknown;
		phase: string;
		priority: number | null;
	}

	let { effect }: { effect: NimbleActiveEffect } = $props();

	const CH = 'NIMBLE.effectSheet.changes';

	const changes = $derived(
		((effect.reactive.system as unknown as { changes?: Change[] }).changes ?? []) as Change[],
	);

	const changeTypes = $derived.by(() => {
		const types = (
			CONFIG.ActiveEffect.documentClass as unknown as {
				CHANGE_TYPES?: Record<string, { label: string; defaultPriority?: number }>;
			}
		).CHANGE_TYPES;
		return Object.entries(types ?? {})
			.map(([type, { label, defaultPriority }]) => ({
				type,
				label: localize(label),
				defaultPriority,
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	function shownValue(value: unknown): string {
		if (value === null || value === undefined) return '';
		return typeof value === 'string' ? value : JSON.stringify(value);
	}

	/** As core's window: a value that reads as JSON is stored as that value. */
	function parsedValue(text: string): unknown {
		if (!text) return text;
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	function save(next: Change[]) {
		return effect.update({ 'system.changes': next } as never);
	}

	function change(index: number, patch: Partial<Change>) {
		return save(changes.map((each, at) => (at === index ? { ...each, ...patch } : each)));
	}

	function add() {
		return save([
			...changes,
			{ key: '', type: 'add', value: '', phase: 'initial', priority: null },
		]);
	}

	const priorityHint = (type: string) =>
		changeTypes.find((each) => each.type === type)?.defaultPriority?.toString() ?? '';
</script>

<section class="nimble-sheet__body nimble-sheet__body--item nimble-effect-changes">
	<div class="nimble-effect-changes__grid">
		<span class="nimble-effect-changes__head">{localize(`${CH}.key`)}</span>
		<span class="nimble-effect-changes__head">{localize(`${CH}.type`)}</span>
		<span class="nimble-effect-changes__head">{localize(`${CH}.value`)}</span>
		<span class="nimble-effect-changes__head">{localize(`${CH}.priority`)}</span>
		<button
			type="button"
			class="nimble-effect-changes__icon"
			aria-label={localize(`${CH}.add`)}
			data-tooltip={localize(`${CH}.add`)}
			onclick={add}
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i>
		</button>

		{#each changes as each, index (index)}
			<input
				type="text"
				aria-label={localize(`${CH}.key`)}
				value={each.key}
				onchange={({ currentTarget }) => change(index, { key: currentTarget.value.trim() })}
			/>
			<select
				aria-label={localize(`${CH}.type`)}
				value={each.type}
				onchange={({ currentTarget }) => change(index, { type: currentTarget.value })}
			>
				{#each changeTypes as type (type.type)}
					<option value={type.type}>{type.label}</option>
				{/each}
			</select>
			<input
				type="text"
				aria-label={localize(`${CH}.value`)}
				value={shownValue(each.value)}
				onchange={({ currentTarget }) => change(index, { value: parsedValue(currentTarget.value) })}
			/>
			<input
				type="number"
				aria-label={localize(`${CH}.priority`)}
				placeholder={priorityHint(each.type)}
				value={each.priority ?? ''}
				onchange={({ currentTarget }) =>
					change(index, {
						priority: currentTarget.value === '' ? null : Number(currentTarget.value),
					})}
			/>
			<button
				type="button"
				class="nimble-effect-changes__icon"
				aria-label={localize(`${CH}.remove`)}
				data-tooltip={localize(`${CH}.remove`)}
				onclick={() => save(changes.filter((_, at) => at !== index))}
			>
				<i class="fa-solid fa-trash" aria-hidden="true"></i>
			</button>
		{/each}
	</div>

	{#if changes.length === 0}
		<p class="nimble-effect-changes__none">{localize(`${CH}.none`)}</p>
	{/if}
</section>

<style lang="scss">
	.nimble-effect-changes {
		&__grid {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 4rem 1.5rem;
			align-items: center;
			gap: 0.375rem;
		}

		&__head {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-muted);
		}

		&__icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: var(--nimble-ui-ink-muted);
			cursor: pointer;

			&:hover {
				color: var(--nimble-ui-ink);
				background: var(--nimble-ui-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}

		&__none {
			margin: 0.5rem 0 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
