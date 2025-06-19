import {
  SvelteApplicationMixin,
  type SvelteApplicationRenderContext,
} from "#lib/SvelteApplicationMixin.svelte.js";
import { SvelteItemSheet } from "#lib/SvelteItemSheet.svelte.js";
import BoonSheetComponent from "../../view/sheets/BoonSheet.svelte";

export default class BoonSheet extends SvelteApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  protected root;

  constructor(item, options = {} as SvelteApplicationRenderContext) {
    super(
      foundry.utils.mergeObject(options, {
        document: item.document,
      }),
    );

    this.root = BoonSheetComponent;
  }

  static override DEFAULT_OPTIONS = {
    classes: ["nimble-sheet"],
    window: {
      icon: "fa-solid fa-hands-praying",
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
