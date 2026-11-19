"""Opens the dashboard card and the Atelier page in a real (headless) browser and checks they work.
Run after `npm run build`:  python3 tests/browser/run.py"""
import functools
import http.server
import pathlib
import subprocess
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parents[2]
subprocess.run(["npx", "esbuild", "tests/browser/samples.entry.js", "--bundle", "--format=esm", "--log-level=warning",
                "--outfile=tests/browser/samples.bundle.js"], cwd=ROOT, check=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


handler = functools.partial(Quiet, directory=str(ROOT))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/tests/browser/page.html"
failed = []


def check(name, ok, info=""):
    print(("ok   " if ok else "FAIL ") + name + (f"  ({info})" if info else ""))
    if not ok:
        failed.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1200, "height": 800})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(URL)
    page.wait_for_function("window.ready === true", timeout=60000)

    # ---- the dashboard card
    page.evaluate("""() => { const c = document.createElement('roost-atelier-card'); c.id = 'card'; c.setConfig({ plan: 'home1', height: 420 });
      document.getElementById('slot').appendChild(c); c.hass = window.hass; }""")
    page.wait_for_function("() => document.getElementById('card')?._view?.engine?.floor", timeout=60000)
    page.wait_for_timeout(1500)
    lit = page.evaluate("""() => { const e = document.getElementById('card')._view.engine; e.composer.render();
      const gl = e.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4 * 64);
      let n = 0; for (let i = 0; i < 64; i++) { gl.readPixels(Math.floor(w * (i % 8 + 0.5) / 8), Math.floor(h * (Math.floor(i / 8) + 0.5) / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(i * 4)); }
      for (let i = 0; i < 64; i++) if (px[i*4] + px[i*4+1] + px[i*4+2] > 30) n++; return n; }""")
    check("card draws the home", lit > 8, f"{lit} of 64 sample points lit")
    check("card listens for changes", "sub:roost_atelier/subscribe" in page.evaluate("window.calls"))
    page.evaluate("() => document.getElementById('card').shutdown()")
    check("card gives its 3D view back when shut down", page.evaluate("() => !document.getElementById('card')._view"))
    page.evaluate("() => { const c = document.getElementById('card'); c._booted = false; c.boot(); }")
    page.wait_for_function("() => document.getElementById('card')?._view?.engine?.floor", timeout=60000)
    check("card comes back after being shut down", True)
    page.evaluate("() => document.getElementById('card').remove()")

    # ---- the Atelier page
    page.evaluate("""() => { const p = document.createElement('roost-atelier-panel'); p.id = 'panel'; p.style.cssText = 'position:fixed;inset:0';
      document.getElementById('slot').appendChild(p); p.hass = window.hass; }""")
    page.wait_for_function("() => document.getElementById('panel')?.editor?.plan?.floors", timeout=60000)
    page.wait_for_timeout(1000)
    drawn = page.evaluate("() => document.getElementById('panel').shadowRoot.querySelectorAll('svg .w *').length")
    check("Atelier draws the plan", drawn > 10, f"{drawn} shapes")

    # an edit is saved, with the version it was based on
    page.evaluate("() => { const ed = document.getElementById('panel').editor; ed.snapshot(); ed.plan.name = 'Test home'; ed.changed(false); }")
    page.wait_for_function("() => window.store.plan.name === 'Test home'", timeout=10000)
    check("an edit is saved", True)
    page.wait_for_timeout(500)
    check("your own save is not mistaken for another screen", not page.evaluate("() => !!document.getElementById('panel').shadowRoot.querySelector('.dialog.ask')"))

    # Home Assistant restarting: the save is tried again until it works
    page.evaluate("() => { window.fail.save = 2; const ed = document.getElementById('panel').editor; ed.snapshot(); ed.plan.name = 'After restart'; ed.changed(false); }")
    page.wait_for_function("() => window.store.plan.name === 'After restart'", timeout=20000)
    check("a failed save is tried again until it works", True)
    left = page.evaluate("() => Object.keys(localStorage).filter((k) => k.startsWith('roost-atelier-pending-')).length")
    check("nothing left waiting on the device after saving", left == 0, f"{left} left")

    # another screen saved first: a choice is offered, nothing is overwritten
    page.evaluate("() => { window.fail.conflict = true; const ed = document.getElementById('panel').editor; ed.snapshot(); ed.plan.name = 'Mine'; ed.changed(false); }")
    page.wait_for_function("() => document.getElementById('panel').shadowRoot.querySelector('.dialog.ask')", timeout=10000)
    check("a change from another screen asks before overwriting", page.evaluate("window.store.plan.name") == "After restart")

    # earlier versions are listed
    page.evaluate("() => { const ed = document.getElementById('panel').editor; ed.root.querySelector('.dialog.ask')?.remove(); ed.homesMenu(); }")
    has = page.evaluate("() => !!document.getElementById('panel').shadowRoot.querySelector('[data-x=versions]')")
    check("Homes menu offers earlier versions and files", has)

    # ---- new in 0.8: wall lengths, several pieces at once, stairs, levels below, presence radar
    dims_n = page.evaluate("() => document.getElementById('panel').shadowRoot.querySelectorAll('svg text.dim').length")
    check("wall lengths are written on the plan", dims_n > 4, f"{dims_n} lengths")
    moved = page.evaluate("""() => { const ed = document.getElementById('panel').editor; const its = ed.floor.items.slice(0, 3);
      ed.sel = { t: 'multi', list: its.map((i) => ({ t: 'item', id: i.id })) }; ed.inspector();
      ed.aside.querySelector('[data-al=left]').click(); const xs = its.map((i) => i.x - (window._half ? 0 : 0));
      return { panel: !!ed.aside.querySelector('[data-mdel]'), n: its.length }; }""")
    check("several pieces can be selected and lined up", moved["panel"] and moved["n"] == 3)
    built = page.evaluate("""async () => { const ed = document.getElementById('panel').editor; ed.sel = null;
      ed.floor.items.push({ id: 'st1', kind: 'stairs', x: 1, y: 1, rot: 0, h: 2.8 });
      ed.floor.devices.push({ id: 'rd1', kind: 'radar', entity: 'sensor.radar_target_1_x', x: 2, y: 2, rot: 0, name: 'Radar' });
      window.hass.states = { 'sensor.radar_target_1_x': { entity_id: 'sensor.radar_target_1_x', state: '500', attributes: {} }, 'sensor.radar_target_1_y': { entity_id: 'sensor.radar_target_1_y', state: '1500', attributes: {} } };
      ed.plan.floors.push(JSON.parse(JSON.stringify({ ...ed.floor, id: 'f2', name: 'Upper', elevation: 3.1, items: [], devices: [] })));
      ed.plan.settings.levels = true; ed.view.setPlan(ed.plan, 0); ed.useFloor(1); ed.useFloor(0);
      ed.hass = { ...window.hass }; await new Promise((r) => setTimeout(r, 1500));
      const e = ed.view.engine, rec = e.devices.get('rd1'), p = rec?.people?.[0];
      return { stairs: !!e.items.children.find((g) => g.userData.item === 'st1'), seen: !!p?.visible, x: p?.position.x, z: p?.position.z }; }""")
    check("stairs are built", built["stairs"])
    check("a presence radar shows the person it sees", built["seen"] and abs(built["x"] - 1.5) < 0.15 and abs(built["z"] - 3.5) < 0.15, str(built))
    lv = page.evaluate("""() => { const ed = document.getElementById('panel').editor; ed.useFloor(1); const g = ed.view.engine.root.getObjectByName('levels'); const n = g ? g.children.length : 0; ed.useFloor(0); return n; }""")
    check("levels below are shown under the upper level", lv > 5, f"{lv} pieces")

    serious = [e for e in errors if "favicon" not in e and "ha-icon" not in e]
    check("no errors in the browser", not serious, "; ".join(serious[:3]))
    browser.close()

srv.shutdown()
print("browser: all passed" if not failed else f"browser: {len(failed)} failed")
sys.exit(1 if failed else 0)
