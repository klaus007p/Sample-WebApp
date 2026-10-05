# Haldiram's Mithai Shop Website

A production-ready static website for an Indian sweet shop. It uses plain HTML, CSS, and vanilla JavaScript, so you can host it on GitHub Pages, Netlify, or any static host.

## File Structure

```text
index.html
css/styles.css
js/app.js
js/products.js
js/tests.js
tests.html
sw.js
assets/images/
assets/icons/favicon.svg
```

## Edit Shop Details

Open `js/app.js` and edit the `CONFIG` object at the top:

```js
shopName: "Haldiram's",
tagline: "Pure ghee sweets, made fresh daily",
phoneDisplay: "+91XXXXXXXXXX",
whatsappNumber: "91XXXXXXXXXX",
address: "FULL ADDRESS",
hoursLabel: "9:00 AM - 10:00 PM, all days",
mapsLink: "",
instagramLink: "",
```

Use the WhatsApp number without `+`, spaces, or dashes in `whatsappNumber`.

To adjust the open/closed calculation, edit:

```js
openingHours: {
  days: [0, 1, 2, 3, 4, 5, 6],
  open: "09:00",
  close: "22:00"
}
```

Days use `0` for Sunday through `6` for Saturday. Overnight hours are supported.

Also update the SEO placeholders in `index.html`: canonical URL, Open Graph image, JSON-LD address, phone, and opening hours.

## Add Or Edit Sweets

All product data lives in `js/products.js`. Add or edit objects in `window.MITHAI_PRODUCTS`.

Each product supports:

```js
{
  id: "p001",
  slug: "kaju-katli",
  name: "Kaju Katli",
  hindiName: "काजू कतली",
  category: "Dry Fruit",
  description: "Diamond-cut cashew fudge finished with delicate silver varq.",
  pricePerKg: 1280,
  minOrderGrams: 250,
  isVeg: true,
  isBestseller: true,
  isAvailable: true,
  tags: ["cashew", "premium", "gift"],
  emoji: "◇"
}
```

Allowed categories are `Milk-based`, `Ghee-based`, `Dry Fruit`, `Bengali`, `Halwa`, and `Festival Special`.

## Add Real Product Photos

Drop WebP photos into `assets/images/` using each product slug:

```text
assets/images/kaju-katli.webp
assets/images/motichoor-ladoo.webp
assets/images/rasmalai.webp
```

The site tries `assets/images/<slug>.webp` first. If a file is missing, it automatically shows the polished gradient fallback with the product emoji, so customers never see a broken image icon.

Recommended image size: `960 x 720` or larger, cropped around the sweet, exported as WebP.

## Change Colours And Fonts

Theme colours are CSS custom properties at the top of `css/styles.css`:

```css
--cream: #fff7e8;
--saffron: #ee9b22;
--gold: #c8962e;
--maroon: #7a1f2b;
--pistachio: #7c9b52;
```

Fonts are assigned in `css/styles.css` using fast system fallbacks so the site stays quiet and readable offline:

```css
--font-display: Georgia, "Times New Roman", serif;
--font-body: "Segoe UI", system-ui, sans-serif;
```

If you want Google Fonts later, add the font link in `index.html` and update these two variables.

## Run Tests

Open `tests.html` in a browser and click **Run tests**. The page checks:

- price calculation
- cart merge behavior
- quantity limits
- search with special characters
- localStorage fallback
- WhatsApp URL encoding

Results also appear in the browser console.

## Deploy For Free

### GitHub Pages

1. Create a GitHub repository.
2. Upload all files in this folder.
3. Go to repository **Settings > Pages**.
4. Set the source branch to `main` and folder to `/root`.
5. Save and open the Pages URL once GitHub finishes publishing.

### Netlify

1. Go to Netlify and create a new site.
2. Drag and drop this folder into the deploy area, or connect your GitHub repository.
3. No build command is needed.
4. Publish directory should be the project root.

## Notes

- The site works without a backend.
- Cart data is saved in `localStorage` when available and falls back to in-memory storage if blocked.
- The service worker caches core files on supported hosted origins for repeat visits.
- JavaScript-disabled visitors still see readable content and contact links.
