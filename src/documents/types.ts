/**
 * Shared types for documents to break circular dependencies
 */

export type SystemItemTypes = Exclude<foundry.documents.BaseItem.SubType, 'base'>;

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.SubType, 'base'>;
