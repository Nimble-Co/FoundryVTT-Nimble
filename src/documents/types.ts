/**
 * Shared types for documents to break circular dependencies
 */

export type SystemItemTypes = Exclude<foundry.documents.BaseItem.TypeNames, 'base'>;

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.TypeNames, 'base'>;
