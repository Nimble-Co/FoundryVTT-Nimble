export interface VariantOptionsInputProps {
	selectedVariants: string[] | undefined;
	/** Names what characters are called when the ancestry lists no variants. */
	ancestryName: string;
	onChange: (nextVariants: string[]) => unknown;
}
