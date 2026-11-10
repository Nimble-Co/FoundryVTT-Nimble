import localize from '#utils/localize.js';

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

/**
 * The temp HP that an effect gives: all of it when it is more than the holder has, else none
 * (temp HP do not stack). Says so when it gives none.
 */
export function tempHpToGive(holder: TempHpHolder, amount: number | null | undefined): number {
	const value = Math.floor(Number(amount));
	if (!Number.isFinite(value) || value <= 0) return 0;
	const temp = currentTemp(holder);
	if (value > temp) return value;
	ui.notifications?.warn(
		localize('NIMBLE.healingTypes.tempHealingNotGranted', {
			name: holder.name ?? '',
			temp: String(temp),
			amount: String(value),
		}),
	);
	return 0;
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
