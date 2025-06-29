import { NimbleBaseItemData } from "./BaseItemDataModel.js";

const { fields } = foundry.data;

const schema = {
  description: new fields.HTMLField({
    required: true,
    initial: "",
    nullable: false,
  }),
  boonType: new fields.StringField({
    required: true,
    initial: "minor",
    nullable: false,
  }),
};

declare namespace NimbleBoonData {
  type Schema = NimbleBaseItemData.Schema & typeof schema;
  type BaseData = NimbleBaseItemData.BaseData;
  type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleBoonData extends NimbleBaseItemData<
  NimbleBoonData.Schema,
  NimbleBoonData.BaseData,
  NimbleBoonData.DerivedData
> {
  /** @inheritDoc */
  static override defineSchema(): NimbleBoonData.Schema {
    return {
      ...super.defineSchema(),
      ...schema,
    };
  }
}

export { NimbleBoonData };
