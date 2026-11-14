---
title: "How Long Effects Last"
---

# How Long Effects Last

A **Lasts Until** says when a condition or another effect ends, such as "until the end of their next turn". When that moment comes, the system ends the effect and puts a line in chat.

## Lasts Until

- **A turn.** "Until the end of their next turn" counts the turns of the **holder**, the creature that has the effect. "Until the start of your next turn" counts the turns of the creature that applied it. "Their next turn" is the first turn that starts after the effect goes on. So an effect applied in the holder's own turn lasts through their next one.
- **A time.** "For 1 minute" counts world time. "For 1 round" lasts until the same place in the turn order one round later. An effect applied at Initiative lasts all of round 1.
- **An event.** "Until they attack", "until they drop to 0 HP", "until Rage ends" and other events end the effect when they happen. "Until the 2nd combat ends" lasts through two combats of the holder. The combat in progress counts as the 1st.

::: details What counts as an attack or a move
An attack is a use with a damage roll, or a use that asks another creature for a save. A move is any change to the token's position.
:::

Some conditions have their own Lasts Until. They keep it when nothing else gives them one:

- Dazed and Slowed last until the end of their next turn.
- Grappled lasts until the creature that applied it drops to 0 HP, dies or gains Incapacitated. A Grappled that someone applies by hand has no such creature, so it stays until someone removes it.
- For Concentration, see [Concentration](concentration.md).

The system gives Charged for 1 minute to a creature that takes lightning damage.

When an effect has more than one moment, the first one to happen ends it. **Minor Statuses** end when combat ends. They are Charged, Distracted, Smoldering and each custom condition that the GM marks as minor. The system ends effects only while a GM is connected.

::: details Turn moments out of combat, and a combat that never started
An effect that lasts until a turn or round moment also ends when combat ends. Out of combat, it ends when world time moves on. A combat that never started (the GM deleted it before round 1) ends only the effects that went on in it.
:::

On the **Effects** tab, the row of an effect shows its Lasts Until and its source, such as "Until the end of your next turn - Snowblind".

## The same condition again

When a creature that has a condition gets it again, the one that lasts longer stays. A second Taunted always takes the place of the first, so the most recent taunter counts. An effect with Stacks on adds a stack instead, and its row shows the count. See [Stacks](../homebrew/lasts-until.md#stacks).

::: details How the system compares two Lasts Until
The system turns the first moment of each Lasts Until into a number of rounds:

- The end of the current turn is half a round.
- The start of the next turn, the start of the next round, and the start or end of the current round are 1 round.
- The end of the next turn is 1.5 rounds.
- The end of the next round is 2 rounds.
- "For N rounds" is N rounds.
- A time is what is left of it.
- An event, or no moment at all, has no end.

When the two are equal, the one already on the creature stays.
:::

## Escape

An effect such as Grappled can have an Escape button on its row, such as **Escape DC 13**. The button rolls the save or the check, and spends 1 action in combat. When the effect allows more than one save or check, you pick one. The roll card reads "Escape Grappled". On a success, the effect ends and the roll card gets the ended line in **Events**, with **Undo**. A reroll that turns the success into a failure puts the effect back. As with every other end, a GM must be connected.

An Escape with no DC has a button with no number: **Escape**. A natural 20 escapes and a natural 1 fails. On any other roll, the roll card gets the line "Tessa tries to escape Grappled" with an **Escapes** button. When the table judges that the roll escapes, the owner of the creature or the GM clicks **Escapes**. The effect ends, with its ended line and **Undo** on the roll card. If nobody clicks, the effect stays.

::: details More about Escape
With **Feature Effects** off, a success ends nothing. The roll card gets a line with **End** in place of the ended line, and a reroll to a failure takes that line off.

After someone clicks **Escapes**, a reroll to another result that the table must judge leaves the effect ended. When the owner cannot read the roll card (a GM's private roll), the line goes on a card for the owner and the GMs. A later reroll changes the line there or removes it.
:::

## When an effect ends

When an effect ends, it gets a line in the **Events** strip of the card that ended it. For example, an attack card ends "until they attack" and gets the line. When no card ended it, the system posts one message for that moment, such as "Start of Tessa's turn", with a line for each effect that ended. **Undo** on a line puts that effect back. The owner of the creature and the GM can use it. The effect keeps its old start, so it ends again at the next matching moment. Going back a turn in the combat tracker does not bring effects back.

![The message for the end of Grug's turn: True Strike ended on Grug, with Undo](/images/documentation/effect-life-4-moment.png)

With **Feature Effects** off, no effect ends by itself. Where the ended line would go, a line says "Blinded ends on Tessa" and why, with an **End** button. When the owner of the creature or the GM clicks **End**, the effect ends and the line becomes its ended line, with **Undo**. If nobody clicks, the effect stays.

::: details More about End
- A turn, a round, a time or the end of combat gives an effect one line. An event such as "until they attack" gives a line on each card that causes it, while the effect is on.
- The same goes for Minor Statuses at the end of combat, for a Grappled whose grappler drops, and for Concentration at 0 HP or Incapacitated.
- If someone removed the effect before the click, the line says "Blinded is no longer on Tessa" and has no button.
- An effect with an Empty pools at end rule does not empty its pools when it ends. The card of the end gets a line "Empty Fury Dice" with an **Empty** button for each pool that holds dice. An effect removed by hand puts these lines on a message of their own.
:::

[How an effect works](../homebrew/effects.md#how-an-effect-works) has a picture of each step.

## Related pages

- [Conditions](conditions.md)
- [Concentration](concentration.md)
- [Lasts Until, Stacks and Escape](../homebrew/lasts-until.md)
- [Dice Rolls & Chat Cards](dice-and-chat.md)
