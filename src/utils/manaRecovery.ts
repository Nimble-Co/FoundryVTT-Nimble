import type { NimbleRollData } from '#types/rollData.d.ts';
import getDeterministicBonus from '../dice/getDeterministicBonus.js';

type ManaRecoveryType = 'fieldRest' | 'safeRest' | 'initiative';

type ManaRecoveryClass = {
	system?: {
		mana?: {
			formula?: string;
			recovery?: string;
		};
	};
};

const VALID_MANA_RECOVERY_TYPES = new Set<ManaRecoveryType>([
	'fieldRest',
	'safeRest',
	'initiative',
]);

function normalizeRecoveryType(value?: string): ManaRecoveryType | null {
	if (!value) return null;
	if (!VALID_MANA_RECOVERY_TYPES.has(value as ManaRecoveryType)) return null;
	return value as ManaRecoveryType;
}

export function getManaRecoveryTypesFromClasses(
	classes: ManaRecoveryClass[] = [],
): Set<ManaRecoveryType> {
	const recoveryTypes = new Set<ManaRecoveryType>();

	for (const cls of classes) {
		const mana = cls.system?.mana;
		if (!mana?.formula?.trim()) continue;

		const recovery = normalizeRecoveryType(mana.recovery ?? 'safeRest');
		if (recovery) {
			recoveryTypes.add(recovery);
		}
	}

	return recoveryTypes;
}

export function restoresManaOnRest(
	recoveryTypes: Set<ManaRecoveryType>,
	restType: 'field' | 'safe',
): boolean {
	if (recoveryTypes.size === 0) {
		return restType === 'safe';
	}

	// If the only recovery type is 'initiative', mana is not restored on rest
	if (recoveryTypes.size === 1 && recoveryTypes.has('initiative')) {
		return false;
	}

	if (restType === 'field') {
		return recoveryTypes.has('fieldRest');
	}

	return recoveryTypes.has('safeRest') || recoveryTypes.has('fieldRest');
}

export function hasInitiativeManaRecovery(classes: ManaRecoveryClass[]): boolean {
	const recoveryTypes = getManaRecoveryTypesFromClasses(classes);
	return recoveryTypes.has('initiative');
}

export function getInitiativeManaAmount(
	actor: { getRollData(): NimbleRollData },
	classes: ManaRecoveryClass[],
): number {
	let total = 0;
	for (const cls of classes) {
		const mana = cls.system?.mana;
		if (!mana?.formula?.trim()) continue;
		const recovery = normalizeRecoveryType(mana.recovery ?? 'safeRest');
		if (recovery === 'initiative') {
			const value = getDeterministicBonus(mana.formula, actor.getRollData());
			if (value) total += value;
		}
	}
	return total;
}

export type { ManaRecoveryType };
