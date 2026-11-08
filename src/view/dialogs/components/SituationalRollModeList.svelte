<!--
@component
The Situational Modifiers of a roll window: one tick per advantage or disadvantage the roller can use.
A tick moves the Roll Mode slider by its value, and an untick gives back what it took.
-->
<script lang="ts">
	import type {
		SituationalRollModeListOption,
		SituationalRollModeListProps,
	} from '#types/components/SituationalRollModeList.d.ts';
	import localize from '#utils/localize.js';
	import { tickRollMode } from '#utils/rolls/rollModeTicks.ts';

	let {
		options,
		value = $bindable(0),
		applied = $bindable({}),
	}: SituationalRollModeListProps = $props();

	const TEXT = 'NIMBLE.checkRollDialog.situationalRollMode';

	function isSelected(option: SituationalRollModeListOption): boolean {
		return option.key in applied;
	}

	function toggle(option: SituationalRollModeListOption, checked: boolean): void {
		const next = tickRollMode(value, applied, option, checked);
		value = next.mode;
		applied = next.applied;
	}

	// An unticked row shows what it offers; a ticked row shows what it moved,
	// which the ends of the slider can make nothing.
	function shownValue(option: SituationalRollModeListOption): number {
		return applied[option.key] ?? option.value;
	}

	function valueText(option: SituationalRollModeListOption): string {
		const shown = shownValue(option);
		if (shown === 0) return localize(`${TEXT}.noEffect`);
		if (shown > 0) return localize(`${TEXT}.advantage`, { count: shown });
		return localize(`${TEXT}.disadvantage`, { count: Math.abs(shown) });
	}

	function direction(option: SituationalRollModeListOption): 'bonus' | 'penalty' | 'none' {
		const shown = shownValue(option);
		if (shown === 0) return 'none';
		return shown < 0 ? 'penalty' : 'bonus';
	}
</script>

{#if options.length}
	<section class="nimble-situational">
		<h5 class="lb">{localize(`${TEXT}.heading`)}</h5>

		<ul class="nimble-situational__list">
			{#each options as option (option.key)}
				<li>
					<label
						class="check nimble-situational__option"
						class:nimble-situational__option--selected={isSelected(option)}
						data-direction={direction(option)}
					>
						<input
							type="checkbox"
							checked={isSelected(option)}
							onchange={(event) => toggle(option, event.currentTarget.checked)}
						/>
						{#if option.icon}
							<img class="nimble-situational__icon" src={option.icon} alt="" />
						{:else}
							<span class="nimble-situational__icon" aria-hidden="true"></span>
						{/if}
						<span class="nimble-situational__label">{option.label}</span>
						<span class="nimble-situational__value">{valueText(option)}</span>
					</label>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style lang="scss">
	.nimble-situational {
		&__list {
			display: flex;
			flex-direction: column;
			gap: 4px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__option {
			display: flex;
			align-items: center;
			gap: 8px;
			min-height: 30px;
			padding: 3px 8px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
			cursor: pointer;

			&:hover {
				border-color: var(--nimble-ui-highlight);
			}

			&:focus-within {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			&--selected {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-soft);
			}
		}

		&__icon {
			flex: none;
			width: 22px;
			height: 22px;
			border: 0;
			border-radius: 3px;
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__value {
			flex: none;
			font-weight: 700;
			color: var(--nimble-ui-ink-muted);
		}

		&__option[data-direction='bonus'] &__value {
			color: var(--nimble-ui-action);
		}

		&__option[data-direction='penalty'] &__value {
			color: var(--nimble-ui-warn);
		}
	}
</style>
