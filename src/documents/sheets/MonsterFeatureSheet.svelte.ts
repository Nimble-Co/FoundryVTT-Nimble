import {
  SvelteApplicationMixin,
  type SvelteApplicationRenderContext,
} from "#lib/SvelteApplicationMixin.svelte.js";
import MonsterFeatureSheetComponent from "../../view/sheets/MonsterFeatureSheet.svelte";

export default class MonsterFeatureSheet extends SvelteApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  protected root;

  constructor(item, options = {} as SvelteApplicationRenderContext) {
    super(
      foundry.utils.mergeObject(options, {
        document: item.document,
      }),
    );

    this.root = MonsterFeatureSheetComponent;
  }

  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet"],
    window: {
      icon: "fa-solid fa-hand-fist",
    },
    position: {
      width: 288,
      height: "auto",
    },
    actions: {},
  };

  protected override async _prepareContext() {
    return {
      item: this.item,
      sheet: this,
    };
  }
}
