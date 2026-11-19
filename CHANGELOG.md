# Changelog

Every version of Roost Atelier, newest first. Update from HACS, then restart Home Assistant.

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
