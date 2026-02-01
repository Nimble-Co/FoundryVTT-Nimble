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

	if (restType === 'field') {
		return recoveryTypes.has('fieldRest');
	}

	return recoveryTypes.has('safeRest') || recoveryTypes.has('fieldRest');
}

export type { ManaRecoveryType };
