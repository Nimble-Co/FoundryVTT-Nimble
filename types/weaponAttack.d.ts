import type { WEAPON_ATTACKS } from '#utils/damage/weaponAttack.ts';

/** Which weapons an ability attacks with. Empty: the ability has its own damage. */
export type WeaponAttack = (typeof WEAPON_ATTACKS)[number];
