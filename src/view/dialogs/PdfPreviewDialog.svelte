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
	const additionalTemplateSrc = $derived(
		`${SYSTEM_PATH}/assets/pdf/${previewState.template === 'noLines' ? 'CharacterSheet-Additional-NoLines.png' : 'CharacterSheet-Additional.png'}`,
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
	const add = c.additionalSheet;

	/** Page 2 only renders when at least one additional column has visible text */
	const hasAdditionalContent = $derived(
		previewState.additionalColumnContent.some((html) => html.replace(/<[^>]*>/g, '').trim() !== ''),
	);

	/** Additional column height: same bottom as main sheet columns, starting from add column startY */
	const addColBaseHeight =
		col.startY + col.linesPerColumn * col.lineHeight + 28 - add.linedTextArea.startY;

	/** Convert PDF (x, y, fontSize) to an absolute CSS `style` string.
	 *  Center-aligned (no maxWidth): centers element at x via translateX(-50%).
	 *  Left-aligned (with maxWidth): anchors left edge at x. */
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
	<div class="pdf-preview-scroll" bind:clientWidth={wrapperWidth}>
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
