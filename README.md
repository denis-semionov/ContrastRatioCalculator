# Contrast Ratio Calculator

Check two hex colors against the WCAG 2.2 contrast requirements. If the pair fails, get the nearest foreground that passes and tap it to use it.

| Check | Minimum ratio |
| --- | --- |
| AA normal text | 4.5:1 |
| AA large text | 3:1 |
| AAA normal text | 7:1 |
| AAA large text | 4.5:1 |
| AA UI components and graphics | 3:1 |

Large text is at least 24px, or at least 18.66px bold.

## How it works

- **Input:** `#RGB` or `#RRGGBB`, with or without the `#`. Alpha values are rejected, because the ratio of a translucent color depends on what's behind it.
- **Displayed ratio:** cut off at two decimals, never rounded up, so a failing 4.499 reads as 4.49. Pass/fail always uses the exact value.
- **Suggestions:** for each threshold the pair misses, the app finds the passing color closest to your foreground in [OKLab](https://bottosson.github.io/posts/oklab/), a color space where distance tracks how different colors look. Hue and saturation shifts count for more than lightness shifts, and a gray always stays a pure gray. The search scans a coarse grid and then refines it. It isn't exhaustive, so a result can occasionally differ slightly from the true closest color.
- **Unreachable targets:** on mid-tone backgrounds no color reaches 7:1. The app says so and names the best achievable color.

## Run it locally

There's no build step or dependencies. Open `index.html` in a browser.

## Tests

The tests need Node 18 or later:

```sh
node --test
```

## Hosting on GitHub Pages

In the repository, go to **Settings → Pages**, then set **Source** to **Deploy from a branch**, the branch to `main` and the folder to `/ (root)`. All asset paths are relative, so the site works from the `/ContrastRatioCalculator/` subpath.

## Files

- `contrast.js`: WCAG maths and the nearest-color search, with no DOM access
- `app.js`: connects that logic to the page
- `index.html`, `styles.css`: the page
- `test/contrast.test.js`: tests for `contrast.js`
