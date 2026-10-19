# Meltbead Chrome extension

Turn an image on a website into a fuse bead pattern. Right-click an image, select **Create a bead pattern with Meltbead**, then choose a brand palette, grid width, and color limit. You can also open the extension button and upload a local PNG, JPG, or WebP.

The editor previews the bead grid, shows exact color codes and bead counts, and exports a PNG pattern or CSV materials list. Image processing runs inside the extension on your computer. It does not upload source images to Meltbead.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this repository directory.
4. Right-click a webpage image and choose **Create a bead pattern with Meltbead**.

No build step or npm install is required. Use Node.js 18 or newer for `npm test` and `npm run check`.

## Permissions

- `contextMenus`: add the image right-click command.
- `storage`: hold the selected image URL between the right-click action and editor tab for the current browser session.
- Optional site access: requested only after you click **Load selected image**, and only for the image website. Some websites restrict image downloads even after access is granted; save the image and use the upload control in that case.

The extension button opens the editor for local uploads. The website link opens [Meltbead's pattern maker](https://meltbead.com/perler-bead-pattern-maker). To continue editing there, the extension downloads your source image and you upload it again in the website editor. Pattern state is not transferred automatically.

## Color data

The seven palettes match the sets available in Meltbead's website pattern maker. They are copied from [`@meltbead/bead-colors` 0.2.0](https://www.npmjs.com/package/@meltbead/bead-colors) so the extension runs entirely offline after an image is loaded. Data is a screen reference, not a guarantee of physical bead color or current product availability. Effect finishes are excluded from automatic RGB matching. See [third-party notices](vendor/THIRD_PARTY_NOTICES.md) and the bundled MIT notice for source attribution.

## Development

```sh
npm test
npm run check
```

This is a Manifest V3 extension written as browser-native JavaScript modules. To update the copied palettes, synchronize `vendor/palettes` from the published package and rerun the tests.
