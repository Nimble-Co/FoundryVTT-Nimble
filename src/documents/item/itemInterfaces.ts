/**
 * Type interfaces for items to break circular dependencies
 * These are pure type definitions with no imports from documents
 */

export type SystemItemTypes = Exclude<foundry.documents.BaseItem.TypeNames, 'base'>;
