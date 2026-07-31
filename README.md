[![Netlify Status](https://api.netlify.com/api/v1/badges/19e83ddd-4757-4e21-9f7b-89e723b49123/deploy-status)](https://app.netlify.com/sites/konijn/deploys)

# 🐰 Konine 🐇 KO9 🐰

Very konijn indeed.
Check out the [Konijn](https://www.konine.art/).

## Developing

Install dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Stampkonijn development

The game is being split into focused TypeScript systems while preserving the existing Svelte API. See [the architecture notes](docs/stampkonijn-architecture.md) for module ownership and the migration order.

Static room geometry is loaded from a GLB plus a validated level manifest and can be edited in Blender. See [the Blender level workflow](art/levels/README.md) for the migration generator, naming, custom properties and export commands.
