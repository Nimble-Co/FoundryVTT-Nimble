/**
 * Type interfaces for items to break circular dependencies
 */

export type SystemItemTypes = Exclude<foundry.documents.BaseItem.SubType, 'base'>;
