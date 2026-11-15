import { SYSTEM_ID } from '#system';
import type { MigrationReport } from '../migration/migrationReport.js';
import localize from '../utils/localize.js';
import { changedSettings, type SettingInfo } from './changedSettings.js';
import { supportLog } from './installSupportLog.js';
import { migrationSummary, type SupportReport } from './supportReport.js';

function supportWord(key: string, data: Record<string, string> = {}): string {
	return localize(`NIMBLE.support.report.${key}`, data);
}

/** "Chrome/142 - Windows 10.0.0 x86 (64-bit)", from Foundry's own support details. */
async function browserText(): Promise<string> {
	try {
		const details =
			(await foundry.applications.sidebar.apps.SupportDetails.generateSupportReport()) as {
				client: string;
				os: string;
			};
		return `${details.client} - ${details.os}`;
	} catch {
		return navigator.userAgent;
	}
}

/** A setting typed by a data field keeps its default on the field. */
function defaultOf(setting: { default?: unknown; type?: unknown }): unknown {
	if (setting.default !== undefined) return setting.default;
	const field = setting.type as { getInitialValue?: (data: object) => unknown } | undefined;
	return typeof field?.getInitialValue === 'function' ? field.getInitialValue({}) : undefined;
}

function settingInfos(): SettingInfo[] {
	return [...game.settings.settings.values()]
		.filter((setting) => setting.namespace === SYSTEM_ID)
		.flatMap((setting) => {
			try {
				return [
					{
						key: setting.key,
						scope: String(setting.scope),
						name: setting.name ? game.i18n.localize(setting.name) : '',
						default: defaultOf(setting),
						value: game.settings.get(SYSTEM_ID as 'core', setting.key as 'rollMode'),
					},
				];
			} catch {
				return [];
			}
		});
}

/** The actor of the first selected token. */
function selectedActor(): Actor.Implementation | null {
	return canvas?.tokens?.controlled?.[0]?.actor ?? null;
}

async function collectSupportReport({ withActor }: { withActor: boolean }): Promise<SupportReport> {
	const actor = withActor ? selectedActor() : null;
	const reports = game.settings.get(
		SYSTEM_ID as 'core',
		'migrationReports' as 'rollMode',
	) as unknown as MigrationReport[] | null;
	return {
		made: new Date().toISOString(),
		user: { name: game.user?.name ?? '', isGM: game.user?.isGM ?? false },
		foundry: game.release?.version ?? String(game.version),
		nimble: game.system.version,
		schema: Number(game.settings.get(SYSTEM_ID as 'core', 'worldSchemaVersion' as 'rollMode')) || 0,
		browser: await browserText(),
		world: {
			title: game.world.title,
			actors: game.actors?.size ?? 0,
			items: game.items?.size ?? 0,
			scenes: game.scenes?.size ?? 0,
		},
		modules: [...game.modules.values()]
			.filter((module) => module.active)
			.map((module) => ({ id: module.id, version: String(module.version ?? '') }))
			.sort((a, b) => a.id.localeCompare(b.id)),
		settings: changedSettings(settingInfos(), supportWord),
		errors: supportLog.entries,
		dropped: supportLog.dropped,
		migration: migrationSummary(Array.isArray(reports) ? reports[0] : undefined),
		actor: actor
			? { name: actor.name, type: actor.type, json: JSON.stringify(actor.toObject()) }
			: null,
	};
}

export { collectSupportReport, selectedActor, supportWord };
