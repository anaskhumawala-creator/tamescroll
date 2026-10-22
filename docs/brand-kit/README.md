# tamescroll — brand assets

**Primary mark:** the unwound scroll — a feed coil relaxing into a flat line.
**Alternate mark:** ts monogram — tight spaces, stamps, favicons only.

## Colors
| Name | Hex | Use |
| --- | --- | --- |
| Night | `#141414` | app background, dark assets |
| Cream | `#e7e5e1` | ink on dark |
| Parchment | `#fdfbf5` | light background |
| Ink | `#26231d` | ink on light |
| Muted | `#a3a09a` | secondary text |
| Faint | `#757169` | labels, meta |

## Type
Spectral 600 for the wordmark and display. Inter 500/600 for UI and body.
PNG lockups fall back to a system serif if Spectral isn't installed locally — the **SVG lockups are authoritative**. Set them in real Spectral, or convert to outlines before print.

## Clear space & minimum size
Clear space on every side = 25% of the mark's height. Minimum mark size 20px; below that use `icons/favicon-32.png` or the monogram.

## Don't
Recolor the mark outside the palette · add shadow, gradient or outline to it · stretch or rotate it · place the lockup on imagery without a solid plate · pair it with any platform's real logo or brand color.

## Files
**brand/**
- `mark-cream.svg`, `mark-ink.svg` — mark only, transparent
- `mark-*-cropped.svg` — tight bounding box, for optical centering in layouts
- `lockup-horizontal-{dark,light}.svg` + `-transparent-{cream,ink}.svg`, `lockup-horizontal-{dark,light}-1600.png`
- `lockup-stacked-{dark,light}.svg`, `lockup-stacked-dark-1200.png`
- `monogram-ts-{dark,light,flat}.svg`, `app-icon-{dark,light}.svg`, `favicon.svg`

**icons/**
- `app-icon-1024-{dark,light}.png`, `icon-512.png`, `icon-192.png`, `favicon-64.png`, `favicon-32.png`
- `monogram-ts-1024-{dark,light}.png`

**social/**
- `og-image-1200x630.png` — Open Graph / general link preview
- `x-card-1200x600.png` — X summary_large_image
- `x-header-1500x500.png` — X profile header
- `linkedin-banner-1584x396.png` — LinkedIn page banner
- `avatar-1024-{dark,light}.png` — profile pictures, all platforms
- `instagram-post-1080.png`, `instagram-story-1080x1920.png`

## Meta tags
```html
<link rel="icon" href="/brand/favicon.svg">
<link rel="icon" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<meta property="og:image" content="https://tamescroll.com/social/og-image-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://tamescroll.com/social/x-card-1200x600.png">
```
