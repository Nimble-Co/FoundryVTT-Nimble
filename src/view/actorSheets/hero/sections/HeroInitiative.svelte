<!--
@component
Roll Initiative, in all states: it rolls in combat, adds the hero first when the auto-add setting is on,
and rolls to chat out of combat. It waits while a roll is on its way.
-->
<script lang="ts">
	import type { HeroPerform } from '../heroIntent.ts';
	import type { HeroRailView } from '../heroRail.ts';
	import RollModeMark from './RollModeMark.svelte';

	interface Props {
		initiative: HeroRailView['initiative'];
		editing: boolean;
		perform: HeroPerform;
	}

	let { initiative, editing, perform }: Props = $props();
</script>

<button
	type="button"
	class="nimble-u-reset-button initiative"
	aria-busy={!initiative.intent}
	disabled={editing || !initiative.intent}
	onclick={() => initiative.intent && perform(initiative.intent)}
>
	<i class="fa-solid fa-dice-d20"></i>{initiative.label}
	<span class="mod">{initiative.mod}<RollModeMark value={initiative.rollMode} /></span>
</button>

<style>
	.initiative {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		height: 34px;
		border-radius: 4px;
		background: var(--nimble-crimson);
		font-size: 0.929rem;
		font-weight: 800;
		color: #fff;
	}
	.initiative:hover {
		filter: brightness(1.15);
	}
	.mod {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 5px;
		border-radius: 3px;
		background: rgb(0 0 0 / 25%);
	}
	.initiative:disabled {
		opacity: 0.4;
		filter: saturate(0.35);
		pointer-events: none;
	}
</style>
