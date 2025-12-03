/**
 * Type interfaces for items to break circular dependencies
 */

export type SystemItemTypes = Exclude<Item.SubType, 'base'>;
