<script lang="ts" module>
	let compendiumKeys = $state<Set<string>>(new Set());
	let compendiumLoadPromise: Promise<void> | null = null;

	function loadCompendiumKeys(): Promise<void> {
		if (compendiumLoadPromise) return compendiumLoadPromise;
		compendiumLoadPromise = (async () => {
			const next = new Set<string>();
			interface PackLike {
				metadata?: { type?: string };
				getDocuments?: () => Promise<Array<{ tags?: Set<string> }>>;
			}
			const packs = (game as unknown as { packs?: Iterable<PackLike> }).packs;
			if (!packs) return;
			for (const pack of packs) {
				if (pack.metadata?.type !== 'Actor') continue;
				try {
					const docs = (await pack.getDocuments?.()) ?? [];
					for (const doc of docs) {
						if (!doc.tags) continue;
						for (const entry of doc.tags) {
							const k = entry.split(':', 1)[0];
							if (k) next.add(k);
						}
					}
				} catch {
					// Partial keys from other packs beat zero.
				}
			}
			compendiumKeys = next;
		})();
		return compendiumLoadPromise;
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Predicate, type RawPredicate } from '../../../etc/Predicate.js';
	import type { PredicateBuilderProps } from '#view/rulesBuilder/types.js';

	let { value, onChange, previewDomain }: PredicateBuilderProps = $props();

	onMount(() => {
		void loadCompendiumKeys();
	});

	type Operator = 'is' | 'isOneOf' | 'isAtLeast' | 'isAtMost' | 'isExactly' | 'isBetween';

	const OPERATOR_LABELS: Record<Operator, string> = {
		is: 'is',
		isOneOf: 'is one of',
		isAtLeast: 'is at least',
		isAtMost: 'is at most',
		isExactly: 'is exactly',
		isBetween: 'is between',
	};

	const OPERATOR_HINTS: Record<Operator, string> = {
		is: 'Actor must be tagged with this exact value.',
		isOneOf: 'Actor must be tagged with any one of these values.',
		isAtLeast: 'The numeric value associated with this key must be at least this.',
		isAtMost: 'The numeric value associated with this key must be at most this.',
		isExactly: 'The numeric value associated with this key must equal this.',
		isBetween: 'The numeric value associated with this key must be within this range.',
	};

	interface RowState {
		key: string;
		operator: Operator;
		valueText: string;
		valueArray: string[];
		valueNumber: string;
		valueRangeMin: string;
		valueRangeMax: string;
	}

	function detectOperator(stmt: unknown): Operator {
		if (Array.isArray(stmt)) return 'isOneOf';
		if (typeof stmt === 'string') return 'is';
		if (stmt && typeof stmt === 'object') {
			const s = stmt as { min?: unknown; max?: unknown; equal?: unknown };
			const hasMin = s.min !== undefined && s.min !== null && s.min !== '';
			const hasMax = s.max !== undefined && s.max !== null && s.max !== '';
			const hasEqual = s.equal !== undefined && s.equal !== null && s.equal !== '';
			if (hasEqual) return 'isExactly';
			if (hasMin && hasMax) return 'isBetween';
			if (hasMin) return 'isAtLeast';
			if (hasMax) return 'isAtMost';
		}
		return 'isExactly';
	}

	function rowFromEntry(key: string, stmt: unknown): RowState {
		const operator = detectOperator(stmt);
		const row: RowState = {
			key,
			operator,
			valueText: '',
			valueArray: [],
			valueNumber: '',
			valueRangeMin: '',
			valueRangeMax: '',
		};
		if (typeof stmt === 'string') {
			row.valueText = stmt;
		} else if (Array.isArray(stmt)) {
			row.valueArray = stmt.map((v) => String(v));
		} else if (stmt && typeof stmt === 'object') {
			const s = stmt as { min?: number | string; max?: number | string; equal?: number | string };
			if (operator === 'isBetween') {
				row.valueRangeMin = s.min === undefined || s.min === null ? '' : String(s.min);
				row.valueRangeMax = s.max === undefined || s.max === null ? '' : String(s.max);
			} else if (operator === 'isAtLeast') {
				row.valueNumber = s.min === undefined || s.min === null ? '' : String(s.min);
			} else if (operator === 'isAtMost') {
				row.valueNumber = s.max === undefined || s.max === null ? '' : String(s.max);
			} else if (operator === 'isExactly') {
				row.valueNumber = s.equal === undefined || s.equal === null ? '' : String(s.equal);
			}
		}
		return row;
	}

	function rowsFromValue(v: RawPredicate): RowState[] {
		return Object.entries(v ?? {}).map(([key, stmt]) => rowFromEntry(key, stmt));
	}

	let rows = $state<RowState[]>(untrack(() => rowsFromValue(value)));
	let lastSerializedValue = $state('');

	$effect(() => {
		const next = JSON.stringify(value ?? {});
		if (next !== lastSerializedValue) {
			rows = rowsFromValue(value);
			lastSerializedValue = next;
		}
	});

	function maybeNumber(input: string): number | string {
		if (input === '') return '';
		const n = Number(input);
		return Number.isNaN(n) ? input : n;
	}

	function rowToStatement(row: RowState): unknown {
		switch (row.operator) {
			case 'is':
				return row.valueText;
			case 'isOneOf':
				return row.valueArray.filter((v) => v !== '');
			case 'isAtLeast':
				return { min: maybeNumber(row.valueNumber) };
			case 'isAtMost':
				return { max: maybeNumber(row.valueNumber) };
			case 'isExactly':
				return { equal: maybeNumber(row.valueNumber) };
			case 'isBetween':
				return {
					min: maybeNumber(row.valueRangeMin),
					max: maybeNumber(row.valueRangeMax),
				};
		}
	}

	function rowsToValue(): RawPredicate {
		const out: RawPredicate = {};
		for (const row of rows) {
			const trimmedKey = row.key.trim();
			if (!trimmedKey) continue;
			out[trimmedKey] = rowToStatement(row) as RawPredicate[string];
		}
		return out;
	}

	function emit() {
		const next = rowsToValue();
		lastSerializedValue = JSON.stringify(next);
		onChange(next);
	}

	function addRow() {
		rows = [
			...rows,
			{
				key: '',
				operator: 'is',
				valueText: '',
				valueArray: [],
				valueNumber: '',
				valueRangeMin: '',
				valueRangeMax: '',
			},
		];
	}

	function deleteRow(index: number) {
		rows = rows.filter((_, i) => i !== index);
		emit();
	}

	function updateRow(index: number, patch: Partial<RowState>) {
		rows = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
	}

	function updateOperator(index: number, operator: Operator) {
		updateRow(index, { operator });
		emit();
	}

	function updateArrayValue(rowIndex: number, arrayIndex: number, value: string) {
		const row = rows[rowIndex];
		const nextArray = row.valueArray.map((v, i) => (i === arrayIndex ? value : v));
		updateRow(rowIndex, { valueArray: nextArray });
	}

	function addArrayValue(rowIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { valueArray: [...row.valueArray, ''] });
	}

	function removeArrayValue(rowIndex: number, arrayIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { valueArray: row.valueArray.filter((_, i) => i !== arrayIndex) });
		emit();
	}

	const suggestionKeys = $derived.by(() => {
		const keys = new Set<string>(compendiumKeys);
		const collect = (tags: Set<string> | undefined) => {
			if (!tags) return;
			for (const entry of tags) {
				const k = entry.split(':', 1)[0];
				if (k) keys.add(k);
			}
		};

		const worldActors = game.actors as Iterable<{ tags?: Set<string> }> | undefined;
		if (worldActors) for (const a of worldActors) collect(a.tags);
		collect(previewDomain);

		return [...keys].sort();
	});

	// Unique `<datalist>` id so multiple builders on the same page don't collide.
	const datalistId = `nimble-predicate-keys-${Math.random().toString(36).slice(2)}`;

	let preview = $derived.by(() => {
		if (!previewDomain) return null;
		const raw = rowsToValue();
		try {
			const predicate = new Predicate(raw);
			if (!predicate.size) return { matches: true, reason: 'No conditions — always applies.' };
			if (!predicate.isValid) return { matches: false, reason: 'Conditions are incomplete.' };
			return { matches: predicate.test(previewDomain), reason: null };
		} catch (err) {
			return {
				matches: false,
				reason: err instanceof Error ? err.message : 'Evaluation failed.',
			};
		}
	});
</script>

<div class="nimble-predicate-builder">
	<p class="nimble-predicate-builder__intro">
		Restrict when this rule fires. Every row below must match the actor's tags for the rule to
		apply. Leave empty to always apply.
	</p>

	{#each rows as row, index (index)}
		<div class="nimble-predicate-builder__row">
			<input
				class="nimble-predicate-builder__key"
				type="text"
				placeholder={suggestionKeys.length ? 'pick or type a tag key' : 'tag key (e.g. level)'}
				list={suggestionKeys.length ? datalistId : undefined}
				value={row.key}
				oninput={(e) => updateRow(index, { key: (e.target as HTMLInputElement).value })}
				onchange={emit}
			/>

			<select
				class="nimble-predicate-builder__operator"
				value={row.operator}
				onchange={(e) => updateOperator(index, (e.target as HTMLSelectElement).value as Operator)}
			>
				{#each Object.entries(OPERATOR_LABELS) as [op, label]}
					<option value={op}>{label}</option>
				{/each}
			</select>

			<div class="nimble-predicate-builder__value">
				{#if row.operator === 'is'}
					<input
						type="text"
						placeholder="value"
						value={row.valueText}
						oninput={(e) => updateRow(index, { valueText: (e.target as HTMLInputElement).value })}
						onchange={emit}
					/>
				{:else if row.operator === 'isOneOf'}
					<div class="nimble-predicate-builder__array">
						{#each row.valueArray as item, arrayIndex (arrayIndex)}
							<div class="nimble-predicate-builder__array-row">
								<input
									type="text"
									placeholder="value"
									value={item}
									oninput={(e) =>
										updateArrayValue(index, arrayIndex, (e.target as HTMLInputElement).value)}
									onchange={emit}
								/>
								<button
									type="button"
									class="nimble-button"
									data-button-variant="icon"
									aria-label="Remove value"
									onclick={() => removeArrayValue(index, arrayIndex)}
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/each}
						<button
							type="button"
							class="nimble-button"
							data-button-variant="basic"
							onclick={() => addArrayValue(index)}
						>
							<i class="fa-solid fa-plus"></i>
							Add value
						</button>
					</div>
				{:else if row.operator === 'isBetween'}
					<div class="nimble-predicate-builder__range">
						<input
							type="number"
							placeholder="min"
							value={row.valueRangeMin}
							oninput={(e) =>
								updateRow(index, { valueRangeMin: (e.target as HTMLInputElement).value })}
							onchange={emit}
						/>
						<span class="nimble-predicate-builder__range-sep">and</span>
						<input
							type="number"
							placeholder="max"
							value={row.valueRangeMax}
							oninput={(e) =>
								updateRow(index, { valueRangeMax: (e.target as HTMLInputElement).value })}
							onchange={emit}
						/>
					</div>
				{:else}
					<input
						type="number"
						placeholder="value"
						value={row.valueNumber}
						oninput={(e) => updateRow(index, { valueNumber: (e.target as HTMLInputElement).value })}
						onchange={emit}
					/>
				{/if}

				<small class="nimble-predicate-builder__hint">{OPERATOR_HINTS[row.operator]}</small>
			</div>

			<button
				type="button"
				class="nimble-button nimble-predicate-builder__delete"
				data-button-variant="icon"
				aria-label="Delete condition"
				onclick={() => deleteRow(index)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	{/each}

	<button type="button" class="nimble-button" data-button-variant="basic" onclick={addRow}>
		<i class="fa-solid fa-plus"></i>
		Add condition
	</button>

	{#if preview}
		<div
			class="nimble-predicate-builder__preview"
			class:nimble-predicate-builder__preview--match={preview.matches}
			class:nimble-predicate-builder__preview--no-match={!preview.matches}
		>
			<i
				class="fa-solid {preview.matches ? 'fa-circle-check' : 'fa-circle-xmark'}"
				aria-hidden="true"
			></i>
			<span>
				{preview.matches
					? 'Currently matches the parent actor.'
					: (preview.reason ?? 'Currently does not match the parent actor.')}
			</span>
		</div>
	{/if}

	{#if suggestionKeys.length}
		<datalist id={datalistId}>
			{#each suggestionKeys as key (key)}
				<option value={key}></option>
			{/each}
		</datalist>
	{/if}
</div>

<style lang="scss">
	.nimble-predicate-builder {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;

		&__intro {
			margin: 0 0 0.25rem 0;
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(7rem, 1fr) minmax(6rem, auto) minmax(10rem, 2fr) auto;
			gap: 0.375rem;
			align-items: start;
			padding: 0.375rem;
			background: var(--nimble-sheet-background, transparent);
			border-radius: 4px;
		}

		&__operator {
			padding: 0.125rem 0.375rem;
			font-size: var(--nimble-sm-text);
		}

		&__value {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__array-row {
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}

		&__range {
			display: flex;
			gap: 0.375rem;
			align-items: center;
		}

		&__range-sep {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
		}

		&__hint {
			color: var(--color-text-dark-secondary);
			font-size: var(--nimble-xs-text);
			font-style: italic;
		}

		&__preview {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			padding: 0.375rem 0.5rem;
			font-size: var(--nimble-sm-text);
			border-radius: 4px;

			&--match {
				background: var(--nimble-roll-success-background-color);
				color: var(--nimble-roll-success-color);
			}

			&--no-match {
				background: var(--nimble-roll-failure-background-color);
				color: var(--nimble-roll-failure-color);
			}
		}
	}
</style>
