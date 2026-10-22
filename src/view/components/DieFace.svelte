<script lang="ts">
	import type { DieFaceProps } from '#types/components/DieFace.d.ts';

	import localize from '#utils/localize.js';
	import { DIE_SIZE_CHAIN } from '#utils/spell/stepFormulaDieSize.js';

	const ARIA_LABEL_KEYS = {
		was: {
			crit: 'NIMBLE.dieFace.wasCrit',
			miss: 'NIMBLE.dieFace.wasMiss',
			none: 'NIMBLE.dieFace.was',
		},
		now: {
			crit: 'NIMBLE.dieFace.nowCrit',
			miss: 'NIMBLE.dieFace.nowMiss',
			none: 'NIMBLE.dieFace.now',
		},
	} as const;

	let { faces, value, outcome = null, discarded = false }: DieFaceProps = $props();

	// Foundry's own dice tooltip draws a d6 for a die size it has no icon for.
	let shape = $derived(DIE_SIZE_CHAIN.includes(faces) ? faces : 6);
	let ariaLabel = $derived(
		localize(ARIA_LABEL_KEYS[discarded ? 'was' : 'now'][outcome ?? 'none'], {
			value: String(value),
		}),
	);
</script>

<span
	class="nimble-die-face"
	class:nimble-die-face--d4={shape === 4}
	class:nimble-die-face--d6={shape === 6}
	class:nimble-die-face--d8={shape === 8}
	class:nimble-die-face--d10={shape === 10}
	class:nimble-die-face--d12={shape === 12}
	class:nimble-die-face--d20={shape === 20}
	class:nimble-die-face--crit={outcome === 'crit'}
	class:nimble-die-face--miss={outcome === 'miss'}
	class:nimble-die-face--discarded={discarded}
	role="img"
	aria-label={ariaLabel}
>
	<span class="nimble-die-face__number" aria-hidden="true">{value}</span>
</span>

<style lang="scss">
	.nimble-die-face {
		--die-face-fill: var(--nimble-die-face-fill);
		--die-face-number-color: var(--nimble-die-face-number-color);
		--die-face-y: 50%;

		position: relative;
		display: inline-block;
		flex: none;
		width: 1.875rem;
		height: 1.875rem;
		vertical-align: middle;
		color: var(--die-face-number-color);

		// The die icon is a mask, so its face lines stay visible in our fill colour. The
		// second layer fills the face lines behind the number, so two digits are not crossed.
		&::before {
			content: '';
			position: absolute;
			inset: 0;
			background: var(--die-face-fill);
			mask:
				var(--die-face-shape) center / contain no-repeat,
				radial-gradient(ellipse 27% 19% at 50% var(--die-face-y), #000 98%, transparent) no-repeat;
		}

		// The middle face is not at the vertical centre on every die, so each size sets its own.
		&--d4 {
			--die-face-shape: url('/icons/svg/d4-grey.svg');
			--die-face-y: 62%;
		}

		&--d6 {
			--die-face-shape: url('/icons/svg/d6-grey.svg');
			--die-face-y: 50%;
		}

		&--d8 {
			--die-face-shape: url('/icons/svg/d8-grey.svg');
			--die-face-y: 46%;
		}

		&--d10 {
			--die-face-shape: url('/icons/svg/d10-grey.svg');
			--die-face-y: 50%;
		}

		&--d12 {
			--die-face-shape: url('/icons/svg/d12-grey.svg');
			--die-face-y: 51%;
		}

		&--d20 {
			--die-face-shape: url('/icons/svg/d20-grey.svg');
			--die-face-y: 50%;
		}

		&--crit {
			--die-face-fill: var(--nimble-die-face-crit-fill);
			--die-face-number-color: var(--nimble-die-face-crit-number-color);
		}

		&--miss {
			--die-face-fill: var(--nimble-die-face-miss-fill);
			--die-face-number-color: var(--nimble-die-face-miss-number-color);
		}

		&--discarded {
			--die-face-fill: var(--nimble-die-face-discarded-fill);
			--die-face-number-color: var(--nimble-die-face-discarded-number-color);
		}

		&--discarded.nimble-die-face--crit {
			--die-face-fill: var(--nimble-die-face-discarded-crit-fill);
			--die-face-number-color: var(--nimble-die-face-discarded-crit-number-color);
		}

		&--discarded.nimble-die-face--miss {
			--die-face-fill: var(--nimble-die-face-discarded-miss-fill);
			--die-face-number-color: var(--nimble-die-face-discarded-miss-number-color);
		}

		&__number {
			position: absolute;
			top: var(--die-face-y);
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 0.75rem;
			font-weight: 800;
			line-height: 1;
			font-variant-numeric: lining-nums tabular-nums;
			text-box: trim-both cap alphabetic;
		}
	}
</style>
