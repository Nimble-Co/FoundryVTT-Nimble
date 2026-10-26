<script lang="ts">
	import type { IncomingReactionEntryGroupsProps } from '#types/components/IncomingReactionEntryGroups.d.ts';

	let { groups, busy, text, onuse }: IncomingReactionEntryGroupsProps = $props();
</script>

{#each groups as group (group.actorUuid)}
	<div class="nimble-incoming-reaction-group">
		{#if group.name}
			<p class="nimble-incoming-reaction-group__actor">{group.name}</p>
		{/if}

		<ul class="nimble-incoming-reaction-list">
			{#each group.entries as entry (entry.id)}
				{@const cost = text.cost(entry)}
				<li>
					<button
						class="nimble-button nimble-incoming-reaction-button"
						type="button"
						disabled={busy}
						data-tooltip={text.tooltip(entry)}
						onclick={() => onuse(entry)}
					>
						<i class="nimble-incoming-reaction-button__icon {text.icon(entry)}" aria-hidden="true"
						></i>
						<span class="nimble-incoming-reaction-button__label">{text.label(entry)}</span>
						{#if cost}
							<span class="nimble-incoming-reaction-button__cost">{cost}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/each}

<style lang="scss">
	.nimble-incoming-reaction-group {
		&:not(:first-child) {
			margin-top: 0.375rem;
		}

		&__actor {
			margin: 0 0 0.1875rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-incoming-reaction-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nimble-incoming-reaction-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.25rem 0.5rem;
		font-size: var(--nimble-sm-text);
		text-align: left;

		&__icon {
			flex: none;
			line-height: 0;
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__cost {
			flex: none;
			margin-left: auto;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}
	}
</style>
