# Bean There

Your coffee beans, and every espresso and pour over you brew with them.

## Getting started

1. Open **Bean There** in the Home Assistant sidebar.
2. Tap **Add your first coffee**, give it a name, and fill in whatever you know about it. Only the name is needed.
3. Make a coffee, tap **First shot** (or **First brew**) on it in the **Espresso** or **Pour over** tab, and say how it was. Try again until it's
   good: that's the setting you'll see from then on.

Bean There is for finding a coffee's sweet spot and looking the settings up again, not for counting cups: log tries until the
coffee pours right, then come back when you want the settings.

## The tabs

| Tab           | Shows                                                                        |
|---------------|------------------------------------------------------------------------------|
| **Espresso**  | A recipe card per coffee: its espresso settings, and the tries it took       |
| **Pour over** | The same, for pour over                                                      |
| **Beans**     | Your bags: the ones in use first, finished bags at the end                   |

On the Espresso and Pour over tabs, each coffee (every bag of it together) has a recipe card:

- **The recipe**: your sweet spot (the last brew that came out **Good**), else your last try, as labelled values:
  **Grind · In · Out · Time** for espresso, **Grind · Ratio · Time** for pour over. With more than one bag, it says
  which bag it's from.
- **Top right**: how it came out: **✓ sweet spot**, or the last try's taste with which way to grind ("sour · grind
  finer", "bitter · grind coarser").
- **Again**: a new try, copied from the recipe shown.
- **Tries**: every try, newest first, with its day and time; **Show older** shows more. Tap one to change or delete
  it; its ↻ button starts a new try copied from it.
- A coffee not made that way yet just has **First shot** (or **First brew**).

Coffees in use come first, then ones not made this way yet, then finished ones (to look their settings up). A try's
colour is how it tasted: **Good** (green), **Sour** (yellow), **Bitter** (red) or **Off** (grey).

## Logging a brew

You never type a try from scratch. **Again** on a coffee's card (the round **+** does it too, for the coffee you
brewed last) opens a new try **copied from your last one**: grind, dose, yield, time and temperature are all filled in, and
the last try is shown above, with how it tasted. Change what's different (usually the grind and the time: tapping a
field selects it, so you just type), pick how it was, and **Log it**. If it isn't good yet, **Again** on the card
copies the one you just saved. To start from an older try, use its ↻ button, or open it and
tap **Try again from this**.

| Field                   | Espresso                         | Pour over                        |
|-------------------------|----------------------------------|----------------------------------|
| Grinder                 | the automatic grinder's setting  | the manual grinder's setting (e.g. clicks) |
| Time                    | shot time, in seconds            | brew time, minutes and seconds   |
| Dose                    | coffee in, grams                 | coffee in, grams                 |
| Yield / Water           | espresso in the cup, grams       | water poured, ml                 |
| Temp                    | water temperature, °C            | water temperature, °C            |

Tries show the grind, then for espresso the grams in → out ("18g → 36g") and the shot time; for a pour over the ratio
of coffee to water ("1:18") and the brew time. The time is in bold, to tell it from the grams. Everything else is in
the brew when you open it. The ratio is worked out as you type. Every number is optional, and a comma works as a decimal point (18,5).

**How was it?** Sour usually means under-extracted: grind finer. Bitter usually means over-extracted: grind coarser.
The next brew of that coffee reminds you. Tap the selected one again to leave it unrated.

When your last brew wasn't good, the **last good** one shows under it (from an earlier bag too). **Use** fills in its
grind, dose, yield and temperature.

Tap a try (under **See all tries**) to change it (its coffee and kind too) or delete it; **Delete** asks you to tap
it again. **Delete all tries**, at the bottom of a coffee's tries, deletes every try of it made that way (with every
bag of it); it asks too, as neither can be undone. The coffee itself stays.

Messages at the bottom of the screen say what was done ("Saved", "Deleted"); tap one to dismiss it.

## Beans

The Beans tab has a card per bag: its roast, what it was roasted for (espresso, pour over or other), its roaster, origin and process, tasting notes, the price and bag size, how
many days it is off roast, and the grind of its sweet spot for espresso and pour over.

Tap a card to open it. At the top is what worked, per kind: the settings that **came out good**, newest first, with
every bag of this coffee. The same settings logged good again say so ("15× good"), and each says which bag it was. The
newest 3 show; **See all** shows the rest. **See all tries** opens that kind's tab with this coffee's tries open. It also shows what a cup costs (price ÷ bag size × dose). **Log espresso** and **Log pour over** log a brew
of it straight away. Below are all its details, to change and **Save**.

When the bag is empty, tap **Bag finished**: it moves to the end of the list, isn't offered for new brews, and keeps
its history. **Back in use** undoes it.

**Bought again** (on a finished bag) adds the next bag of the same coffee: everything is copied but the roast date, so
fill that in and check the price, bag size and where you bought it. A coffee's bags are the ones with the same name and
roaster: their good settings show together, and the new bag's first brew starts from the last one of the earlier bag.

**Delete** removes the bag and every brew made with it; it asks first (tap it again), as this can't be undone.

## Phone and PC

On a phone you see one tab at a time. On a wide screen the three tabs sit side by side. Everything you change shows up
straight away on every screen that has the tracker open.

If the connection to Home Assistant is lost for more than a few seconds, an **Offline** badge shows at the bottom left.
It reconnects by itself and the badge goes away.

To have it like an app on your phone, open the direct address `http://<your-homeassistant-ip>:3300/` in the browser
and choose **Add to Home Screen**. It works in the Home Assistant app too, from the sidebar.

## Configuration

**currency** (default `€`): the symbol prices and the cost per cup are shown with, e.g. `$` or `£`.

## Your data

Beans and brews are saved in the add-on's own storage (`/data/coffee.json`) and are kept across updates and restarts.
Home Assistant backups include it.
