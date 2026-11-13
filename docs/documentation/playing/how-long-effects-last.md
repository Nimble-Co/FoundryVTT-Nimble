---
title: "How Long Effects Last"
---

# How Long Effects Last

A condition, or any other effect, can have a **Lasts Until**: one or more moments that end it, in the book's words. This page tells how the system reads it, how a creature escapes an effect, and what you see when an effect ends.

## Lasts Until

- **A turn.** "Until the end of their next turn" follows the turns of the creature with the effect. "Until the start of your next turn" follows the turns of the creature that applied it. "Their next turn" is the first turn that starts after the effect goes on, so an effect applied in their own turn lasts through their next one.
- **A time.** "For 1 minute" follows world time. "For 1 round" lasts until the same place in the turn order one round later; applied at Initiative, it lasts all of round 1.
- **An event.** "Until they attack", "until they drop to 0 HP", "until Rage ends" and others end it when that happens. "Until the 2nd combat ends" lasts through two combats of the creature; the combat in progress counts as the 1st. An attack is a use with a damage roll, or one that asks another creature for a save. A move is any change of the token's place.

Some conditions have a Lasts Until of their own, which they keep when nothing else gives them one:

- **Dazed** and **Slowed**: until the end of their next turn.
- **Grappled**: until the creature that applied it drops to 0 HP, dies or gains Incapacitated. A Grappled set by hand has no such creature, so it stays until someone removes it.
- **Concentration**: see [Concentration](concentration.md).

**Charged** goes on a creature that takes lightning damage, for 1 minute.

When an effect has more than one moment, the first one to happen ends it. A turn or round moment also ends when combat ends, and out of combat it ends when world time moves on. A combat that never started (deleted before round 1) ends only the effects that went on in it. **Minor Statuses** (Charged, Distracted, Smoldering, and the custom conditions you mark) end when combat ends. A GM must be connected for an effect to end.

On the Effects tab, the row reads the Lasts Until and the source: "Until the end of your next turn - Snowblind".
## The same condition again

When a creature that has a condition gets it again, the one that lasts longer stays. A second Taunted always takes the place of the first, so the most recent taunter counts. An effect with Stacks on adds a stack instead, and the row shows the count: see [Stacks](../homebrew/lasts-until.md#stacks).

::: details How the system compares two Lasts Until
It estimates each in rounds and keeps the first moment: the end of the current turn is half a round, the start of the next turn or the current round one, the end of the next turn one and a half, the next round two, "for N rounds" N, and a time what is left of it. An event, or no moment at all, has no end. When the two are equal, the one already on the creature stays.
:::


## Escape

An effect such as Grappled can have an Escape button on its row, for example **Escape DC 13**. It rolls the save or the check (you pick when more than one is allowed) and spends 1 action in combat. The roll card reads "Escape Grappled". On a success the effect ends, and the roll card gets its ended line in **Events**, with **Undo**. A reroll that turns the success into a failure puts the effect back. As with every other end, a GM must be connected.

An Escape with no DC has the button **Escape** with no number. A natural 20 escapes and a natural 1 fails. On any other roll, the roll card gets the line "Tessa tries to escape Grappled" with an **Escapes** button. When the table judges that the roll escapes, the owner of the creature or the GM clicks **Escapes**. The effect ends, with its ended line and **Undo** on the roll card. If nobody clicks, the effect stays.

::: details More about Escape
With **Feature Effects** off, a success ends nothing. The roll card gets a line with **End** in place of the ended line, and a reroll to a failure takes that line off.

A later reroll to a result the table must judge keeps the ruling of **Escapes**. When the owner cannot read the roll card (a GM's private roll), the line goes on a card for the owner and the GMs. A later reroll changes the line there or removes it.
:::

## When an effect ends

When effects end, each one gets a line in the **Events** strip of the card that ended it, such as the card of the attack that ended "until they attack". With no such card, the chat gets one message for that moment, such as "Start of Tessa's turn", with a line for each effect that ended. **Undo** on a line puts that effect back. The owner of the creature and the GM can use it. The effect keeps its old start, so it ends again at the next matching moment. Going back a turn in the combat tracker does not bring effects back.

![The message for the end of Grug's turn: True Strike ended on Grug, with Undo](/images/documentation/effect-life-4-moment.png)

With **Feature Effects** off, no effect ends by itself. Where the ended line would go, a line says "Blinded ends on Tessa" and why, with an **End** button. When the owner of the creature or the GM clicks **End**, the effect ends and the line becomes its ended line, with **Undo**. If nobody clicks, the effect stays.

::: details More about End
- A turn, a round, a time or the end of combat gives an effect one line. An event such as "until they attack" gives a line on each card that causes it, while the effect is on.
- This also holds for Minor Statuses at the end of combat, for a Grappled whose grappler drops, and for Concentration at 0 HP or Incapacitated.
- If someone removed the effect before the click, the line says "Blinded is no longer on Tessa" and has no button.
- An effect with an Empty pools at end rule does not empty its pools when it ends. The card of the end gets a line "Empty Fury Dice" with an **Empty** button for each pool that holds dice. An effect removed by hand puts these lines on a message of their own.
:::

The pictures of every step are in [How an effect works](../homebrew/effects.md#how-an-effect-works).
## Related pages

- [Conditions](conditions.md)
- [Concentration](concentration.md)
- [Lasts Until, Stacks and Escape](../homebrew/lasts-until.md)
- [Dice Rolls & Chat Cards](dice-and-chat.md)
