<script>
	import localize from '../../utils/localize.js';

	const { HUD, token } = $props();

	function toggleStatusEffect(statusId) {
		const actor = HUD.actor;
		if (!actor) return;

		const overlay = overlayStatuses.has(statusId);
		actor.toggleStatusEffect(statusId, { overlay });
	}

	async function clearAll(event) {
		event.preventDefault();
		event.stopPropagation();

		const removals = [];
		const conditions = CONFIG.statusEffects;

		for (const condition of conditions) {
			const existing = HUD.actor.effects.reduce((arr, e) => {
				if (e.statuses.has(condition.id)) {
					if (condition._id && e.id !== condition._id) {
						return arr;
					}
					arr.push(e.id);
				}
				return arr;
			}, []);

			if (existing.length) removals.push(...existing);
		}

		await HUD.actor.deleteEmbeddedDocuments('ActiveEffect', removals);
	}

	const statusEffects = CONFIG.statusEffects;
	const { active: activeStatuses, overlay: overlayStatuses } = HUD?.actor?.conditionsMetadata ?? {};
</script>

<div class="status-effects-container">
	{#each statusEffects as effect}
		<button
			class="condition-container"
			class:active={activeStatuses.has(effect.id)}
			onpointerdown={(e) => {
				e.preventDefault();
				toggleStatusEffect(effect.id);
			}}
		>
			<img src={effect.img} alt={effect.name} data-status-id={effect.id} />

			<h3 class="condition-title">
				{effect.name}
			</h3>
		</button>
	{/each}
</div>

<button class="clear-all-conditions" onclick={clearAll}>
	<i class="fa-solid fa-octagon-xmark"></i>
	{localize('NIMBLE.ui.clearAll')}
</button>

<style lang="scss">
	.status-effects-container {
		display: grid;
		grid-template-columns: repeat(3, minmax(8em, 1fr));
		gap: 0.75rem;
		padding: 0.75rem;
		padding-block-end: 0.5rem;
		font-size: var(--nimble-lg-text);
		line-height: 1.2rem;
		text-align: start;
		width: max-content;

		.active {
			img,
			h3 {
				font-weight: bold;
				color: var(--nimble-condition-hud-selected-color);
				margin: 0;
			}
		}
	}

	.condition-container {
		display: flex;
		position: relative;
		background-color: transparent;
		gap: 0.5rem;
		font-size: var(--nimble-md-text);
		align-items: center;
		margin-block: 0.125rem;
		border: none;
		color: var(--nimble-light-text-color);
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover,
		&:focus {
			outline: none;
			box-shadow: none;
			color: var(--nimble-condition-hud-selected-color);
		}

		h3 {
			border: none;
			margin: 0;
		}

		img {
			width: 2rem;
			height: 2rem;
			margin: 0;
			padding: 0;
			border: none;
			opacity: 1;
		}
	}

	.clear-all-conditions {
		position: absolute;
		bottom: 100%;
		right: -1px;
		padding: 0.25em;
		color: var(--nimble-dark-text-color);
		border: none;
		border-radius: 4px 4px 0 0;
		background-color: black;
		font-size: 1.25rem;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			color: lighten-color(var(--nimble-condition-hud-clear-all-color), 15);
			box-shadow: none;
		}
	}
</style>
