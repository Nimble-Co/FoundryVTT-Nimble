---
title: "Module Support"
---

# Module Support

Nimble needs no modules. Some popular modules work with it out of the box because the system tells them where its data lives.

## Item Piles

[Item Piles](https://foundryvtt.com/packages/item-piles) adds loot piles, containers and merchants. When the module is active, Nimble sets it up for you. There is nothing to configure, and the "system not supported" message does not appear.

What is set up:

- **Currency.** Gold, silver and copper are read from and written to the actor, which for a player character means the coin fields on the sheet. Gold is the main currency. 10 silver is 1 gold, as in the Core Rules. Copper is not in the Core Rules; the system counts 10 copper as 1 silver.
- **Prices.** A merchant shows the price from the **Price** field of each object, in the denomination you chose there. A buyer who pays with a larger coin gets change.
- **What can be traded.** Only objects (weapons, armor, shields, consumables and other gear) show in a pile or a merchant. Features, spells, classes, ancestries and the like are left out.
- **Fresh items.** An item that changes hands arrives unequipped and outside any container.

Good to know:

- Every actor can hold coins, so a monster or NPC works as a pile or a merchant. Only the character sheet shows coin fields; for other actors, Item Piles shows the coins.
- You can still change any of these values in the Item Piles settings. Your changes stay until a later Nimble release ships a newer setup.

## For module developers

| Data | Path | Type |
| --- | --- | --- |
| Coins on an actor | `system.currency.gp`, `system.currency.sp`, `system.currency.cp` | number |
| Price of an object | `system.price.value` | number |
| Denomination of the price | `system.price.denomination` | `gp`, `sp` or `cp` |
| Quantity of an object | `system.quantity` | number |

`CONFIG.NIMBLE.currencies` lists each denomination with its name, abbreviation, icon and exchange rate to gold.
