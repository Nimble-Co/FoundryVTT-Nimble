/**
 * Shared types for documents to break circular dependencies
 */

export type SystemItemTypes = Exclude<Item.SubType, 'base'>;

export type SystemActorTypes = Exclude<Actor.SubType, 'base'>;
