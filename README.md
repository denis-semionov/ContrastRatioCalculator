# Contrast Ratio Calculator

Find out whether two colors have enough contrast to meet WCAG accessibility guidelines. If they don't, get the closest color that does.

**[Open the calculator](https://denis-semionov.github.io/ContrastRatioCalculator/)**

It's free, needs no sign-up, and works on desktop and mobile. Everything runs in your browser, so your colors aren't sent anywhere.

## How to use it

1. Enter your text or icon color as the **Foreground**, and the color behind it as the **Background**. You can type a hex code or use the color picker.
2. Read the contrast ratio and see which levels pass or fail.
3. If something fails, tap a suggested color to use it as the new foreground. Changed your mind? Tap **Undo**.
4. Try the button, text field and dropdown in the **Live preview** to see how your colors work on real controls.

Hex codes can have 3 or 6 digits, with or without the `#`, so `#1A2B3C`, `1a2b3c` and `#FFF` all work.

## What the results mean

A higher ratio means more contrast. Ratios run from 1:1 (identical colors) to 21:1 (black on white).

| What you're checking | AA | AAA |
| --- | --- | --- |
| Normal text | 4.5:1 | 7:1 |
| Large text (at least 24px, or at least 18.66px bold) | 3:1 | 4.5:1 |
| UI components, such as icons and input borders | 3:1 | Not defined |

**AA** is the level most accessibility standards and policies ask for. **AAA** is a stricter target that isn't achievable for all content.

## Common questions

**Why does it say a color can't be reached?**
On mid-tone backgrounds, no color can reach 7:1, not even black or white. The calculator tells you the strongest contrast available and which color gives it. To reach 7:1, you'd need to change the background.

**Why are there several suggestions?**
You get one for each threshold your colors miss (3:1, 4.5:1 and 7:1). The higher the target, the further the color may move from your original.

**How does it choose the nearest color?**
It looks for the passing color that looks most like your foreground, trying to keep the same hue and saturation. Grays stay pure gray. It uses a fast search rather than checking all 16.7 million colors, so a suggestion can occasionally differ very slightly from the mathematically closest one.

**Why does my ratio differ slightly from another tool?**
This calculator cuts ratios off at two decimals instead of rounding them, so a failing 4.499 shows as 4.49 rather than a misleading 4.50. Pass or fail always uses the exact value.

**Can I check transparent colors?**
No. The contrast of a see-through color depends on what's behind it, so 4-digit and 8-digit hex codes aren't accepted.

## For developers

The site is plain HTML, CSS and JavaScript, with no dependencies or build step.

**Run it locally:** open `index.html` in a browser.

**Run the tests:** with a current version of [Node.js](https://nodejs.org/) installed, run:

```sh
node --test
```

**Host your own copy:** in your fork, go to **Settings → Pages**, set **Source** to **Deploy from a branch**, then choose `main` and `/ (root)`.

| File | What it does |
| --- | --- |
| `contrast.js` | WCAG calculations and the nearest-color search |
| `app.js` | Connects the calculations to the page |
| `index.html`, `styles.css` | The page and its styling |
| `test/contrast.test.js` | Tests for `contrast.js` |
