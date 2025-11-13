/**
 * Make all properties in T optional and explicitly allow `undefined`
 * @internal
 */
export type InexactPartial<T> = {
	[P in keyof T]?: T[P] | undefined;
};
