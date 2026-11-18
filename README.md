# Roost Atelier

**Build your home in realistic 3D by drag and drop, then watch it live on your Home Assistant dashboards: lights, curtains, ACs, doors and people.**

[![HACS](https://img.shields.io/badge/HACS-Custom-6D4BFF.svg)](https://hacs.xyz)
[![Validate](https://github.com/HRadhi4/Roost-Atelier/actions/workflows/validate.yml/badge.svg)](https://github.com/HRadhi4/Roost-Atelier/actions/workflows/validate.yml)
![Licence](https://img.shields.io/badge/licence-free%20for%20personal%20use-8B6CFF)

Roost Atelier is a home designer that lives inside Home Assistant. You draw the rooms with your finger, drop in furniture and devices, and you get a lifelike 3D model of your home. Put that model on any dashboard and it comes alive: lamps glow and light the floor, curtains slide, doors swing open, the AC blows air, the TV plays, and the sun moves across the rooms at the real time of day.

You don't need to know any design software or write code.

It is part of the **Roost** family, alongside [Roost Cards](https://github.com/HRadhi4/Roost-card).

---

## What you can do

### Design
- **Draw rooms** by dragging a rectangle. Pull a corner or a wall to resize it, and the rooms next to it follow, so walls stay joined.
- **Add doors, windows, sliding doors and arches** by tapping a wall. Slide them along the wall, change the width with a slider, and flip which way the door opens.
- **Furnish** from a library of about 40 pieces: sofas, beds, dining sets, majlis seating, kitchens, bathrooms, plants and lamps. Drag a piece near a wall and it turns to face the room and sits flat against the wall, the way a designer would place it.
- **Pick finishes** with one tap: wood, herringbone, porcelain, marble, terrazzo and carpet floors, nine wall paints, and fabric colours.
- **Check the home**: the Atelier points out rooms with no door, bedrooms with no window, furniture blocking a door, and devices that aren't linked yet. Many of these it can fix in one tap.
- **Undo and redo** everything. Your work saves automatically.

### Import
- **From CAD, PDF or a picture of a plan** (DXF, PDF, JPG, PNG): walls become rooms, and gaps in the walls become doors and windows. Named furniture blocks in a DXF become furniture.
- **From a photo of a room**: Home Assistant's own AI (any AI Task, such as Google Gemini, OpenAI or a local model) recognises each piece of furniture with its colour and size, and you add them in one tap.

### Live on your dashboards
- **Lights** glow in their real colour and brightness and cast soft shadows.
- **Curtains and blinds** open to their real position.
- **Doors** swing open when a door sensor opens.
- **ACs** show moving air when they're on. **Ceiling fans** turn. **TVs** light up.
- **People** appear when they're home.
- **The sun** follows `sun.sun`, so mornings, sunsets and nights look right, and you can set where north is.
- **Tap** a device to switch it. **Press and hold** to open its details.
- **Three views**: a 3D overview, a top-down plan, and walk-through, where you stand inside a room.
- **Photo mode**: leave the home still for a moment and it refines into a photo-real render with soft light bounces and reflections.

### Smooth on tablets
The home is only redrawn when something changes. While you drag, it draws at lower sharpness and sharpens again when you let go. Quality adjusts to your device automatically, or you can choose it yourself. The dashboard card loads a 6 KB file; the 3D engine loads only when a card is on screen.

### English and Arabic
Follows your Home Assistant language. In Arabic the whole layout switches to right-to-left.

---

## Install

### With HACS (recommended)
1. Open **HACS**, then the menu in the top corner, then **Custom repositories**.
2. Add `https://github.com/HRadhi4/Roost-Atelier`, with type **Integration**.
3. Search for **Roost Atelier**, install it, and restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration**, and add **Roost Atelier**.

### By hand
Copy `custom_components/roost_atelier` into your `config/custom_components` folder, restart, and add the integration as in step 4.

**Atelier** now appears in the sidebar (administrators only). You don't need to add any dashboard resource: the card is available on every dashboard right away.

---

## Your first home in five minutes

1. Open **Atelier** in the sidebar.
2. Start from a ready-made home (apartment, villa with majlis, or studio), or start blank, or import a drawing.
3. Pull the walls until the rooms match your home. Tap a room to choose its type, floor and wall colour.
4. Open **Furniture** and drag pieces in. Open **Devices** and drag in your lights, ACs, curtains and TV, then link each one to its Home Assistant entity.
5. Tap **Check the home**, then add the card to a dashboard.

## The card

```yaml
type: custom:roost-atelier-card
plan: ""          # leave empty for your first home, or choose one in the visual editor
height: 420       # in pixels
view: 3d          # 3d, top or walk
toolbar: true     # the 3D / Top / Walk / Photo buttons
hotspots: true    # the device buttons on the home
photo: false      # refine into a photo-real render when left still
quality: auto     # auto, low, medium or high
language: auto    # auto, en or ar
```

Everything above can also be set in the card's visual editor.

---

## Licence

Roost Atelier is **source-available**: anyone can read, use, change and share the code.

- **Free** for personal and other noncommercial use, under the [PolyForm Noncommercial License 1.0.0](LICENSE).
- **Commercial use** (installers and integrators working for clients, businesses, show homes, rental properties, or reselling) needs a **one-time licence per user**. See [COMMERCIAL.md](COMMERCIAL.md).

The bundled open-source libraries keep their own licences. See `custom_components/roost_atelier/frontend/THIRD-PARTY-LICENSES.txt`.

## For developers

```bash
npm ci --legacy-peer-deps
npm test          # plan and import checks
npm run build     # builds the frontend into custom_components/roost_atelier/frontend
```
