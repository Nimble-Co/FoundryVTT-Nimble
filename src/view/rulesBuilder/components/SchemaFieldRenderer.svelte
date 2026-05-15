<script lang="ts">
	import { PredicateField } from '../../../models/fields/PredicateField.js';
	import type { RawPredicate } from '../../../etc/Predicate.js';
	import localize from '#utils/localize.js';
	import { createSchemaFieldRendererState } from '#view/rulesBuilder/components/SchemaFieldRendererState.svelte.js';
	import type { SchemaFieldRendererProps } from '#view/rulesBuilder/types.js';
	import TagGroup from '#view/components/TagGroup.svelte';
	import DocumentPicker from './DocumentPicker.svelte';
	import FormulaInput from './FormulaInput.svelte';
	import PredicateBuilder from './PredicateBuilder.svelte';
	import RichTextEditor from './RichTextEditor.svelte';
	// Self-import for recursive rendering (nested SchemaFields, ArrayField
	// elements). Svelte 5 requires this over the deprecated `<svelte:self>`;
	// dep-cruiser is configured to allow this specific cycle.
	import Self from './SchemaFieldRenderer.svelte';

	let {
		field,
		value,
		parentData,
		onChange,
		name,
		disabled = false,
		document,
	}: SchemaFieldRendererProps = $props();

	const { fields } = foundry.data;

	const state = createSchemaFieldRendererState(
		() => field,
		() => parentData,
		() => onChange,
		() => name,
	);

	state.setupUnknownWidgetWarning();
</script>

{#if !state.isHidden}
	{#if state.widget === 'formula'}
		<FormulaInput value={String(value ?? '')} onChange={(v) => onChange(v)} {disabled} />
	{:else if state.widget === 'diceFormula'}
		<FormulaInput value={String(value ?? '')} onChange={(v) => onChange(v)} {disabled} dice />
	{:else if state.widget === 'documentUuid'}
		<DocumentPicker
			value={String(value ?? '')}
			onChange={(v) => onChange(v)}
			{disabled}
			documentTypes={state.documentTypes}
		/>
	{:else if state.widget === 'richText' || field instanceof fields.HTMLField}
		<RichTextEditor
			value={String(value ?? '')}
			onChange={(v) => onChange(v)}
			{disabled}
			{document}
		/>
	{:else if state.widget === 'templateString'}
		<input
			class="nimble-template-string-input"
			type="text"
			value={String(value ?? '')}
			{disabled}
			onchange={state.emitString}
		/>
		<small class="nimble-field-hint">
			{localize('NIMBLE.rulesBuilder.templateValueHintBefore')}
			<code>{`{value}`}</code>
			{localize('NIMBLE.rulesBuilder.templateValueHintAfter')}
		</small>
	{:else if state.widget === 'predicate' || field instanceof PredicateField}
		<PredicateBuilder value={(value as RawPredicate) ?? {}} onChange={(v) => onChange(v)} />
	{:else if field instanceof fields.BooleanField}
		<input type="checkbox" checked={Boolean(value)} {disabled} onchange={state.emitBoolean} />
	{:else if field instanceof fields.NumberField}
		{@const numField = field as foundry.data.fields.NumberField}
		{@const isInt = (numField as unknown as { integer?: boolean }).integer === true}
		{@const allowsNegative = ((numField as unknown as { min?: number }).min ?? -Infinity) < 0}
		<input
			class="nimble-field-input"
			type="number"
			value={value === null || value === undefined ? '' : (value as number)}
			min={(numField as unknown as { min?: number }).min}
			max={(numField as unknown as { max?: number }).max}
			step={(numField as unknown as { step?: number }).step ?? (isInt ? 1 : undefined)}
			inputmode={isInt ? 'numeric' : 'decimal'}
			{disabled}
			onbeforeinput={(e) => {
				// `data` is the candidate insertion (null for deletions / IME).
				const data = (e as InputEvent).data;
				if (data == null) return;
				const allowed = isInt
					? allowsNegative
						? /^-?\d*$/
						: /^\d*$/
					: allowsNegative
						? /^-?\d*\.?\d*(?:[eE][+-]?\d*)?$/
						: /^\d*\.?\d*(?:[eE][+-]?\d*)?$/;
				const target = e.target as HTMLInputElement;
				const next =
					target.value.slice(0, target.selectionStart ?? target.value.length) +
					data +
					target.value.slice(target.selectionEnd ?? target.value.length);
				if (!allowed.test(next)) e.preventDefault();
			}}
			onchange={state.emitNumber}
		/>
	{:else if field instanceof fields.StringField}
		{@const choices = state.resolveChoices()}
		{#if choices}
			<select
				class="nimble-field-input"
				value={String(value ?? '')}
				{disabled}
				onchange={state.emitString}
			>
				{#if !(field as unknown as { required?: boolean }).required}
					<option value=""></option>
				{/if}
				{#each choices as [val, label]}
					<option value={val}>{label}</option>
				{/each}
			</select>
		{:else}
			<input
				class="nimble-field-input"
				type="text"
				value={String(value ?? '')}
				{disabled}
				onchange={state.emitString}
			/>
		{/if}
	{:else if field instanceof fields.ArrayField}
		{@const elementField = (field as unknown as { element: foundry.data.fields.DataField.Any })
			.element}
		{#if elementField instanceof fields.StringField}
			{@const elementChoices = (() => {
				const raw = (elementField as unknown as { choices?: unknown }).choices;
				if (raw == null) return null;
				const evaluated = typeof raw === 'function' ? (raw as () => unknown)() : raw;
				if (Array.isArray(evaluated)) {
					return (evaluated as string[]).map((v) => ({ value: v, label: v }));
				}
				if (evaluated && typeof evaluated === 'object') {
					return Object.entries(evaluated as Record<string, string>).map(([k, label]) => ({
						value: k,
						label: typeof label === 'string' ? label : k,
					}));
				}
				return null;
			})()}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<string | number>}

			{#if elementChoices}
				<TagGroup
					options={elementChoices}
					selectedOptions={arrValue}
					{disabled}
					toggleOption={async (v) => state.toggleArrayValue(arrValue, v)}
				/>
			{:else}
				<div class="nimble-string-list">
					{#each arrValue as item, i (i)}
						<div class="nimble-string-list__row">
							<Self
								field={elementField}
								value={item}
								{parentData}
								name={`${name}[${i}]`}
								{disabled}
								{document}
								onChange={(v) => {
									const next = [...arrValue];
									next[i] = v as string;
									onChange(next);
								}}
							/>
							<button
								type="button"
								class="nimble-button"
								data-button-variant="icon"
								aria-label={localize('NIMBLE.rulesBuilder.remove')}
								onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
							>
								<i class="fa-solid fa-xmark"></i>
							</button>
						</div>
					{/each}
					<button
						type="button"
						class="nimble-button"
						data-button-variant="basic"
						onclick={() => onChange([...arrValue, ''])}
					>
						<i class="fa-solid fa-plus"></i>
						{localize('NIMBLE.rulesBuilder.addValue')}
					</button>
				</div>
			{/if}
		{:else if elementField instanceof fields.NumberField}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<number | null>}
			<div class="nimble-string-list">
				{#each arrValue as item, i (i)}
					<div class="nimble-string-list__row">
						<Self
							field={elementField}
							value={item}
							{parentData}
							name={`${name}[${i}]`}
							{disabled}
							onChange={(v) => {
								const next = [...arrValue];
								next[i] = v as number | null;
								onChange(next);
							}}
						/>
						<button
							type="button"
							class="nimble-button"
							data-button-variant="icon"
							aria-label={localize('NIMBLE.rulesBuilder.remove')}
							onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
						>
							<i class="fa-solid fa-xmark"></i>
						</button>
					</div>
				{/each}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={() => onChange([...arrValue, 0])}
				>
					<i class="fa-solid fa-plus"></i>
					{localize('NIMBLE.rulesBuilder.addValue')}
				</button>
			</div>
		{:else if elementField instanceof fields.SchemaField}
			{@const arrValue = (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>}
			<div class="nimble-array-of-schema">
				{#each arrValue as entry, i (i)}
					<fieldset class="nimble-array-of-schema__entry">
						<legend>#{i + 1}</legend>
						{#each Object.entries((elementField as unknown as { fields: Record<string, foundry.data.fields.DataField.Any> }).fields) as [childName, childField]}
							<div class="nimble-field-row">
								<span class="nimble-field-row__label">{childName}</span>
								<Self
									field={childField}
									value={entry[childName]}
									parentData={entry}
									name={childName}
									{disabled}
									{document}
									onChange={(v) => {
										const next = [...arrValue];
										next[i] = { ...entry, [childName]: v };
										onChange(next);
									}}
								/>
							</div>
						{/each}
						<button
							type="button"
							class="nimble-button"
							data-button-variant="basic"
							onclick={() => onChange(arrValue.filter((_, idx) => idx !== i))}
						>
							<i class="fa-solid fa-trash"></i>
							{localize('NIMBLE.rulesBuilder.remove')}
						</button>
					</fieldset>
				{/each}
				<button
					type="button"
					class="nimble-button"
					data-button-variant="basic"
					onclick={() => onChange([...arrValue, {}])}
				>
					<i class="fa-solid fa-plus"></i>
					{localize('NIMBLE.rulesBuilder.addEntry')}
				</button>
			</div>
		{:else}
			<div class="nimble-hint nimble-hint--warning nimble-renderer-error">
				<i class="nimble-hint__icon fa-solid fa-circle-exclamation"></i>
				<span>
					Field <code>{name}</code> uses an unsupported ArrayField element type. The renderer's
					closed widget catalog needs an extension to handle it — see
					<code>SchemaFieldRenderer.svelte</code>.
				</span>
			</div>
			{(() => {
				console.warn(
					`Nimble | SchemaFieldRenderer has no widget for ArrayField<${(elementField as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}> at field "${name}".`,
				);
				return '';
			})()}
		{/if}
	{:else if field instanceof fields.SchemaField}
		<fieldset class="nimble-schema-field">
			{#each Object.entries((field as unknown as { fields: Record<string, foundry.data.fields.DataField.Any> }).fields) as [childName, childField]}
				<div class="nimble-field-row">
					<span class="nimble-field-row__label">{childName}</span>
					<Self
						field={childField}
						value={(value as Record<string, unknown> | undefined)?.[childName]}
						parentData={(value as Record<string, unknown> | undefined) ?? {}}
						name={childName}
						{disabled}
						{document}
						onChange={(v) =>
							onChange({
								...((value as Record<string, unknown>) ?? {}),
								[childName]: v,
							})}
					/>
				</div>
			{/each}
		</fieldset>
	{:else}
		<div class="nimble-hint nimble-hint--warning nimble-renderer-error">
			<i class="nimble-hint__icon fa-solid fa-circle-exclamation"></i>
			<span>
				Field <code>{name}</code> of type
				<code>
					{(field as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}
				</code>
				has no widget. Add one to <code>SchemaFieldRenderer.svelte</code>.
			</span>
		</div>
		{(() => {
			console.warn(
				`Nimble | SchemaFieldRenderer has no widget for "${name}" (${(field as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}).`,
			);
			return '';
		})()}
	{/if}
{/if}

<style lang="scss">
	.nimble-field-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}

	.nimble-template-string-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-input-background-color, var(--nimble-box-background-color));
		color: inherit;
		border: var(--nimble-input-border, 1px solid var(--nimble-accent-color));
		border-radius: 4px;
	}

	.nimble-field-hint {
		display: block;
		margin-top: 0.125rem;
		color: var(--color-text-dark-secondary);
		font-size: var(--nimble-xs-text);
	}

	.nimble-string-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&__row {
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}
	}

	.nimble-array-of-schema {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__entry {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
		}
	}

	.nimble-schema-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;
	}

	.nimble-field-row {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--color-text-dark-secondary);
		}
	}
</style>
