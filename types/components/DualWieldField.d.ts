import type { DualWieldOffer } from '#types/dualWield.d.ts';

export interface DualWieldFieldProps {
	offer: DualWieldOffer;
	itemName: string;
	rollMode: number;
	checked: boolean;
	extraDieOn: 'activated' | 'other';
}
