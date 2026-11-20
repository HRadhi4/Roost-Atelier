# Changelog

Every version of Roost Atelier, newest first. Update from HACS, then restart Home Assistant.

## 0.14.0 — 2026-11-20
- **The pictures card moved to Roost Cards.** The Atelier now only designs the home and makes its pictures; the new **Roost Home Tour** card in Roost Cards shows them. Add it from the card picker after updating Roost Cards.
- A new, light message gives dashboard cards just what they need to show the pictures (rooms, doors and devices, and which pictures are made).
- The Atelier no longer adds its own card to the card picker. Dashboards that already use its live 3D card keep working.

## 0.13.0 — 2026-11-20
- **The dashboard card is now made of pictures, not a 3D program.** Design the home in the Atelier, press *Make dashboard pictures* in the home settings, and the card shows the finished photo of the whole floor and a 360° picture of every room. Tap a room to step in, drag to look around, follow the arrows on the doors to the next room, or use the room buttons along the bottom. Every device is a button on the picture with its controls, and lights that are on glow in their own colour and brightness.
- **Much lighter.** The picture card loads about 77 KB and no 3D engine, so it opens fast on phones and wall tablets. New cards use it by default; the live 3D, top and walk views are still there as choices.
- **Preview** in the home settings shows the card as it will look on the dashboard.
- Every photo now carries the camera it was taken with, so device buttons land exactly on the device.

## 0.12.0 — 2026-11-19
- **360° views of every room.** In the home settings, *Make 360° views* goes through each room and makes a realistic all-round picture from the middle of the room, with the real light. It runs on this computer in the background (a few minutes per room) and keeps them in Home Assistant.
- **A room card in 360°.** Set the card's view to *One room in 360°* and pick the room: drag to look around, pinch or scroll to zoom, and every light, AC, curtain and TV of that room sits where it really is. Tap one for its controls.

## 0.11.0 — 2026-11-19
- **Tap a device to control it.** On the dashboard card, tapping a light, AC, curtain, TV, fan or lock opens a small pop-up next to it with what that device needs: on and off, brightness and warmth for lights, temperature and modes for the AC, open, stop, close and how open for curtains, volume, play and source for the TV, speed for fans. *More* opens the full details.
- **Walking in a room shows a side panel** with the device you tapped and everything else in that room, each with its own controls.
- The card's settings have a new choice, *Tapping a device*: show its controls (the new default) or simply turn it on or off as before.

## 0.10.0 — 2026-11-19
- **Reading a room photo works with no setup.** A small AI now runs on your own phone or computer: it finds sofas, beds, tables, chairs, kitchen units, the fridge, bathroom fittings, ceiling lights, curtains, windows, the AC and the TV, counts them and sees where they are. The photo never leaves the device. The first time, it downloads its reading model (about 150 MB) once; after that it starts straight away.
- If an AI provider is connected in Home Assistant (for example Google Gemini) you can pick it instead, for finer detail such as light types and sizes.

## 0.9.0 — 2026-11-19
- **A photo of a room fills the room.** Furniture, ceiling lights, curtains, windows, doors, the air conditioner and the TV are found in the photo, counted and put where they are: tell it which wall you were facing and check the list before adding. Curtains get a window behind them, and lights, the AC, curtains and the TV are linked to the devices in the Home Assistant area with the room's name. Needs an AI provider in Home Assistant (for example Google Gemini).
- **New ceiling lights:** twin recessed spots, square and round LED panels, magnetic slot lights with lit bars, woven basket pendants and candle chandeliers.
- **New furniture:** wall cabinets, tall cabinets, an oven tower, hob with oven, sink cabinet, cooker hood, wall basin, LED mirror, towel rail, extractor fan, lounge chair, a TV on its feet, wall panelling, round and leaning mirrors.
- **Fix:** the plan's buttons (zoom, fit, ceiling, sizes, print) work again in split view on a phone.

## 0.8.1 — 2026-11-19
- **Edits redraw faster:** rooms that did not change keep their floor and ceiling shapes, and preparing the home for its stored light makes far fewer temporary lists.

## 0.8.0 — 2026-11-19
- **Presence radar:** add a *Presence radar* device (Athom, LD2450 and similar), pick its *target 1 x* sensor and turn it to face the room. Each person it sees walks in the right spot in 3D and shows as a dot on the plan; the plan also shows where the radar looks. *Flip left and right* fixes a sensor mounted the other way.
- **Wall lengths on the plan** (the ruler button hides them) and a **printable plan** (printer button): a clean plan on white paper with room names, areas and a scale bar.
- **Stairs** in the new *Building* furniture tab, as tall as the level.
- **Show the levels below in 3D** (Settings): the lower levels are drawn under the one you are on.
- **Several pieces at once:** Shift or Ctrl + tap, or *Select several* on a phone. Move them together, line them up, spread them evenly, copy or delete them.
- Fix: your own save is never mistaken for a change from another screen.

## 0.7.0 — 2026-11-19
- **Editing feels lighter.** Each change used to freeze the page for about half a second while the stored light was matched to the home again; that step is now about three times faster (same light, nothing to recalculate).
- **No rebuild when nothing changed:** a save from another screen that does not touch this level, or the same home loaded again, no longer rebuilds the 3D home.
- **More memory given back:** doors, windows, curtains, lamps and the TV screen made their own copies of materials on every rebuild and never freed them.
- **Automatic browser checks:** every change to the code now opens the dashboard card and the Atelier page in a real browser and checks that the home is drawn, edits are saved, a failed save is tried again, and a change from another screen asks before overwriting.

## 0.6.0 — 2026-11-19
- **Opens faster.** The worked-out light of a home (about 7 MB) was downloaded every time a dashboard or the Atelier opened; screens now keep their copy until the light changes. The Atelier's own files are kept by the browser too.
- **Sky pictures only for photos.** The 1.5 MB sky pictures were downloaded for normal viewing even though only photos use them; now they load only when a photo is made.
- **Stays smooth for hours.** Graphics memory is given back when the home is rebuilt, when a room is removed, and when you leave a dashboard (after a minute away). If the browser drops the 3D view, it rebuilds by itself instead of staying blank.
- **Less work when nothing changes.** The light mix is no longer recalculated 60 times a second while the home is still.
- **Dashboards stay calm while you edit:** they redraw once you pause, not after every save.
- **Storage stops growing:** once a day, uploads no home uses any more and the light and photos of deleted homes are removed.

## 0.5.1 — 2026-11-19
- **Your work is never lost.** If Home Assistant is restarting or the connection drops, the Atelier keeps trying to save, and keeps your changes on this device meanwhile. Closing the page with unsaved changes asks first.
- **Earlier versions:** the last 10 versions of each home are kept. Homes menu → Earlier versions brings one back (Undo takes it away again).
- **Deleted homes** can be brought back from the Homes menu.
- **Save to a file / Load from a file** in the Homes menu, to back a home up or move it to another Home Assistant.
- **Two screens:** if the same home is changed on another screen, you are told and can choose which version to keep. Nothing is overwritten silently.
- Numbered releases with notes from now on.

## 0.5.0 — 2026-11-19
- Recessed spots, track, linear, cove and focus lights; ceiling mode with line-up guides, grids and typed positions; real floor reflections.
- One switch for every light in a room; type the width and length of any room.

## 0.4.0 — 2026-11-19
- Calm, steady lighting: daylight sets the exposure, lamps add a soft capped glow, gentler sun.

## 0.3.1 — 2026-11-19
- Still pictures always sharp, lighter furniture preview, strong Intel graphics get full quality.

## 0.3.0 — 2026-11-19
- Photos of the whole floor and every room made in the background, with a progress bar.

## 0.2.0 – 0.2.9 — 2026-11-19
- Baked real-world light and local AI photos, typed sizes, walking with keys, tap the plan to walk there, smoother on laptops, fixes.

## 0.1.x — 2026-11-18
- First versions: draw rooms, import drawings, furniture, live devices on dashboards.
