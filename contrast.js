'use strict';

/**
 * WCAG 2.x contrast maths and nearest-passing-color search. No DOM access, so
 * it runs in the browser (as a classic script) and in Node (for the tests).
 * Colors are [r, g, b] arrays of integers from 0 to 255.
 */
const Contrast = (() => {
  // Thresholds that have to be met for each kind of content.
  const CHECKS = [
    { id: 'aa-normal', level: 'AA', content: 'normal', min: 4.5 },
    { id: 'aa-large', level: 'AA', content: 'large', min: 3 },
    { id: 'aaa-normal', level: 'AAA', content: 'normal', min: 7 },
    { id: 'aaa-large', level: 'AAA', content: 'large', min: 4.5 },
    { id: 'aa-ui', level: 'AA', content: 'ui', min: 3 },
  ];

  // Each distinct threshold, and what a color meeting it passes in total.
  const TIERS = [
    { min: 3, label: 'AA large text and UI components' },
    { min: 4.5, label: 'All AA, plus AAA large text' },
    { min: 7, label: 'All AA and AAA' },
  ];

  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];

  // sRGB channel to linear light, precomputed because the search calls it a lot.
  const LINEAR = Array.from({ length: 256 }, (_, i) => {
    const c = i / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  /** Accepts RGB or RRGGBB, with or without '#'. Returns null for anything else. */
  function parseHex(input) {
    const hex = String(input).trim().replace(/^#/, '');
    if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }

  function toHex(rgb) {
    const digits = rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
    return `#${digits.toUpperCase()}`;
  }

  function luminance([r, g, b]) {
    return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b];
  }

  function ratioFromLuminance(a, b) {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function ratio(a, b) {
    return ratioFromLuminance(luminance(a), luminance(b));
  }

  /**
   * Two decimals, truncated: WCAG thresholds are absolute, so 4.499 must never
   * read as "4.50" beside a failing result. The tiny nudge stops floating-point
   * noise turning an exact 21 into "20.99".
   */
  function formatRatio(value) {
    return (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);
  }

  /** The strongest contrast any color can reach on this background. */
  function bestPossible(bg) {
    const onBlack = ratio(BLACK, bg);
    const onWhite = ratio(WHITE, bg);
    return onBlack >= onWhite
      ? { color: BLACK, ratio: onBlack }
      : { color: WHITE, ratio: onWhite };
  }

  // OKLab: distances in it track how different two colors look, which RGB
  // distances do not.
  function oklab([r, g, b]) {
    const lr = LINEAR[r];
    const lg = LINEAR[g];
    const lb = LINEAR[b];
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }

  // Fixing contrast has to change lightness, so a shift in hue or saturation is
  // the less expected change and costs more. Unweighted, grays pick up a tint.
  const CHROMA_WEIGHT = 9;

  function distanceSquared(a, b) {
    return (a[0] - b[0]) ** 2 + CHROMA_WEIGHT * ((a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  }

  /**
   * The color perceptually closest to `fg` that reaches `min` against `bg`, or
   * null if nothing can. Returns `fg` itself if it already passes.
   *
   * Checking all 16.7M colors is too slow to run per keystroke, so this scans a
   * coarse grid and then refines around the best hit. Colors lighter and darker
   * than the background are refined separately, because the closest answer can
   * be on either side and they form two disconnected regions.
   */
  function nearestPassing(fg, bg, min) {
    const bgLum = luminance(bg);
    if (ratio(fg, bg) >= min) return fg;
    if (bestPossible(bg).ratio < min) return null;

    const target = oklab(fg);
    const lighter = { color: null, distance: Infinity };
    const darker = { color: null, distance: Infinity };

    const consider = (r, g, b, only) => {
      const color = [r, g, b];
      const lum = luminance(color);
      if (ratioFromLuminance(lum, bgLum) < min) return;
      const side = lum > bgLum ? lighter : darker;
      if (only && side !== only) return;
      const distance = distanceSquared(oklab(color), target);
      if (distance < side.distance) {
        side.color = color;
        side.distance = distance;
      }
    };

    const pickCloser = () => (lighter.distance < darker.distance ? lighter.color : darker.color);

    // A neutral foreground stays neutral: a faint tint could land slightly closer
    // to the threshold, but nobody wants #797676 when they started from a gray.
    if (fg[0] === fg[1] && fg[1] === fg[2]) {
      for (let v = 0; v <= 255; v += 1) consider(v, v, v);
      return pickCloser();
    }

    // Step 15 lands exactly on 255, so black and white are always scanned and a
    // reachable threshold always yields at least one candidate.
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) consider(r, g, b);
      }
    }

    const scanAround = (side, radius, step) => {
      const [cr, cg, cb] = side.color;
      for (let r = Math.max(0, cr - radius); r <= Math.min(255, cr + radius); r += step) {
        for (let g = Math.max(0, cg - radius); g <= Math.min(255, cg + radius); g += step) {
          for (let b = Math.max(0, cb - radius); b <= Math.min(255, cb + radius); b += step) {
            consider(r, g, b, side);
          }
        }
      }
    };

    for (const side of [lighter, darker]) {
      if (!side.color) continue;
      scanAround(side, 8, 1);
      // Keep walking along the threshold until no neighbor is any closer.
      let previous;
      do {
        previous = side.distance;
        scanAround(side, 3, 1);
      } while (side.distance < previous);
    }

    return pickCloser();
  }

  /**
   * One entry per threshold the pair fails, lowest first. Each has either a
   * `color` to switch to, or `color: null` plus `best` when the background makes
   * the threshold unreachable for every possible foreground.
   */
  function suggestions(fg, bg) {
    const current = ratio(fg, bg);
    return TIERS.filter((tier) => current < tier.min).map((tier) => {
      const color = nearestPassing(fg, bg, tier.min);
      return color
        ? { min: tier.min, label: tier.label, color, ratio: ratio(color, bg) }
        : { min: tier.min, label: tier.label, color: null, best: bestPossible(bg) };
    });
  }

  return {
    CHECKS,
    TIERS,
    parseHex,
    toHex,
    luminance,
    ratio,
    formatRatio,
    bestPossible,
    nearestPassing,
    suggestions,
  };
})();

if (typeof module !== 'undefined') module.exports = Contrast;
