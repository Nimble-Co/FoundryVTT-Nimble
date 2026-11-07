<!--
@component
The Core tab: the things that you roll (abilities, saves, skills), the speeds, and the proficiencies and defenses.
A roll mode from rules shows its mark next to the number. In edit mode the rolls rest and the outlines open the configure windows.
-->
<script lang="ts">
	import type { HeroCoreTabProps } from '#types/components/actorSheets/HeroCoreTab.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import RollModeMark from './RollModeMark.svelte';

	let { view, editing, perform, columns }: HeroCoreTabProps = $props();

	const skillRows = $derived(Math.ceil(view.skills.length / columns));
	const speedRows = $derived(Math.ceil(view.speeds.length / columns));
</script>

<div class="core" class:editing>
	<section>
		<GroupHeading
			label={view.text.abilitiesAndSaves}
			flush
			{editing}
			buttonGap={editing ? 'md' : 'sm'}
		>
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button configure"
					aria-label={view.text.configureStats}
					data-tooltip={view.text.configureStats}
					onclick={() => perform({ kind: 'configure', target: 'abilities' })}
				>
					<i class="fa-solid fa-gear"></i>{view.text.stats}
				</button>
				<button
					type="button"
					class="nimble-u-reset-button configure"
					aria-label={view.text.configureSaves}
					data-tooltip={view.text.configureSaves}
					onclick={() => perform({ kind: 'configure', target: 'saves' })}
				>
					<i class="fa-solid fa-gear"></i>{view.text.saves}
				</button>
			{/if}
		</GroupHeading>
		<div class="abilities">
			{#each view.abilities as ability (ability.key)}
				<div class="ability" style:--tone="var(--nimble-ability-{ability.key}-color)">
					<span class="tab">{ability.abbreviation}</span>
					<button
						type="button"
						class="nimble-u-reset-button check"
						aria-label={ability.check.label}
						data-tooltip={ability.check.label}
						disabled={editing}
						onclick={() => perform(ability.check.intent)}
					>
						{ability.check.mod}<RollModeMark mode={ability.check.rollMode} />
					</button>
					<button
						type="button"
						class="nimble-u-reset-button save"
						aria-label={ability.save.label}
						data-tooltip={ability.save.label}
						disabled={editing}
						onclick={() => perform(ability.save.intent)}
					>
						<span>{view.text.save}</span><b>{ability.save.mod}</b><RollModeMark
							mode={ability.save.rollMode}
						/>
					</button>
				</div>
			{/each}
		</div>
	</section>

	<section class="zone-holder">
		<GroupHeading label={view.text.skills} flush {editing} />
		{#if editing}
			<EditZone
				short={view.text.skills}
				label={view.text.configureSkills}
				onclick={() => perform({ kind: 'configure', target: 'skills' })}
			/>
		{/if}
		<div
			class="skills"
			style:grid-template-columns="repeat({columns}, 1fr)"
			style:grid-template-rows="repeat({skillRows}, auto)"
		>
			{#each view.skills as skill, index (skill.key)}
				<button
					type="button"
					class="nimble-u-reset-button skill"
					class:line={index % skillRows !== 0}
					style:--tone={skill.ability ? `var(--nimble-ability-${skill.ability}-color)` : undefined}
					aria-label={skill.label}
					data-tooltip={skill.label}
					data-row-id="skill-{skill.key}"
					disabled={editing}
					onclick={() => perform(skill.intent)}
				>
					<span class="ability-label">{skill.abilityAbbreviation}</span>
					<span class="name">{skill.name}</span>
					<span class="value">
						<RollModeMark mode={skill.rollMode} />
						<b>{skill.mod}</b>
						{#if skill.passive}<small>({skill.passive})</small>{/if}
					</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="zone-holder">
		<GroupHeading label={view.text.speed} flush {editing} />
		{#if editing}
			<EditZone
				short={view.text.speed}
				label={view.text.configureMovement}
				onclick={() => perform({ kind: 'configure', target: 'movement' })}
			/>
		{/if}
		<div
			class="speeds"
			style:grid-template-columns="repeat({columns}, 1fr)"
			style:grid-template-rows="repeat({speedRows}, auto)"
		>
			{#each view.speeds as speed, index (speed.type)}
				<div class="speed" class:line={index % speedRows !== 0}>
					<i class="speed-icon {speed.icon}" aria-hidden="true"></i>
					<span class="name">{speed.label}</span>
					<span class="value">
						{#if speed.note}<small class="speed-note">{speed.note}</small>{/if}
						<b>{speed.value}</b>
					</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<GroupHeading label={view.text.proficiencies} flush {editing} />
		<dl class="proficiencies">
			{#each view.proficiencies as row (row.label)}
				{@const configure = row.configure}
				<div class="row zone-holder">
					<dt>{row.label}</dt>
					<dd>{row.value}</dd>
					{#if editing && configure}
						<EditZone
							inline
							row
							short={row.label}
							label={configure.label}
							onclick={() => perform(configure.intent)}
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
		font: 700 0.75rem/1 var(--nimble-primary-font);
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
		font-size: 0.625rem;
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
		font-size: 0.688rem;
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
		font-size: 1.125rem;
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
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.save span {
		font-size: 0.688rem;
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
	.skills,
	.speeds {
		display: grid;
		grid-auto-flow: column;
		gap: 0 18px;
	}
	.skill,
	.speed {
		display: grid;
		grid-template-columns: 26px 1fr auto;
		gap: 8px;
		align-items: center;
		min-height: 28px;
		padding: 0 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink);
	}
	/* a line between two skills of a column: the eye goes from the name to the number at the far end */
	.skill.line,
	.speed.line {
		border-top: 1px solid var(--nimble-ui-soft);
	}
	.ability-label {
		font-size: 0.688rem;
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
	.speed-icon {
		font-size: 0.688rem;
		text-align: center;
		color: var(--nimble-ui-ink-dim);
	}
	.speed .name,
	.value .speed-note {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value .speed-note {
		font-size: 0.688rem;
		font-weight: 700;
		color: var(--nimble-ui-action);
	}
	.speed .value {
		min-width: 0;
		gap: 6px;
	}
	.proficiencies {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 6px 0 0;
		font-size: 0.813rem;
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
	button:disabled {
		cursor: default;
	}
	.editing button:disabled {
		pointer-events: none;
	}
</style>
