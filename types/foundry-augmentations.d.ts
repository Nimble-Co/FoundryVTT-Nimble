declare namespace foundry {
	namespace canvas {
		namespace layers {
			interface Layer extends PIXI.Container {}
		}
	}

	namespace applications {
		namespace ux {
			namespace TextEditor {
				namespace implementation {
					interface EnrichmentOptions {
						async?: boolean;
						secrets?: boolean;
						documents?: boolean;
						[key: string]: unknown;
					}
				}
			}
		}
	}
}
