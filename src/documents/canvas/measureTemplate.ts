class NimBleMeasuredTemplate extends MeasuredTemplate {
	get actor() {
		return (this.document as object as { actor?: Actor }).actor;
	}
}

export { NimBleMeasuredTemplate };
