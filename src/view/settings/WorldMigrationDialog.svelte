<script lang="ts">
	import type { WorldMigrationDialogProps } from './WorldMigrationDialog.types.ts';
	import { type CopyGroup, type CopyRow, checkState } from '../../migration/copyList.js';
	import { type MigrationReport, reportText } from '../../migration/migrationReport.js';
	import type { Holder } from '../../migration/planMigration.js';
	import localize from '#utils/localize.js';

	let { dialog, migration }: WorldMigrationDialogProps = $props();

	const t = (key: string, data: Record<string, string | number> = {}) =>
		localize(
			`NIMBLE.migration.window.${key}`,
			Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
		);
	const reportWord = (key: string, data: Record<string, string> = {}) =>
		localize(`NIMBLE.migration.report.${key}`, data);

	const reviewing = $derived(migration.phase === 'review');
	const running = $derived(migration.phase === 'running');
	const showBoxes = $derived(reviewing && migration.choose);
	const report: MigrationReport | undefined = $derived(migration.reports[migration.shownReport]);

	let open = $state.raw<Set<string>>(new Set());

	function toggleOpen(key: string) {
		const next = new Set(open);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		open = next;
	}

	function rowLabel(row: CopyRow): string {
		if (migration.sort === 'actor') return row.name;
		return holderLabel(row.holder, row.uuids.length, row.isActor);
	}

	function holderLabel(holder: Holder, count: number, isActor: boolean): string {
		switch (holder.kind) {
			case 'actor':
				return holder.actorName ?? '';
			case 'token':
				return t(count === 1 ? 'rowTokenOne' : 'rowToken', {
					count,
					name: holder.actorName ?? '',
					scene: holder.sceneName ?? '',
				});
			case 'compendium':
				return holder.packLabel ?? '';
			default:
				return isActor ? t('actorsSidebar') : t('itemsSidebar');
		}
	}

	function groupName(group: CopyGroup): string {
		if (group.kind === 'token')
			return t(group.tokens === 1 ? 'groupTokenOne' : 'groupToken', {
				name: group.name,
				count: group.tokens ?? 0,
			});
		if (group.kind === 'sidebar') return t('itemsSidebar');
		if (group.kind === 'compendium') return group.packLabel ?? '';
		return group.name;
	}

	function groupCount(group: CopyGroup): string {
		if (migration.sort === 'item')
			return t(group.count === 1 ? 'oneCopy' : 'copies', { count: group.count });
		return t(group.count === 1 ? 'oneItem' : 'items', { count: group.count });
	}

	function groupIcon(group: CopyGroup): string | null {
		if (group.kind === 'sidebar') return 'fa-solid fa-suitcase';
		if (group.kind === 'compendium') return 'fa-solid fa-book';
		return null;
	}

	function where(holder: Holder): string {
		switch (holder.kind) {
			case 'actor':
				return reportWord('whereActor', { name: holder.actorName ?? '' });
			case 'token':
				return reportWord('whereToken', {
					name: holder.actorName ?? '',
					scene: holder.sceneName ?? '',
				});
			case 'compendium':
				return reportWord('whereCompendium', { pack: holder.packLabel ?? '' });
			default:
				return reportWord('whereSidebar');
		}
	}

	function formatDate(iso: string): string {
		const date = new Date(iso);
		return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
	}

	async function copyReport() {
		if (!report) return;
		await game.clipboard.copyPlainText(reportText(report, reportWord, where));
		ui.notifications?.info(reportWord('copied'));
	}

	const progressPart = $derived(
		migration.progress ? localize(`NIMBLE.migration.progress.${migration.progress.part}`) : '',
	);
	const progressShare = $derived(
		migration.progress && migration.progress.total > 0
			? (migration.progress.done / migration.progress.total) * 100
			: 0,
	);
</script>

{#snippet titles(row: CopyRow, off: boolean)}
	<div class="nimble-world-migration__titles">
		{#each row.titles as entry (entry.title)}
			<span class:nimble-world-migration__skipped={off && !entry.always}>
				{#if entry.always}
					<i class="fa-solid fa-lock" data-tooltip={t('alwaysRuns')} aria-label={t('alwaysRuns')}
					></i>
				{/if}
				{entry.title}
			</span>
		{/each}
	</div>
{/snippet}

{#snippet rowCell(row: CopyRow)}
	{@const rowState = migration.rowState(row)}
	{#if showBoxes && row.excludable}
		<input
			type="checkbox"
			checked={checkState(row, migration.excluded) === 'on'}
			disabled={migration.locked}
			aria-label={t('migrateCopy', { name: rowLabel(row) })}
			onchange={() => migration.toggle(row.uuids)}
		/>
	{:else if running || rowState === 'off'}
		<span class="nimble-world-migration__state nimble-world-migration__state--{rowState}">
			{#if rowState === 'done'}<i class="fa-solid fa-check"></i>{/if}
			{#if rowState === 'now'}<i class="fa-solid fa-spinner fa-spin"></i>{/if}
			{#if rowState === 'off'}<i class="fa-solid fa-ban"></i>{/if}
			{t(`state.${rowState}`)}
		</span>
	{/if}
{/snippet}

<article class="nimble-sheet__body nimble-world-migration">
	{#if migration.phase === 'report'}
		<header class="nimble-world-migration__bar-row">
			<h2 class="nimble-world-migration__heading">{reportWord('title')}</h2>
			{#if migration.reports.length > 1}
				<select
					class="nimble-world-migration__report-select"
					aria-label={reportWord('pick')}
					bind:value={migration.shownReport}
				>
					{#each migration.reports as entry, index (entry.date)}
						<option value={index}>{formatDate(entry.date)} - Nimble {entry.systemVersion}</option>
					{/each}
				</select>
			{/if}
		</header>

		{#if report}
			<dl class="nimble-world-migration__facts">
				<dt>{reportWord('version')}</dt>
				<dd>
					{reportWord('versionValue', {
						version: report.systemVersion,
						from: String(report.fromSchema),
						to: String(report.toSchema),
					})}
				</dd>
				<dt>{reportWord('date')}</dt>
				<dd>{formatDate(report.date)}</dd>
				<dt>{reportWord('changed')}</dt>
				<dd>
					{reportWord('documents', { count: String(report.documents) })},
					{reportWord('copies', { count: String(report.copies) })}
				</dd>
				<dt>{reportWord('keptOut')}</dt>
				<dd>{report.keptOut.length}</dd>
				<dt>{reportWord('errors')}</dt>
				<dd class:nimble-world-migration__error={report.errors.length > 0}>
					{report.errors.length}
				</dd>
			</dl>
			{#if report.stoppedRun}
				<p class="nimble-world-migration__meta">
					{reportWord('stoppedRun', { date: formatDate(report.stoppedRun) })}
				</p>
			{/if}

			{#if report.keptOut.length > 0}
				<fieldset class="nimble-world-migration__box nimble-world-migration__section">
					<legend class="nimble-world-migration__legend">{reportWord('keptOutHeading')}</legend>
					{#each report.keptOut as copy, index (index)}
						<div class="nimble-world-migration__report-row">
							<span class="nimble-world-migration__name">{copy.name}</span>
							<span class="nimble-world-migration__meta">{where(copy.holder)}</span>
							<div class="nimble-world-migration__titles">{copy.titles.join(', ')}</div>
						</div>
					{/each}
					<p class="nimble-world-migration__meta">{reportWord('structureStillRan')}</p>
				</fieldset>
			{/if}

			{#if report.errors.length > 0}
				<fieldset class="nimble-world-migration__box nimble-world-migration__section">
					<legend class="nimble-world-migration__legend">{reportWord('errorsHeading')}</legend>
					{#each report.errors as error, index (index)}
						<div class="nimble-world-migration__report-row">
							<span class="nimble-world-migration__name nimble-world-migration__error">
								<i class="fa-solid fa-circle-exclamation"></i>
								{error.name}
							</span>
							{#if error.title}<span class="nimble-world-migration__meta">{error.title}</span>{/if}
							<pre class="nimble-world-migration__code">{error.message}</pre>
						</div>
					{/each}
				</fieldset>
			{/if}
		{:else}
			<p>{reportWord('none')}</p>
		{/if}
	{:else}
		{#if running && migration.progress}
			<div class="nimble-world-migration__progress">
				<div
					class="nimble-world-migration__well"
					role="progressbar"
					aria-valuemin="0"
					aria-valuemax={migration.progress.total}
					aria-valuenow={migration.progress.done}
				>
					<div class="nimble-world-migration__fill" style:width="{progressShare}%"></div>
					<span>
						{localize('NIMBLE.migration.progress.count', {
							done: String(migration.progress.done),
							total: String(migration.progress.total),
						})}
					</span>
				</div>
				<p class="nimble-world-migration__meta">
					{progressPart}. {localize('NIMBLE.migration.progress.keepOpen')}
				</p>
			</div>
		{:else if running}
			<p class="nimble-world-migration__meta">{localize('NIMBLE.migration.progress.checking')}</p>
		{:else}
			<p class="nimble-world-migration__lead">
				{migration.stoppedRun
					? t('continueLead', { version: game.system.version })
					: t(migration.actorCount > 0 ? 'lead' : 'leadNoActors', {
							version: game.system.version,
							copies: migration.copyCount,
							actors: migration.actorCount,
						})}
			</p>
		{/if}

		<div class="nimble-world-migration__bar-row">
			<div class="nimble-world-migration__sort" role="group" aria-label={t('sort')}>
				<button
					type="button"
					aria-pressed={migration.sort === 'item'}
					onclick={() => (migration.sort = 'item')}>{t('byItem')}</button
				>
				<button
					type="button"
					aria-pressed={migration.sort === 'actor'}
					onclick={() => (migration.sort = 'actor')}>{t('byActor')}</button
				>
			</div>
			{#if reviewing}
				<label class="nimble-world-migration__choose" data-tooltip={t('chooseHint')}>
					<input type="checkbox" bind:checked={migration.choose} disabled={migration.locked} />
					{t('chooseCopies')}
				</label>
			{/if}
		</div>

		<div class="nimble-world-migration__box nimble-world-migration__list">
			{#each migration.groups as group (group.key)}
				{@const isOpen = open.has(group.key)}
				{@const groupState = checkState(group, migration.excluded)}
				{@const icon = groupIcon(group)}
				<section class="nimble-world-migration__group">
					<div class="nimble-world-migration__group-head">
						<button
							type="button"
							class="nimble-world-migration__expand"
							aria-expanded={isOpen}
							onclick={() => toggleOpen(group.key)}
						>
							<i class="fa-solid fa-chevron-{isOpen ? 'down' : 'right'}" aria-hidden="true"></i>
							{#if icon}
								<span class="nimble-world-migration__img"><i class={icon}></i></span>
							{:else}
								<img
									class="nimble-world-migration__img"
									src={group.img ??
										(group.kind === 'item'
											? 'icons/svg/item-bag.svg'
											: 'icons/svg/mystery-man.svg')}
									alt=""
								/>
							{/if}
							<span class="nimble-world-migration__name">{groupName(group)}</span>
							{#if group.sceneName}
								<span class="nimble-world-migration__meta"
									>{t('inScene', { scene: group.sceneName })}</span
								>
							{/if}
						</button>
						<span class="nimble-world-migration__count">{groupCount(group)}</span>
						{#if running}
							{@const runState = migration.groupState(group)}
							<span class="nimble-world-migration__state nimble-world-migration__state--{runState}">
								{#if runState === 'done'}<i class="fa-solid fa-check" aria-label={t('state.done')}
									></i>{/if}
								{#if runState === 'now'}<i
										class="fa-solid fa-spinner fa-spin"
										aria-label={t('state.now')}
									></i>{/if}
							</span>
						{:else if showBoxes && groupState !== 'none'}
							<input
								type="checkbox"
								checked={groupState === 'on'}
								{@attach (node) => {
									node.indeterminate = groupState === 'mixed';
								}}
								disabled={migration.locked}
								aria-label={t('migrateCopy', { name: groupName(group) })}
								onchange={() => migration.toggle(group.uuids)}
							/>
						{/if}
					</div>
					{#if isOpen}
						<div class="nimble-world-migration__rows">
							{#each group.rows as row (row.key)}
								{@const off = row.excludable && checkState(row, migration.excluded) === 'off'}
								<div
									class="nimble-world-migration__row"
									class:nimble-world-migration__row--off={off}
								>
									<div>
										<span class="nimble-world-migration__name">{rowLabel(row)}</span>
										{#if row.matchedByName}
											<span
												class="nimble-world-migration__tag"
												data-tooltip={t('matchedByNameHint')}>{t('matchedByName')}</span
											>
										{/if}
										{#if row.isActor}
											<span class="nimble-world-migration__tag">{t('monster')}</span>
										{/if}
										{@render titles(row, off)}
									</div>
									{@render rowCell(row)}
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>

		{#if reviewing}
			<p class="nimble-world-migration__warn">
				<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
				{t('backup')}
			</p>
		{/if}
	{/if}
</article>

{#if reviewing}
	<footer class="nimble-sheet__footer nimble-world-migration__footer">
		<button
			class="nimble-button"
			data-button-variant="basic"
			type="button"
			onclick={() => dialog.close()}
		>
			<i class="fa-regular fa-clock"></i>
			{t('later')}
		</button>
		<button
			class="nimble-button nimble-world-migration__start"
			data-button-variant="basic"
			type="button"
			onclick={() => migration.start()}
		>
			<i class="fa-solid fa-play"></i>
			{migration.stoppedRun ? t('continue') : t('start')}
		</button>
	</footer>
{:else if migration.phase === 'report'}
	<footer class="nimble-sheet__footer nimble-world-migration__footer">
		{#if report}
			<button class="nimble-button" data-button-variant="basic" type="button" onclick={copyReport}>
				<i class="fa-regular fa-copy"></i>
				{reportWord('copy')}
			</button>
		{/if}
		<button
			class="nimble-button"
			data-button-variant="basic"
			type="button"
			onclick={() => dialog.close()}
		>
			<i class="fa-solid fa-check"></i>
			{reportWord('close')}
		</button>
	</footer>
{/if}

<style lang="scss">
	.nimble-world-migration {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		font-size: var(--nimble-sm-text);
		line-height: 1.3;
		color: var(--nimble-dark-text-color);

		p {
			margin: 0;
		}

		&__lead {
			font-size: var(--nimble-md-text);
			line-height: 1.35;
		}

		&__meta {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__heading {
			margin: 0;
			border: 0;
			font-size: var(--nimble-lg-text);
			font-weight: 900;
		}

		&__box {
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__section {
			margin: 0;
			min-width: 0;
			padding: 0.25rem 0.5rem 0.375rem;
		}

		&__legend {
			padding: 0 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 900;
			letter-spacing: 0.02em;
			text-transform: uppercase;
		}

		&__bar-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__report-select {
			width: auto;
		}

		&__sort {
			display: inline-flex;
			gap: 2px;
			padding: 2px;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 999px;

			button {
				all: unset;
				cursor: pointer;
				padding: 0.25rem 0.75rem;
				border-radius: 999px;
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: var(--nimble-dark-text-color);

				&[aria-pressed='true'] {
					background: var(--nimble-crimson);
					color: var(--nimble-navigation-active-text-color);
				}

				&:focus-visible {
					outline: 2px solid var(--nimble-input-focus-border-color, #ff6400);
				}
			}
		}

		&__choose {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			white-space: nowrap;

			input {
				margin: 0;
			}
		}

		&__list {
			padding: 0 0.5rem;
		}

		&__group + &__group {
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__group-head {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0;
		}

		&__expand {
			all: unset;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			min-width: 0;

			> i {
				width: 0.75rem;
				font-size: 0.7rem;
				text-align: center;
				color: var(--nimble-medium-text-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-input-focus-border-color, #ff6400);
			}

			.nimble-world-migration__name {
				font-weight: 700;
			}
		}

		&__img {
			display: grid;
			flex: none;
			place-items: center;
			width: 1.75rem;
			height: 1.75rem;
			object-fit: cover;
			background: var(--nimble-image-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
		}

		&__count {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__rows {
			display: flex;
			flex-direction: column;
			margin: 0 0 0.375rem 1.25rem;
			padding-left: 0.5rem;
			border-left: 2px solid var(--nimble-card-border-color);
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0;

			& + & {
				border-top: 1px dashed var(--nimble-card-border-color);
			}

			.nimble-world-migration__name {
				font-weight: 600;
			}

			&--off .nimble-world-migration__name {
				text-decoration: line-through;
				opacity: 0.65;
			}
		}

		&__titles {
			display: flex;
			flex-wrap: wrap;
			gap: 0.125rem 0.5rem;
			margin-top: 0.125rem;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			i {
				margin-right: 0.2rem;
				font-size: 0.6rem;
			}
		}

		&__skipped {
			text-decoration: line-through;
		}

		&__tag {
			margin-left: 0.375rem;
			padding: 0.05rem 0.3rem;
			font-size: var(--nimble-xxs-text);
			font-weight: 700;
			letter-spacing: 0.03em;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
		}

		&__state {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			white-space: nowrap;
			color: var(--nimble-medium-text-color);

			&--done {
				color: var(--nimble-roll-success-color);
			}

			&--now {
				font-weight: 700;
				color: var(--nimble-dark-text-color);
			}
		}

		&__warn {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			padding: 0.4rem 0.5rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			background: var(--nimble-warning-background-color);
			border: 1px solid var(--nimble-warning-border-color);
			border-radius: 4px;

			i {
				margin-top: 0.1rem;
				color: var(--nimble-warning-icon-color);
			}
		}

		&__progress {
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}

		&__well {
			position: relative;
			height: 1.375rem;
			overflow: hidden;
			background: hsl(0, 0%, 14%);
			border: 1px solid var(--nimble-resource-bar-border-color);
			border-radius: 4px;

			span {
				position: absolute;
				inset: 0;
				display: grid;
				place-items: center;
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				font-variant-numeric: tabular-nums;
				color: hsl(36, 53%, 86%);
				text-shadow: 0 1px 2px #000;
			}
		}

		&__fill {
			position: absolute;
			inset: 0 auto 0 0;
			background: linear-gradient(
				180deg,
				hsl(1, 55%, 42%),
				var(--nimble-crimson) 60%,
				hsl(1, 52%, 24%)
			);
			box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
			transition: width 0.25s ease-in-out;

			@media (prefers-reduced-motion: reduce) {
				transition: none;
			}
		}

		&__facts {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.2rem 0.75rem;
			margin: 0;

			dt {
				font-weight: 700;
				text-shadow: none;
			}

			dd {
				margin: 0;
				font-variant-numeric: tabular-nums;
			}
		}

		&__report-row {
			padding: 0.25rem 0;

			.nimble-world-migration__name {
				font-weight: 600;
			}
		}

		&__error {
			color: var(--nimble-validation-error-color);
		}

		&__code {
			margin: 0.25rem 0 0;
			padding: 0.3rem 0.4rem;
			font-family: 'Source Code Pro', monospace;
			font-size: var(--nimble-xs-text);
			white-space: pre-wrap;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 2px;
		}
	}

	.nimble-world-migration__footer {
		display: flex;
		gap: 0.5rem;
		--nimble-button-padding: 0.5rem 1rem;

		.nimble-button {
			flex: 1;
			justify-content: center;
		}

		.nimble-world-migration__start {
			flex: 2;
		}
	}
</style>
