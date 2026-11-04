import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';

export interface MaxDamageFieldProps {
	offers: MaxDamageOffer[];
	choice: MaxDamageChoice | null;
}
