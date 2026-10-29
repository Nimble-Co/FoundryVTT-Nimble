export interface SheetPortraitProps {
	/** the actor image and name, and the image settings (px and %) */
	view: { img: string; name: string; portrait: { x: number; y: number; scale: number } };
	/** `rail`: fills the box; `header`: the right part of the narrow header */
	form: 'rail' | 'header';
}
