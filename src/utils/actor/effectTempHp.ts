import { SYSTEM_ID } from '#system';

interface TempHpHolder {
	name?: string | null;
	system?: unknown;
	update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

interface LinkedEffect {
	id?: string | null;
	name?: string | null;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface LinkHolder extends TempHpHolder {
	effects?: Iterable<LinkedEffect> | null;
}

const TEMP_PATH = 'system.attributes.hp.temp';
const GRANT_OPTION = 'tempGrantEffectId';

function currentTemp(holder: TempHpHolder): number {
	const temp = Number(foundry.utils.getProperty(holder, TEMP_PATH) ?? 0);
	return Number.isFinite(temp) ? temp : 0;
}

export interface TempHpGrant {
	/** the temp HP to set on the holder now */
	give: number;
	/** the temp HP that the new effect takes back when it ends */
	owned: number;
	/** the holder kept more temp HP than the effect gives */
	refused: { temp: number; amount: number } | null;
}

/**
 * What a new effect does with temp HP, after the copies it replaced are gone. It gives all of
 * `amount` when that is more than the holder has, else none (temp HP do not stack). When it gives
 * none, it takes over what is left of the temp HP that the replaced copies gave (`replaced`).
 */
export function tempHpGrant(
	holder: TempHpHolder,
	amount: number | null | undefined,
	replaced: number,
): TempHpGrant {
	const value = Math.floor(Number(amount));
	const temp = currentTemp(holder);
	const inherited = Math.min(temp, Math.max(0, replaced));
	if (!Number.isFinite(value) || value <= 0) return { give: 0, owned: inherited, refused: null };
	if (value > temp) return { give: value, owned: value, refused: null };
	return { give: 0, owned: inherited, refused: { temp, amount: value } };
}

/** The update options that name the grant whose temp HP the update writes (null: no effect's). */
export function tempGrantOptions(effectId: string | null): Record<string, unknown> {
	return { [SYSTEM_ID]: { [GRANT_OPTION]: effectId } };
}

/** Give temp HP that are now the grant of `effectId`; the temp HP of other grants are gone. */
export async function giveTempHp(
	holder: TempHpHolder,
	amount: number,
	effectId: string | null,
): Promise<void> {
	if (amount > 0) await holder.update({ [TEMP_PATH]: amount }, tempGrantOptions(effectId));
}

/** Every effect on the holder but `keepEffectId` owns no temp HP now. Gives the ended links. */
export async function clearTempHpLinks(
	holder: LinkHolder,
	keepEffectId: string | null,
): Promise<LinkedEffect[]> {
	const ended: LinkedEffect[] = [];
	for (const effect of holder.effects ?? []) {
		if (keepEffectId && effect.id === keepEffectId) continue;
		const given = Number((effect.system as { tempHp?: number | null } | undefined)?.tempHp);
		if (!(given > 0)) continue;
		ended.push(effect);
		await effect.update({ 'system.tempHp': null });
	}
	return ended;
}

/**
 * A link holds only while the temp HP are that grant's: an update that names a grant keeps that
 * link alone; temp HP that reach 0, or go up with no grant named, end every link. Gives the ids of
 * the effects whose link it ended.
 */
export async function followTempHpChange(
	holder: LinkHolder,
	changes: Record<string, unknown>,
	options: unknown,
): Promise<string[]> {
	if (foundry.utils.getProperty(changes, TEMP_PATH) === undefined) return [];
	const recorded = (options as Record<string, Record<string, unknown> | undefined> | null)?.[
		SYSTEM_ID
	];
	let ended: LinkedEffect[] = [];
	if (recorded && GRANT_OPTION in recorded) {
		ended = await clearTempHpLinks(holder, (recorded[GRANT_OPTION] as string | null) ?? null);
	} else {
		const temp = currentTemp(holder);
		const before = (recorded?.previousHp as { temp?: number } | undefined)?.temp;
		if (temp <= 0 || (typeof before === 'number' && temp > before)) {
			ended = await clearTempHpLinks(holder, null);
		}
	}
	return ended.flatMap((effect) => (effect.id ? [effect.id] : []));
}

/** When the effect goes, the holder loses what is left of the temp HP that it gave. */
export async function takeBackTempHp(holder: TempHpHolder, given: number | null | undefined) {
	const amount = Math.floor(Number(given));
	if (!Number.isFinite(amount) || amount <= 0) return;
	const temp = currentTemp(holder);
	const left = temp - Math.min(temp, amount);
	if (left !== temp) await holder.update({ [TEMP_PATH]: left });
}
