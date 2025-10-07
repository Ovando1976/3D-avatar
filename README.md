# 3D Avatar Playground

A React + Vite experience for exploring a stylised 3D avatar rendered with `react-three-fiber`. Adjust the avatar colours, lighting and environment HDRI presets with a friendly control panel.

## Getting started

```bash
npm install
npm run dev
```

The dev server defaults to http://localhost:5173. Use the sliders and colour pickers to tailor the scene. Try the preset themes for quick inspiration.

## Building for production

```bash
npm run build
npm run preview
```

The build command outputs static assets in `dist/`, and `npm run preview` serves the production build locally.

## Features

- Breathing, stylised avatar constructed from primitive geometry
- Floating accessory that orbits the character
- Adjustable lighting rig (key, fill, rim)
- Environment presets and background colour tweaks
- Modern glassmorphism control panel

## Tech stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Three.js](https://threejs.org/) via [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- [`@react-three/drei`](https://github.com/pmndrs/drei) helper collection
- [`zustand`](https://github.com/pmndrs/zustand) for local state management
- [`react-colorful`](https://github.com/omgovich/react-colorful) for accessible colour pickers
