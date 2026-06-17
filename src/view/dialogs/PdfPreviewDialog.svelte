<script lang="ts">
	import type { PdfPreviewDialogProps } from '#types/components/PdfPreviewDialog.js';
	import { pdfCoordinates as c } from '../sheets/character/pdfExport/pdfCoordinates.ts';
	import {
		ABILITY_KEYS,
		SKILL_KEYS,
		add,
		addColBaseHeight,
		col,
		ts,
	} from './PdfPreviewDialog.utils.ts';
	import { createPdfPreviewDialogState } from './PdfPreviewDialogState.svelte.ts';

	let { actor, previewState }: PdfPreviewDialogProps = $props();

	const state = createPdfPreviewDialogState(
		() => actor,
		() => previewState,
	);
	const d = $derived(state.characterData);
	const scale = $derived(state.scale);
	const templateSrc = $derived(state.templateSrc);
	const additionalTemplateSrc = $derived(state.additionalTemplateSrc);
	const hasAdditionalContent = $derived(state.hasAdditionalContent);
</script>

<article class="pdf-preview-dialog">
	<div class="pdf-preview-scroll" bind:clientWidth={state.wrapperWidth}>
		<!-- Page 1: Main Sheet -->
		<div class="pdf-page-wrapper" style="height:{792 * scale}px">
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
		</div>

		<!-- Page 2: Additional Sheet — only rendered when content exists -->
		{#if hasAdditionalContent}
			<div class="pdf-page-separator"></div>
			<div class="pdf-page-wrapper" style="height:{792 * scale}px">
				<div class="pdf-sheet" style="transform:scale({scale});transform-origin:top left;">
					<!-- Dedicated additional-sheet template (stats section removed in image editor) -->
					<img src={additionalTemplateSrc} class="pdf-sheet__bg" alt="" />

					<!-- Header — same positions as the main sheet -->
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

					<!-- Additional sheet columns -->
					{#each [0, 1, 2] as i}
						{@const colLineHeight = previewState.additionalLineHeights[i]}
						{@const colHeight = Math.floor(addColBaseHeight / colLineHeight) * colLineHeight}
						{@const isOverLimit = previewState.additionalOverLimit[i]}
						{@const colTop =
							add.linedTextArea.startY - (colLineHeight - add.linedTextArea.fontSize) / 2}
						<div
							class="pdf-column"
							style="left:{col.leftMargin +
								i * (col.columnWidth + col.columnGap)}px;top:{colTop}px;width:{col.columnWidth -
								4}px;line-height:{colLineHeight}px;height:{colHeight}px;"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html previewState.additionalColumnContent[i]}
							{#if isOverLimit}
								<span class="pdf-column__ellipsis">…</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</article>

<style lang="scss">
	.pdf-preview-dialog {
		padding: 0.5rem;
		overflow-y: auto;
		max-height: 100%;
	}

	.pdf-preview-scroll {
		display: flex;
		flex-direction: column;
	}

	.pdf-page-wrapper {
		position: relative;
		width: 100%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.pdf-page-separator {
		height: 12px;
		background: #888;
		opacity: 0.3;
		flex-shrink: 0;
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
		font-family: Helvetica, Arial, sans-serif !important;
		color: black !important;
		line-height: 1 !important;
		z-index: 2;
	}

	.pdf-arrow {
		position: absolute;
		width: 0;
		height: 0;
	}

	.pdf-column {
		position: absolute;
		font-size: 6px !important;
		font-family: Helvetica, Arial, sans-serif !important;
		color: black !important;
		overflow: hidden;
		z-index: 3;

		// Reset every descendant — FoundryVTT HTML contains links and content-link
		// elements with their own explicit color, font-size, background, and decoration.
		:global(*) {
			color: black !important;
			font-family: Helvetica, Arial, sans-serif !important;
			font-size: inherit !important;
			line-height: inherit !important;
			background: transparent !important;
			text-decoration: none !important;
			margin: 0 !important;
			padding: 0 !important;
		}

		:global(h1),
		:global(h2),
		:global(h3),
		:global(h4),
		:global(h5),
		:global(h6) {
			font-weight: bold !important;
		}
	}

	.pdf-column__ellipsis {
		position: absolute;
		bottom: 0;
		right: 0;
		background: white !important;
		padding: 0 1px;
		line-height: 1.2;
		pointer-events: none;
	}
</style>
