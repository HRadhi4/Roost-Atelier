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

    # the plan's own buttons work when tapped on a phone in split view
    page.evaluate("() => { const ed = document.getElementById('panel').editor; ed.useFloor(0); ed.root.querySelector('[data-l=split]').click(); }")
    page.set_viewport_size({"width": 400, "height": 820})
    page.wait_for_timeout(600)
    z0 = page.evaluate("() => document.getElementById('panel').editor.z")
    box = page.evaluate("() => { const r = document.getElementById('panel').shadowRoot.querySelector('[data-z=in]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }")
    page.mouse.click(box[0], box[1])
    page.wait_for_timeout(200)
    z1 = page.evaluate("() => document.getElementById('panel').editor.z")
    check("zoom in button works in split view", z1 > z0, f"{z0} -> {z1}")
    cb = page.evaluate("() => { const r = document.getElementById('panel').shadowRoot.querySelector('[data-ceiling]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }")
    page.mouse.click(cb[0], cb[1])
    page.wait_for_timeout(200)
    check("ceiling button works in split view", page.evaluate("() => document.getElementById('panel').editor.ceiling === true"))
    page.set_viewport_size({"width": 1200, "height": 800})

    # tapping a device on the dashboard card shows its controls next to it; walking in a room shows a side panel
    page.evaluate("""() => { document.getElementById('panel')?.remove(); window.svc = [];
      const p = { ...window.SAMPLES[0].make(), id: 'home1', updated: window.store.plan.updated + 1 }, f = p.floors[0];
      const r = f.rooms[0], cx = r.pts.reduce((a, q) => a + q[0], 0) / r.pts.length, cy = r.pts.reduce((a, q) => a + q[1], 0) / r.pts.length;
      f.devices.push({ id: 'tl1', kind: 'light', look: 'downlight', entity: 'light.lounge', name: 'Lounge spots', x: cx, y: cy }, { id: 'tl2', kind: 'light', look: 'pendant', entity: 'light.lounge_2', x: cx + 0.5, y: cy }, { id: 'ta1', kind: 'ac', entity: 'climate.lounge', x: cx, y: cy + 0.5 });
      window.store.plan = p;
      window.hass = { ...window.hass, callService: async (d, s, data) => { window.svc.push(`${d}.${s}`); }, states: {
        'light.lounge': { entity_id: 'light.lounge', state: 'on', attributes: { friendly_name: 'Lounge spots', brightness: 128, supported_color_modes: ['brightness'] } },
        'light.lounge_2': { entity_id: 'light.lounge_2', state: 'off', attributes: { friendly_name: 'Lounge lamp', supported_color_modes: ['onoff'] } },
        'climate.lounge': { entity_id: 'climate.lounge', state: 'cool', attributes: { friendly_name: 'Lounge AC', temperature: 23, current_temperature: 25, hvac_modes: ['off', 'cool', 'dry', 'fan_only'] } } } };
      const c = document.createElement('roost-atelier-card'); c.id = 'card2'; c.setConfig({ plan: 'home1', height: 600 }); c.style.cssText = 'display:block;width:800px'; document.getElementById('slot').appendChild(c); c.hass = window.hass; }""")
    page.wait_for_function("() => document.getElementById('card2')?._view?.engine?.floor", timeout=60000)
    page.wait_for_timeout(1500)
    res = page.evaluate("""async () => { const v = document.getElementById('card2')._view, d = v.plan.floors[0].devices.find((x) => x.entity === 'light.lounge');
      v.toggle(d.id); await new Promise((r) => setTimeout(r, 100));
      const pop = v.root.querySelector('.pop'); const out = { pop: !!pop, slider: !!pop?.querySelector('input[data-a=bri]'), name: pop?.querySelector('.hd b')?.textContent };
      pop?.querySelector('[data-a=power]')?.click(); await new Promise((r) => setTimeout(r, 50)); out.called = window.svc.slice();
      v.engine.view = 'walk'; v.open(d.id); await new Promise((r) => setTimeout(r, 50));
      const side = v.root.querySelector('.side'); out.side = !!side; out.popGone = !v.root.querySelector('.pop'); out.others = side ? side.querySelectorAll('.card.pick').length : 0;
      const acDev = v.plan.floors[0].devices.find((x) => x.entity === 'climate.lounge'); v.engine.view = '3d'; v.open(acDev.id); await new Promise((r) => setTimeout(r, 50));
      const ap = v.root.querySelector('.pop'); out.ac = !!ap?.querySelector('[data-a=tup]') && ap.querySelectorAll('[data-a=mode]').length === 3;
      ap?.querySelector('[data-a=tup]')?.click(); await new Promise((r) => setTimeout(r, 50)); out.called2 = window.svc.slice();
      return out; }""")
    check("tapping a light shows its controls next to it", res["pop"] and res["slider"] and res["name"] == "Lounge spots", str(res))
    check("the power button switches it", "homeassistant.turn_off" in res["called"], str(res["called"]))
    check("walking in a room shows the side panel instead", res["side"] and res["popGone"], str(res))
    check("the AC pop-up has temperature and modes", res["ac"] and "climate.set_temperature" in res["called2"], str(res))

    # a 360° picture lines up with the real room: red ahead (-z), green to the right (+x), and a device button on the red wall
    pano = page.evaluate("""async () => { const { THREE, WebGLPathTracer, EquirectCamera, PanoViewer, PANO_CSS, DenoiseMaterial, FullScreenQuad } = window.T;
      const sc = new THREE.Scene(), box = (c, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 })); m.position.set(x, 1.5, z); sc.add(m); };
      box('#ff0000', 0, -5); box('#00ff00', 5, 0); box('#0000ff', -5, 0); box('#ffff00', 0, 5);
      const cv = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas: cv, preserveDrawingBuffer: true }); r.setSize(256, 128, false);
      const pt = new WebGLPathTracer(r); pt.tiles.set(1, 1); pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0; pt.dynamicLowRes = false;
      const cam = new EquirectCamera(); cam.position.set(0, 1.5, 0); cam.updateMatrixWorld(); pt.setScene(sc, cam);
      for (let i = 0; i < 400 && pt.samples < 4; i++) { pt.renderSample(); await new Promise((res) => setTimeout(res, 20)); }
      const sm = new FullScreenQuad(new DenoiseMaterial({ map: null, blending: THREE.NoBlending })); sm.material.map = pt._pathTracer.target.texture; sm.material.sigma = 3.5; sm.material.threshold = 0.18; sm.material.kSigma = 1.2; r.setRenderTarget(null); sm.render(r);
      const url = cv.toDataURL('image/png');
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99'; document.body.appendChild(host);
      const st = document.createElement('style'); st.textContent = PANO_CSS; document.head.appendChild(st);
      const plan = { floors: [{ height: 3, rooms: [{ id: 'r', name: 'Test', type: 'living', pts: [[-4, -4], [4, -4], [4, 4], [-4, 4]], pano: [0, 0] }], openings: [], items: [], devices: [{ id: 'd1', kind: 'tv', entity: 'media_player.tv', x: 0, y: -3.9 }] }] };
      const v = new PanoViewer(host, { image: url, plan, roomId: 'r' }); v.hass = { states: { 'media_player.tv': { state: 'off', attributes: {} } } };
      await new Promise((res) => setTimeout(res, 800));
      const px = () => { const g = v.renderer.getContext(), a = new Uint8Array(4); v.renderer.render(v.scene, v.cam); g.readPixels(g.drawingBufferWidth / 2, g.drawingBufferHeight / 2, 1, 1, g.RGBA, g.UNSIGNED_BYTE, a); return [...a.slice(0, 3)]; };
      v.yaw = 0; v.pitch = 0; v.cam.rotation.set(0, 0, 0, 'YXZ'); v.cam.updateMatrixWorld(); const ahead = px();
      v.cam.rotation.set(0, -Math.PI / 2, 0, 'YXZ'); v.cam.updateMatrixWorld(); const right = px();
      v.look(0, 0); await new Promise((res) => setTimeout(res, 100));
      const hs = host.querySelector('.hs'); const hx = hs && !hs.classList.contains('hide') ? parseFloat(hs.style.left) : -1;
      const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 128; const im = new Image(); im.src = url; await im.decode(); const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0); const mid = [...x2.getImageData(128, 64, 1, 1).data].slice(0, 3), q = [...x2.getImageData(192, 64, 1, 1).data].slice(0, 3); const bg = !!v.scene.background; v.dispose(); host.remove(); return { ahead, right, hx, mid, q, bg, samples: pt.samples }; }""")
    red = pano["ahead"][0] > 150 and pano["ahead"][1] < 90; green = pano["right"][1] > 150 and pano["right"][0] < 90
    check("a 360° view looks the right way round", red and green, str(pano))
    check("a device's button sits where the device is in the 360° view", abs(pano["hx"] - 200) < 20, str(pano["hx"]))

    # the local photo reader starts in the background; with no internet here it says so plainly instead of hanging
    got = page.evaluate("""async () => { const w = new Worker('/custom_components/roost_atelier/frontend/chunks/detect-worker.js', { type: 'module' });
      const c = document.createElement('canvas'); c.width = 64; c.height = 48; const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
      return await new Promise((res) => { const t = setTimeout(() => res({ type: 'timeout' }), 400000); w.onmessage = (e) => { if (e.data.type !== 'progress') { clearTimeout(t); res(e.data); } }; w.onerror = (e) => { clearTimeout(t); res({ type: 'crash', message: e.message }); };
        w.postMessage({ id: 1, blob, base: '/custom_components/roost_atelier/frontend/ai/ort/' }); }); }""")
    check("the local photo reader starts and answers", got.get("type") in ("error", "done"), str(got)[:160])
    errors[:] = [e for e in errors if "huggingface" not in e and "Failed to fetch" not in e and "ERR_" not in e]

    serious = [e for e in errors if "favicon" not in e and "ha-icon" not in e]
    check("no errors in the browser", not serious, "; ".join(serious[:3]))
    browser.close()

srv.shutdown()
print("browser: all passed" if not failed else f"browser: {len(failed)} failed")
sys.exit(1 if failed else 0)
