# Changelog

Every version of Roost Atelier, newest first. Update from HACS, then restart Home Assistant.

## 0.21.2 — 2026-11-26
- **The Atelier page and the dashboard card load again.** 0.21.1 was released without five of its built files, so both failed to open after installing it. Every file is now included.
- **A release can no longer miss files.** The tests now follow every file the panel loads and stop if one is missing or not committed, and the release checks that what is published matches a fresh build.

## 0.21.1 — 2026-11-23
- **Furniture from a photo is safer and never slows Home Assistant.** The photo check and copy now run off Home Assistant's main loop, and only photos the Atelier uploaded itself can be used.
- **Install steps** now lead with searching for Roost Atelier in HACS.

## 0.21.0 — 2026-11-21
- **See-through pictures from above.** The whole-floor dashboard picture is now taken with the walls cut low, like the Atelier's own 3D, so you can see into every room.
- **Fixed: black dashboard pictures on laptops.** On a laptop's built-in graphics chip, tracing a photo in big pieces stalled the chip, which the computer then reset (every picture went black, and the browser could block 3D for the page). Photos are now traced in small pieces, at half size with fewer light bounces on such chips, then cleaned up and enlarged smoothly, so they take minutes instead of stalling. If a chip still stalls, the next try uses smaller pieces, and after a second stall plain 3D pictures are made for a week instead of asking for 3D again.
- **Each room close up from above.** Make dashboard pictures now also makes a close-up of each room from the same angle. Roost Cards 1.28 zooms in to it when you tap a room (choose this in the Home Tour card's settings).

## 0.20.0 — 2026-11-21
- **Draw rooms with lines.** In Rooms, pick Line and tap the plan corner by corner to draw walls. Every space the line closes becomes an area you can name: a line across a room cuts it in two, a line from a wall out and back closes a new area, and a line back to its start is an area of its own. It snaps to walls, corners and straight angles (hold Alt for any angle). Rectangle still works as before.
- **Trace over a drawing.** When a CAD drawing, PDF or picture is not read well, put it under the plan as a guide (Import → Trace over a drawing, or Trace over it instead after reading a plan). Set its size by tapping the two ends of a length you know and typing the real length, move it into place, set how see-through it is, draw the walls over it with Line, then remove it.
- **Pictures outside the windows.** In the home settings, under Outside the windows, choose Pictures and add a photo of the view for each side of the home (top, right, bottom and left of the plan). It is seen through the windows on that side, in 3D and in the dashboard pictures, instead of the 3D trees.
- **More realistic dashboard pictures.** On computers without the AI clean-up, the grain of the traced light is now smoothed away while edges, corners and textures stay sharp. Lamps light from a small glowing area instead of a single point, so their shadows are soft. Plain 3D pictures are drawn twice as big and shrunk, so their edges are smooth.
- **Real sky only in the pictures.** The real sky is no longer shown in the editor. It still lights the rooms in photos and dashboard pictures, and shows past the garden and through the windows there. Turn it on or off in the home settings as before.
- **Device buttons in the 3D view work on every press.** A press that starts on a button always switches the device, once, even if the view moves under your finger.
- **Device outlines in the Home Tour sit right on each device.** Every dashboard picture now carries where each device really is, so Roost Cards can outline it exactly. Make the dashboard pictures again to get them.

## 0.19.3 — 2026-11-21
- The plan's buttons (sizes, print, zoom) and the Ceiling button show their icons in place again, instead of piled on top of each other.

## 0.19.2 — 2026-11-21
- **Dashboard pictures on any computer.** When the graphics chip stops tracing, or the picture comes out black, the photo and the 360° view are drawn the plain 3D way with the home's stored light, on the 3D view's own drawing surface (no new one is asked for, which a struggling chip may refuse). Tracing that stops moving is noticed in seconds instead of waiting forever.

## 0.19.1 — 2026-11-21
- **Dashboard pictures are never black.** On computers whose graphics chip gives up on the realistic tracing (some Intel laptops), each picture is drawn the normal 3D way instead, with the home's stored light. A computer where the AI clean-up failed once skips it from then on.

## 0.19.0 — 2026-11-20
- **Tape measure**: measure between any two points on the plan (it snaps to walls and corners; Shift for a straight line) and keep it on the plan as a dimension line.
- **Ceiling height per room**: a lower ceiling for any room; walls, lights and ceiling pieces follow it.
- **Columns and beams**: square and round columns floor to ceiling, beams under the ceiling.
- **Notes**: write notes anywhere on the plan; they print with it.
- **Lock in place**: rooms, doors, windows, furniture, devices and notes can be locked so they can't be moved by accident.
- **Feature walls**: one wall of a room in its own paint, wallpaper, stone, marble, wood slats or classic panels.
- **Gypsum ceilings**: a lowered border round the room, with or without a hidden light, and a cornice.
- **Skirting and frames**: skirting in white, black, wood or the floor's finish; door and window frames and doors in the colour you choose.
- **Your own materials**: upload a photo of a tile, wood, stone or fabric and use it on floors, feature walls and furniture.
- **Fitted joinery**: a built-in wardrobe (up to the ceiling) and a TV wall, and *Fit to the wall* for wardrobes, kitchen runs, TV units and shelves.
- **Finishes per piece**: wood and metal for each piece of furniture, besides its fabric.

## 0.18.3 — 2026-11-20
- **Copy, cut and paste**: pick devices or furniture, then Ctrl+C (copy), Ctrl+X (cut) and Ctrl+V (paste). They are pasted where the mouse is, also on another level.

## 0.18.2 — 2026-11-20
- **Now free and open source (MIT licence)** for everyone, also for commercial use, so it can be listed in the Home Assistant Marketplace.

## 0.18.1 — 2026-11-20
- Arabic (and the other languages) now show in your device's own clear font, the same as Roost Cards.

## 0.18.0 — 2026-11-20
- **Languages**: Arabic, Spanish, Russian and Simplified Chinese, besides English. Pick one in the home settings (Language); Auto follows Home Assistant. Arabic turns the whole page right-to-left.
- **Real sky**: a real sky photo all round the house (noon, afternoon, sunset or night, to match the time of day), downloaded once by Home Assistant. On by default; turn it off in the home settings.
- **An icon for everything**: every piece of furniture, light, device and stairs has its own drawn icon; the name shows when you rest the mouse on it. Sockets are drawn to the UK standard.
- **35 more pieces of furniture** (from the IKEA range): sideboard, display cabinet, cube shelf, bunk bed, cot, dressing table, dishwasher, microwave, tumble dryer, sun lounger, parasol, barbecue and more, with new Hall and Laundry groups.

## 0.17.0 — 2026-11-20
- **Dashboard pictures are no longer black.** On some graphics chips the AI clean-up lost its connection; it now reconnects, and if it still can't, the picture is kept as traced. A black picture is never saved.
- **Time of day**: Now, morning, noon, golden hour or night, in the home settings.
- **A garden round the house**: lawn, a paved terrace, olive trees and cypresses, lit by their own sun so they look right at any hour.
- **Real scanned textures** for oak, walnut, herringbone, porcelain, marble, deck, grass and terrace paving (Poly Haven, free to use), downloaded once by Home Assistant and kept there; walls get a real plaster grain.
- **Softer night**: dark corners and the outside stay readable; no light bleeding into the next room or onto the plinth; softer spotlight edges; window sills no longer flicker into jagged black shadows.
- **Selecting**: Ctrl+A picks every device (Ctrl+Shift+A everything); drag on an empty spot to pick with a box (right-drag or Space + drag moves the plan); *All like this*, *All in this room* and *Everything else*.
- **Groups**: pick several devices and *Group these devices*; in Try it, switching one switches them all.
- **Editing never switches devices**; tapping one picks it. Switching is for Try it.
- Every device can be pressed, also when several sit close together.
- Stair openings are really cut through the floor above, with a solid floor edge, and the flight stays inside the room.
- Buttons always hold their text, and every text box has the Atelier's look.

## 0.16.0 — 2026-11-20
- **Stairs that join two levels.** Pick *Stairs*, choose a style, tap where they start, then tap where they arrive on the level above. The stairs are built between the two, the floor above gets an opening with a railing, and the ceiling below opens too. Six styles: wooden, wrought iron with scrolls, glass, round (spiral), rounded first steps, and palace stairs with a red runner and a curled handrail. A selected staircase can change style or where it arrives.
- **Try it.** A new button in the top bar: tap lights, TVs, ACs, fans, curtains and doors to switch them, without opening anything for editing.
- **Devices switch even without a working entity**, just on the screen, so a home can be tried out before it is linked.
- **The real Roost Home Tour card as the preview**, opening by itself once the dashboard pictures are made (when Roost Cards is installed).
- **Smarter placing of Home Assistant devices**: one TV per room, on the TV drawn on the plan, and one AC for about every 25 m², never on a wall with a window or the TV.
- **No more black photos**: when the AI clean-up returns an empty picture on some graphics chips, the photo is kept as it was traced.
- Dragging the Top view moves the plan; panning the 2D plan is smoother; the ruler button stays clear when on.

## 0.15.0 — 2026-11-20
- **Your devices place themselves.** After you draw the floor plan, the lights, ACs, curtains, fans, TVs, locks and other devices from Home Assistant are put in the matching rooms by their Home Assistant area: lights spread evenly, the AC on a wall without a window, curtains on the windows, the TV facing the sofa, the fan in the middle. Rooms whose names don't match can be matched by hand, and *Place them now* in the home settings runs it again.
- **Several room photos at once.** The photo import takes many pictures in one go and adds the furniture, windows, doors, fans and ACs it sees, leaving out what is already there.
- **Many more light fittings**, grouped like a lighting shop: surface, deep and square downlights, anti-glare spots, aluminium profiles, linear and neon lights, glass and filament pendants, linear pendants, wall lights (up/down, up, down and reading arm), table and desk lamps, wall washers, step lights, garden bollards, ground uplights and floodlights, with style, finish and height choices.
- **Smoother editing.** Dashboard pictures are made only when you press *Make dashboard pictures*, no longer by themselves in the background.
- A picked room no longer shows its wall sizes twice.
- Safer saving: every id in a home is cleaned when it is saved and loaded, and pictures are sent with a safe content type.

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
