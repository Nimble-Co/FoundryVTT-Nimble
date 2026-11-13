<script>
	import { getContext, setContext } from 'svelte';
	import { getNodeComponent } from '../../dataPreparationHelpers/effectTree/getNodeComponent.js';
	import localize from '../../../utils/localize.js';
	import { isDamageGroup } from './damageGroup.ts';
	import ApplyDamageButton from './ApplyDamageButton.svelte';
	import LatchedMissButton from './LatchedMissButton.svelte';
	import DamageBackLines from './DamageBackLines.svelte';
	import DefendReactions from './DefendReactions.svelte';
	import IncomingReactionPrompts from './IncomingReactionPrompts.svelte';

	// Provide getNodeComponent via context to avoid circular dependencies
	// (SavingThrowNode needs to render child nodes but can't import getNodeComponent directly)
	setContext('getNodeComponent', getNodeComponent);

	let messageDocument = getContext('messageDocument');

	let nodes = messageDocument?.effectNodes ?? [];
	const EFFECT_ROW_TYPES = ['applyEffect', 'wound'];
	const isEffectRows = (group) => EFFECT_ROW_TYPES.includes(group[0]?.type);
	const firstDamageGroup = nodes.find((group) => group.length && isDamageGroup(group));
</script>

{#each nodes as nodeGroup}
	{#if nodeGroup.length}
		<section
			class="nimble-card-section"
			class:nimble-card-section--apply-effects={isEffectRows(nodeGroup)}
		>
			{#if isEffectRows(nodeGroup)}
				<header class="nimble-section-header">
					<h3 class="nimble-heading" data-heading-variant="section">
						{localize('NIMBLE.chat.applyEffect.heading')}
					</h3>
				</header>
			{/if}

			{#each nodeGroup as node}
				{@const Component = getNodeComponent(node.type)}

				<section class="nimble-effect">
					<Component {node} />
				</section>
			{/each}

			{#if isDamageGroup(nodeGroup)}
				<IncomingReactionPrompts place="roll" />

				<DamageBackLines />

				{#if nodeGroup === firstDamageGroup}
					<DefendReactions />
				{/if}

				{#if game.user?.isGM}
					<section class="nimble-effect">
						<LatchedMissButton />
						<ApplyDamageButton nodes={nodeGroup} />
					</section>
				{/if}
			{/if}
		</section>
	{/if}
{:else}
	<section class="nimble-card-section">
		<p>{localize('NIMBLE.chatEffects.noEffect')}</p>
	</section>
{/each}

{#if !firstDamageGroup && (messageDocument?.reactive?.system?.damageBack ?? []).length}
	<!-- A save-only attack has no damage group, so its lines go after the last section. -->
	<section class="nimble-card-section">
		<DamageBackLines />
	</section>
{/if}

<style lang="scss">
	.nimble-effect {
		--nimble-hint-block-end-margin: 0;

		padding: 0.5rem;

		&:not(:last-of-type) {
			padding-bottom: 0;
		}
	}

	.nimble-card-section {
		--nimble-card-section-padding: 0;

		&--apply-effects {
			--nimble-card-section-padding: 0.5rem;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;

			.nimble-effect {
				padding: 0;
			}
		}
	}
</style>
