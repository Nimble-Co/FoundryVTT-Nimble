/** A chat card data model, read for the fields its schema declares. */
export interface CardDataModel {
	defineSchema(): Record<string, unknown>;
}

/** The chat card data models, by card type. */
export type CardDataModels = Record<string, CardDataModel | undefined>;
