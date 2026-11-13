interface TempHpHolder {
	name?: string | null;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

const TEMP_PATH = 'system.attributes.hp.temp';

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

export async function giveTempHp(holder: TempHpHolder, amount: number): Promise<void> {
	if (amount > 0) await holder.update({ [TEMP_PATH]: amount });
}

/** When the effect goes, the holder loses what is left of the temp HP that it gave. */
export async function takeBackTempHp(holder: TempHpHolder, given: number | null | undefined) {
	const amount = Math.floor(Number(given));
	if (!Number.isFinite(amount) || amount <= 0) return;
	const temp = currentTemp(holder);
	const left = temp - Math.min(temp, amount);
	if (left !== temp) await holder.update({ [TEMP_PATH]: left });
}
