export interface VariantOptionsInputProps {
	/** The names the ancestry currently lists, as stored — reads normalize blanks and repeats. */
	selectedVariants: string[] | undefined;
	/** The ancestry's own name, used to say what characters are called when it lists no variants. */
	ancestryName: string;
	onChange: (nextVariants: string[]) => unknown;
}
