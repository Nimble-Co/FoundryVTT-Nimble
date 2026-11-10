import { SYSTEM_ID } from '#system';

export interface EffectSource {
	type?: string;
	flags?: Record<string, unknown>;
	system?: { changes?: unknown[] };
}

const OWN_FLAG_SCOPES = new Set(['core', SYSTEM_ID]);

/** A core-typed effect that no other package has claimed with its flags. */
export function isUnclaimedBaseEffect(source: EffectSource): boolean {
	if (source.type !== CONST.BASE_DOCUMENT_TYPE) return false;
	return Object.keys(source.flags ?? {}).every((scope) => OWN_FLAG_SCOPES.has(scope));
}
