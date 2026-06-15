<script lang="ts">
	import { SYSTEM_PATH } from '#system';
	import type { PdfPreviewDialogProps } from '#types/components/PdfPreviewDialog.js';
	import { extractCharacterData } from '../sheets/character/pdfExport/extractCharacterData.ts';
	import { pdfCoordinates as c } from '../sheets/character/pdfExport/pdfCoordinates.ts';

	let { actor, previewState }: PdfPreviewDialogProps = $props();

	let wrapperWidth = $state(0);
	const scale = $derived(wrapperWidth > 0 ? wrapperWidth / 612 : 1);
	const d = $derived(extractCharacterData(actor));
	const templateSrc = $derived(
		`${SYSTEM_PATH}/assets/pdf/${previewState.template === 'noLines' ? 'CharacterSheet-Full-NoLines.png' : 'CharacterSheet-Full.png'}`,
	);

	const ABILITY_KEYS = ['strength', 'dexterity', 'intelligence', 'will'] as const;
	const SKILL_KEYS = [
		'arcana',
		'examination',
		'finesse',
		'influence',
		'insight',
		'lore',
		'might',
		'naturecraft',
		'perception',
		'stealth',
	] as const;

	const col = c.linedTextArea;

	/** Convert PDF (x, y, fontSize) to an absolute CSS `style` string.
	 *  For center-aligned text (no maxWidth): centers element at x via translateX(-50%).
	 *  For left-aligned text (with maxWidth): anchors left edge at x. */
	function ts(x: number, y: number, fs: number, bold = false, mw?: number): string {
		const top = y - fs * 0.75;
		const weight = bold ? 'font-weight:bold;' : '';
		if (mw) {
			return `left:${x}px;top:${top}px;font-size:${fs}px;${weight}max-width:${mw}px;white-space:normal;`;
		}
		return `left:${x}px;top:${top}px;font-size:${fs}px;${weight}transform:translateX(-50%);white-space:nowrap;`;
	}
</script>

<article class="pdf-preview-dialog">
	<div class="pdf-preview-wrapper" bind:clientWidth={wrapperWidth} style="height:{792 * scale}px">
		{#if previewState.activeSheet === 'additional'}
			<!-- Additional sheet preview (programmatic, no PNG) -->
			<div
				class="pdf-sheet pdf-additional-page"
				style="transform:scale({scale});transform-origin:top left;"
			>
				<!-- Header -->
				<div class="pdf-add-header">
					<div class="pdf-add-header__cell pdf-add-header__cell--name">
						<span class="pdf-add-header__label">Name</span>
						<span class="pdf-add-header__value">{d.characterName}</span>
					</div>
					<div class="pdf-add-header__cell">
						<span class="pdf-add-header__label">Ancestry / Class / Level</span>
						<span class="pdf-add-header__value pdf-add-header__value--small"
							>{d.ancestryClassLevel}</span
						>
					</div>
					<div class="pdf-add-header__cell">
						<span class="pdf-add-header__label">Height / Weight / Speed</span>
						<span class="pdf-add-header__value pdf-add-header__value--small"
							>{d.heightWeightSpeed}</span
						>
					</div>
					<div class="pdf-add-header__cell pdf-add-header__cell--dice">
						<span class="pdf-add-header__label">Hit Dice</span>
						<span class="pdf-add-header__value">{d.hitDice}</span>
					</div>
				</div>
				<!-- Columns -->
				<div class="pdf-add-columns">
					{#each [0, 1, 2] as i}
						{@const colLineHeight = previewState.additionalLineHeights[i]}
						{@const colHeight = Math.floor(705 / colLineHeight) * colLineHeight}
						{@const isOverLimit = previewState.additionalOverLimit[i]}
						<div
							class="pdf-additional-column"
							class:pdf-additional-column--lined={previewState.template === 'lined'}
							style="line-height:{colLineHeight}px;height:{colHeight}px;--col-lh:{colLineHeight}px;"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html previewState.additionalColumnContent[i]}
							{#if isOverLimit}
								<span class="pdf-column__ellipsis">…</span>
							{/if}
						</div>
					{/each}
				</div>
				<!-- Logo -->
				<div class="pdf-add-logo">NIMBLE</div>
			</div>
		{:else}
			<!-- Main sheet preview -->
			<div class="pdf-sheet" style="transform:scale({scale});transform-origin:top left;">
				<img src={templateSrc} class="pdf-sheet__bg" alt="" />

				<!-- Header row -->
				<span
					class="pdf-text"
					style={ts(
						c.characterName.x,
						c.characterName.y,
						c.characterName.fontSize,
						true,
						c.characterName.maxWidth,
					)}>{d.characterName}</span
				>
				<span
					class="pdf-text"
					style={ts(
						c.ancestryClassLevel.x,
						c.ancestryClassLevel.y,
						c.ancestryClassLevel.fontSize,
						false,
						c.ancestryClassLevel.maxWidth,
					)}>{d.ancestryClassLevel}</span
				>
				<span
					class="pdf-text"
					style={ts(
						c.heightWeightSpeed.x,
						c.heightWeightSpeed.y,
						c.heightWeightSpeed.fontSize,
						false,
						c.heightWeightSpeed.maxWidth,
					)}>{d.heightWeightSpeed}</span
				>
				<span class="pdf-text" style={ts(c.hitDice.x, c.hitDice.y, c.hitDice.fontSize)}
					>{d.hitDice}</span
				>

				<!-- Combat stats -->
				<span class="pdf-text" style={ts(c.hitPoints.x, c.hitPoints.y, c.hitPoints.fontSize, true)}
					>{d.hitPoints}</span
				>
				<span class="pdf-text" style={ts(c.armor.x, c.armor.y, c.armor.fontSize, true)}
					>{d.armor}</span
				>
				<span
					class="pdf-text"
					style={ts(c.initiative.x, c.initiative.y, c.initiative.fontSize, true)}
					>{d.initiative}</span
				>
				<span class="pdf-text" style={ts(c.wounds.x, c.wounds.y, c.wounds.fontSize, true)}
					>{d.wounds}</span
				>

				<!-- Ability scores -->
				{#each ABILITY_KEYS as key}
					<span
						class="pdf-text"
						style={ts(c.abilities[key].x, c.abilities[key].y, c.abilities[key].fontSize, true)}
						>{d.abilities[key]}</span
					>
				{/each}

				<!-- Saving throw arrows -->
				{#each ABILITY_KEYS as key}
					{@const arrow = c.saveArrows[key]}
					{@const mode = d.saveRollModes[key]}
					{@const size = arrow.fontSize * 0.6}
					{#if mode > 0}
						<div
							class="pdf-arrow"
							style="left:{arrow.upX - size}px;top:{arrow.upY -
								size}px;border-left:{size}px solid transparent;border-right:{size}px solid transparent;border-bottom:{size *
								1.5}px solid black;"
						></div>
					{:else if mode < 0}
						<div
							class="pdf-arrow"
							style="left:{arrow.downX - size}px;top:{arrow.downY -
								size *
									0.5}px;border-left:{size}px solid transparent;border-right:{size}px solid transparent;border-top:{size *
								1.5}px solid black;"
						></div>
					{/if}
				{/each}

				<!-- Skills -->
				{#each SKILL_KEYS as key}
					<span
						class="pdf-text"
						style={ts(c.skills[key].x, c.skills[key].y, c.skills[key].fontSize)}
						>{d.skills[key]}</span
					>
				{/each}

				<!-- Column content -->
				{#each [0, 1, 2] as i}
					{@const colLineHeight = previewState.lineHeights[i]}
					{@const colBaseHeight = col.linesPerColumn * col.lineHeight + 28}
					{@const colHeight = Math.floor(colBaseHeight / colLineHeight) * colLineHeight}
					{@const isOverLimit = previewState.overLimit[i]}
					<div
						class="pdf-column"
						style="left:{col.leftMargin +
							i * (col.columnWidth + col.columnGap)}px;top:{col.startY}px;width:{col.columnWidth -
							4}px;line-height:{colLineHeight}px;height:{colHeight}px;"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html previewState.columnContent[i]}
						{#if isOverLimit}
							<span class="pdf-column__ellipsis">…</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</article>

<style lang="scss">
	.pdf-preview-dialog {
		padding: 0.5rem;
		overflow: hidden;
	}

	.pdf-preview-wrapper {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	.pdf-sheet {
		position: relative;
		width: 612px;
		height: 792px;

		&__bg {
			position: absolute;
			top: 0;
			left: 0;
			width: 612px;
			height: 792px;
		}
	}

	.pdf-text {
		position: absolute;
		font-family: Helvetica, Arial, sans-serif;
		color: black;
		line-height: 1;
	}

	.pdf-arrow {
		position: absolute;
		width: 0;
		height: 0;
	}

	.pdf-column {
		position: absolute;
		font-size: 6px;
		font-family: Helvetica, Arial, sans-serif;
		color: black;
		overflow: hidden;

		&__ellipsis {
			position: absolute;
			bottom: 0;
			right: 0;
			background: white;
			padding: 0 1px;
			line-height: 1.2;
			pointer-events: none;
		}

		:global(h1),
		:global(h2),
		:global(h3),
		:global(h4),
		:global(h5),
		:global(h6) {
			font-size: inherit;
			font-weight: bold;
			color: black;
			margin: 0;
			line-height: inherit;
		}

		:global(p),
		:global(ul),
		:global(ol),
		:global(li) {
			margin: 0;
			padding: 0;
		}
	}

	.pdf-additional-page {
		background: white;
	}

	.pdf-add-header {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		height: 47px;
		border: 0.5px solid black;
		display: flex;

		&__cell {
			flex: 1;
			padding: 3px 4px 2px;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			border-right: 0.5px solid black;
			overflow: hidden;

			&:last-child {
				border-right: none;
			}

			&--name {
				flex: 0 0 174px;
			}

			&--dice {
				flex: 0 0 80px;
				align-items: center;
				text-align: center;
			}
		}

		&__label {
			font-size: 4.5px;
			color: #888;
			font-family: Helvetica, Arial, sans-serif;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&__value {
			font-size: 9px;
			font-weight: bold;
			font-family: Helvetica, Arial, sans-serif;
			color: black;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;

			&--small {
				font-size: 7px;
				font-weight: normal;
			}
		}
	}

	.pdf-add-columns {
		position: absolute;
		top: 58px;
		left: 21px;
		right: 21px;
		bottom: 29px;
		display: flex;
		border: 0.3px solid #aaa;

		.pdf-additional-column {
			flex: 1;
			font-size: 6px;
			font-family: Helvetica, Arial, sans-serif;
			color: black;
			overflow: hidden;
			position: relative;
			border-right: 0.3px solid #aaa;

			&:last-child {
				border-right: none;
			}

			.pdf-column__ellipsis {
				position: absolute;
				bottom: 0;
				right: 0;
				background: white;
				padding: 0 1px;
				line-height: 1.2;
				pointer-events: none;
			}

			&--lined {
				background-image: repeating-linear-gradient(
					to bottom,
					transparent calc(var(--col-lh, 22px) - 0.5px),
					#ccc calc(var(--col-lh, 22px) - 0.5px),
					#ccc var(--col-lh, 22px)
				);
			}

			:global(h1),
			:global(h2),
			:global(h3),
			:global(h4),
			:global(h5),
			:global(h6) {
				font-size: inherit;
				font-weight: bold;
				color: black;
				margin: 0;
				line-height: inherit;
			}

			:global(p),
			:global(ul),
			:global(ol),
			:global(li) {
				margin: 0;
				padding: 0;
			}
		}
	}

	.pdf-add-logo {
		position: absolute;
		bottom: 8px;
		left: 0;
		right: 0;
		text-align: center;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 10px;
		font-weight: bold;
		color: black;
		letter-spacing: 0.15em;
	}
</style>
