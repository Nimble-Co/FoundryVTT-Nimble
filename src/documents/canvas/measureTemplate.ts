class NimBleMeasuredTemplate extends MeasuredTemplate {
	get actor() {
		return (this.document as MeasuredTemplateDocument & { actor?: Actor }).actor;
	}
}

export { NimBleMeasuredTemplate };
