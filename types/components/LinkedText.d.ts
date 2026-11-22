import type { LinkedData, LinkedPart } from '#utils/documents/docLink.ts';

export type LinkedTextProps =
	| { parts: readonly LinkedPart[]; key?: never; data?: never }
	| { key: string; data?: LinkedData; parts?: never };
