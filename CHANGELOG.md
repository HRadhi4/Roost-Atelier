# Changelog

Every version of Roost Atelier, newest first. Update from HACS, then restart Home Assistant.

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
