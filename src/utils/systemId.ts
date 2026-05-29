import systemJson from '../../public/system.json';

// typed as any to make all the setFlag/getFlag etc calls happy
export const SYSTEM_ID: any = systemJson.id;
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;

/**
 * Build a custom Foundry hook name namespaced by the installed system id.
 * Custom hooks (e.g. `nimble.damageApplied`) must derive their prefix from
 * SYSTEM_ID so emitter and listeners stay in lockstep across the stable
 * (`nimble`) and dev (`nimble-dev`) installs. Hardcoding the `nimble.` prefix
 * silently breaks every listener under the dev id.
 */
export function systemHookName(suffix: string): string {
	return `${SYSTEM_ID}.${suffix}`;
}
