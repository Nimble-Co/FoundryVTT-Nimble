<!--
@component
The Core tab: the things that you roll (abilities, saves, skills) and the proficiencies and defenses.
A roll mode from rules shows its mark next to the number. In edit mode the rolls rest and the outlines open the configure windows.
-->
<script lang="ts">
	import EditZone from '../../parts/EditZone.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import type { HeroCoreView } from '../heroCoreTab.ts';
	import type { HeroPerform } from '../heroIntent.ts';
	import RollModeMark from './RollModeMark.svelte';
	import localize from '#utils/localize.js';

	interface Props {
		view: HeroCoreView;
		editing: boolean;
		perform: HeroPerform;
		/** 2 or 3 columns of skills: the width of the tab decides */
		skillColumns: number;
	}

	let { view, editing, perform, skillColumns }: Props = $props();

	const C = 'NIMBLE.actorSheet.hero.core';
	const skillRows = $derived(Math.ceil(view.skills.length / skillColumns));
</script>

<div class="core" class:editing>
	<section>
		<GroupHeading
			label={localize(`${C}.abilitiesAndSaves`)}
			flush
			{editing}
			buttonGap={editing ? 'md' : 'sm'}
		>
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button configure"
					aria-label={localize('NIMBLE.prompts.configureAbilityScores')}
					data-tooltip={localize('NIMBLE.prompts.configureAbilityScores')}
					onclick={() => perform({ kind: 'configure', target: 'abilities' })}
				>
					<i class="fa-solid fa-gear"></i>{localize(`${C}.stats`)}
				</button>
				<button
					type="button"
					class="nimble-u-reset-button configure"
					aria-label={localize('NIMBLE.prompts.configureSavingThrows')}
					data-tooltip={localize('NIMBLE.prompts.configureSavingThrows')}
					onclick={() => perform({ kind: 'configure', target: 'saves' })}
				>
					<i class="fa-solid fa-gear"></i>{localize(`${C}.saves`)}
				</button>
			{/if}
		</GroupHeading>
		<div class="abilities">
			{#each view.abilities as ability (ability.key)}
				{@const checkLabel = localize('NIMBLE.prompts.rollAbilityCheckSpecific', {
					ability: ability.name,
				})}
				{@const saveLabel = localize('NIMBLE.prompts.rollSavingThrowSpecific', {
					save: ability.name,
				})}
				<div class="ability" style:--tone="var(--nimble-ability-{ability.key}-color)">
					<span class="tab">{ability.abbreviation}</span>
					<button
						type="button"
						class="nimble-u-reset-button check"
						aria-label={checkLabel}
						data-tooltip={checkLabel}
						disabled={editing}
						onclick={() => perform(ability.check.intent)}
					>
						{ability.check.mod}<RollModeMark value={ability.check.rollMode} />
					</button>
					<button
						type="button"
						class="nimble-u-reset-button save"
						aria-label={saveLabel}
						data-tooltip={saveLabel}
						disabled={editing}
						onclick={() => perform(ability.save.intent)}
					>
						<span>{localize(`${C}.save`)}</span><b>{ability.save.mod}</b><RollModeMark
							value={ability.save.rollMode}
						/>
					</button>
				</div>
			{/each}
		</div>
	</section>

	<section class="zone-holder">
		<GroupHeading label={localize(`${C}.skills`)} flush {editing} />
		{#if editing}
			<EditZone
				short={localize(`${C}.skills`)}
				label={localize('NIMBLE.prompts.configureSkills')}
				onclick={() => perform({ kind: 'configure', target: 'skills' })}
			/>
		{/if}
		<div
			class="skills"
			style:grid-template-columns="repeat({skillColumns}, 1fr)"
			style:grid-template-rows="repeat({skillRows}, auto)"
		>
			{#each view.skills as skill, index (skill.key)}
				{@const label = localize('NIMBLE.prompts.rollSkillCheckSpecific', { skill: skill.name })}
				<button
					type="button"
					class="nimble-u-reset-button skill"
					class:line={index % skillRows !== 0}
					style:--tone="var(--nimble-ability-{skill.ability}-color)"
					aria-label={label}
					data-tooltip={label}
					data-row-id="skill-{skill.key}"
					disabled={editing}
					onclick={() => perform(skill.intent)}
				>
					<span class="ability-label">{skill.abilityAbbreviation}</span>
					<span class="name">{skill.name}</span>
					<span class="value">
						<RollModeMark value={skill.rollMode} />
						<b>{skill.mod}</b>
						{#if skill.passive}<small>({skill.passive})</small>{/if}
					</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<GroupHeading label={localize(`${C}.proficiencies`)} flush {editing} />
		<dl class="proficiencies">
			{#each view.proficiencies as row (row.label)}
				{@const configure = row.configure}
				<div class="row zone-holder">
					<dt>{row.label}</dt>
					<dd>
						{row.value}
						{#if row.note}<em>{row.note}</em>{/if}
					</dd>
					{#if editing && configure}
						<EditZone
							inline
							row
							short={row.label}
							label={localize('NIMBLE.prompts.configureItem', { name: row.label })}
							onclick={() => perform(configure)}
						/>
					{/if}
				</div>
			{/each}
		</dl>
	</section>
</div>

<style>
	.core {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.core.editing {
		gap: 24px;
	}
	.zone-holder {
		position: relative;
	}
	.configure {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 6px;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 4px;
		font: 700 0.857rem/1 var(--nimble-primary-font);
		letter-spacing: 0;
		text-transform: none;
		color: var(--nimble-ui-ink-muted);
	}
	.configure:hover,
	.configure:focus-visible {
		border-style: solid;
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
		color: var(--nimble-ui-ink);
		outline: none;
	}
	.configure i {
		font-size: 0.714rem;
	}
	.abilities {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 5px;
		margin-top: 6px;
	}
	.ability {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		overflow: hidden;
	}
	.tab {
		padding: 3px 0;
		background: color-mix(
			in srgb,
			var(--tone) var(--nimble-ability-tab-tone-mix),
			var(--nimble-ability-tab-base)
		);
		text-align: center;
		font-size: 0.786rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
		color: var(--nimble-ability-tab-ink);
	}
	.check {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 6px 0 4px;
		font-size: 1.286rem;
		font-weight: 600;
		line-height: 1.1;
		color: var(--nimble-ui-ink);
	}
	.save {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: 26px;
		border-top: 1px solid var(--nimble-ui-soft);
		font-size: 0.857rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.save span {
		font-size: 0.786rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.save b {
		color: var(--nimble-ui-ink);
	}
	.check:hover,
	.save:hover,
	.skill:hover {
		background: var(--nimble-ui-hover);
	}
	.skills {
		display: grid;
		grid-auto-flow: column;
		gap: 0 18px;
	}
	.skill {
		display: grid;
		grid-template-columns: 26px 1fr auto;
		gap: 8px;
		align-items: center;
		min-height: 28px;
		padding: 0 4px;
		font-size: 0.929rem;
		color: var(--nimble-ui-ink);
	}
	/* a line between two skills of a column: the eye goes from the name to the number at the far end */
	.skill.line {
		border-top: 1px solid var(--nimble-ui-soft);
	}
	.ability-label {
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-align: center;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--tone) var(--nimble-ui-tone-mix), #000);
	}
	.name {
		font-weight: 500;
	}
	.value {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.value small {
		font-weight: 500;
		color: var(--nimble-ui-ink-muted);
	}
	.proficiencies {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 6px 0 0;
		font-size: 0.929rem;
	}
	.editing .proficiencies {
		gap: 8px;
		margin-top: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 84px 1fr;
		gap: 0 12px;
		align-items: center;
		min-height: 26px;
	}
	dt {
		font-weight: 800;
		color: var(--nimble-ui-ink-dim);
	}
	dd {
		margin: 0;
		color: var(--nimble-ui-ink-muted);
	}
	dd em {
		margin-left: 6px;
		font-style: normal;
		font-weight: 700;
		color: var(--nimble-ui-action);
	}
	button:disabled {
		cursor: default;
	}
	.editing button:disabled {
		pointer-events: none;
	}
</style>
