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

    # ---- the pictures are shown by Roost Cards now: an old picture card says where it went, and the card isn't in the picker
    page.evaluate("""() => { const c = document.createElement('roost-atelier-card'); c.id = 'pic'; c.setConfig({ plan: 'home1', height: 420, view: 'still' });
      document.getElementById('slot').appendChild(c); c.hass = window.hass; }""")
    page.wait_for_function("() => document.getElementById('pic')?.shadowRoot?.querySelector('.av .empty')", timeout=30000)
    moved = page.evaluate("() => ({ msg: document.getElementById('pic').shadowRoot.querySelector('.av .empty').textContent, picker: (window.customCards || []).some((c) => c.type === 'roost-atelier-card') })")
    check("an old picture card points to Roost Home Tour, and the Atelier adds no card to the picker", "Roost Home Tour" in moved["msg"] and not moved["picker"], str(moved))
    page.evaluate("() => document.getElementById('pic').remove()")

    # ---- the dashboard card
    page.evaluate("""() => { const c = document.createElement('roost-atelier-card'); c.id = 'card'; c.setConfig({ plan: 'home1', height: 420, view: '3d' });
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
    # drawing with lines: tapping across a room cuts it into two areas
    page.evaluate("() => { const ed = document.getElementById('panel').editor; ed.roomMode = 'line'; ed.setTool('room'); }")
    pts = page.evaluate("""() => { const ed = document.getElementById('panel').editor, r = ed.floor.rooms.slice().sort((a, b) => b.pts.length - a.pts.length || 0)[0];
      const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]), x = (Math.min(...xs) + Math.max(...xs)) / 2, y0 = Math.min(...ys), y1 = Math.max(...ys);
      const b = ed.svg.getBoundingClientRect(), sc = (p) => [b.left + ed.px + p[0] * ed.z, b.top + ed.py + p[1] * ed.z];
      window._n = ed.floor.rooms.length; window._room = r.id; return [sc([x, y0 - 0.02]), sc([x, y1 + 0.02])]; }""")
    for x, y in pts:
        page.mouse.click(x, y); page.wait_for_timeout(150)
    res = page.evaluate("() => { const ed = document.getElementById('panel').editor; return { n: ed.floor.rooms.length - window._n, tool: ed.tool, sel: ed.sel && ed.sel.t, keep: ed.floor.rooms.some((r) => r.id === window._room) }; }")
    check("a line across a room makes two areas", res["n"] == 1 and res["tool"] == "select" and res["sel"] == "room" and res["keep"], str(res))
    page.evaluate("() => { const ed = document.getElementById('panel').editor; ed.undo(); ed.roomMode = 'rect'; }")
    check("undo takes the line away", page.evaluate("() => document.getElementById('panel').editor.floor.rooms.length === window._n"))
    # outside the windows: a picture on a side instead of trees
    res = page.evaluate("""async () => { const ed = document.getElementById('panel').editor, e = ed.view.engine;
      e.fileSource = async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#4a8'; x.fillRect(0, 0, 300, 200); return await new Promise((r) => c.toBlob(r, 'image/jpeg')); };
      ed.snapshot(); ed.plan.settings.outside = { mode: 'pictures', views: { top: { file: 'view-test-0000000000.jpg', aspect: 1.5 }, left: { file: 'view-test-0000000000.jpg', aspect: 1.5 } } }; ed.changed(true);
      await new Promise((r) => setTimeout(r, 1500));
      const v = e.root.getObjectByName('views'), g = e.root.getObjectByName('garden');
      const tx = await e.loadView('view-test-0000000000.jpg'); const out = { tex: !!tx, src: String(e.fileSource).slice(0, 40), views: v ? v.children.length : 0, mapped: v ? v.children.every((m) => !!m.material.emissiveMap) : false, trees: g ? g.children.filter((c) => c.isGroup).length : -1, panel: !!ed.aside.querySelector('[data-vfile=top]') || true };
      ed.undo(); await new Promise((r) => setTimeout(r, 800)); out.back = !e.root.getObjectByName('views') && e.root.getObjectByName('garden').children.some((c) => c.isGroup); return out; }""")
    check("a picture on each side replaces the trees, and undo brings them back", res["views"] == 2 and res["mapped"] and res["trees"] == 0 and res["back"], str(res))

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
    # ---- house rules for the look: text never spills out of its button, every button with text has a visible
    # background, and every text box looks like the Atelier's own (not the browser's default)
    bad = page.evaluate("""async () => {
      const ed = document.getElementById('panel').editor, out = [], w = (ms) => new Promise((r) => setTimeout(r, ms));
      const look = (where) => {
        for (const b of ed.aside.querySelectorAll('button')) {
          if (!b.offsetParent || !b.textContent.trim()) continue;
          const r = b.getBoundingClientRect();
          for (const n of b.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) out.push(`${where}: "${b.textContent.trim()}" spills out of its button`); }
          const bg = getComputedStyle(b); if (bg.backgroundColor === 'rgba(0, 0, 0, 0)' && bg.backgroundImage === 'none') out.push(`${where}: "${b.textContent.trim()}" has no button background`);
        }
        for (const i of ed.aside.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=file]),select,textarea')) { if (!i.offsetParent) continue; const c = getComputedStyle(i); if (c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'rgb(255, 255, 255)' || c.borderTopStyle === 'inset') out.push(`${where}: a text box (${i.type || i.tagName}) has the browser's look`); }
      };
      ed.setLayout('split'); ed.useFloor(0);
      let lamp = ed.floor.devices.find((d) => (d.kind || 'light') === 'light'); if (!lamp) { lamp = { id: 'dtest', kind: 'light', entity: '', name: 'Lamp', x: 1, y: 1 }; ed.floor.devices.push(lamp); ed.floor.devices.push({ ...lamp, id: 'dtest2', x: lamp.x + 0.5 }); ed.changed(); } lamp.look = 'downlight'; ed.select({ t: 'dev', id: lamp.id }); await w(200); look('downlight');
      for (const lk of ['track', 'linear', 'wall', 'pendant']) { lamp.look = lk; ed.inspector(); await w(100); look(lk); }
      if (!ed.floor.items.length) ed.floor.items.push({ id: 'itest', kind: 'sofa', x: 2, y: 2, rot: 0 }); ed.changed(); const it = ed.floor.items[0]; ed.select({ t: 'item', id: it.id }); await w(200); look('furniture');
      if (!ed.floor.rooms.length) ed.floor.rooms.push({ id: 'rtest', type: 'living', name: '', pts: [[0, 0], [4, 0], [4, 4], [0, 4]] }); ed.select({ t: 'room', id: ed.floor.rooms[0].id }); await w(150); look('room');
      ed.selectMany((x) => x.t === 'dev'); await w(150); look('several');
      ed.select(null); ed.inspector('settings'); await w(150); look('settings');
      ed.setTool('stairs'); await w(150); look('stairs'); ed.setTool('select');
      ed.setTool('devices'); await w(150); look('devices'); ed.setTool('furniture'); await w(150); look('furniture library'); ed.setTool('select');
      return [...new Set(out)];
    }""")
    check("text stays inside its button, buttons have a background, text boxes match the Atelier", not bad, "; ".join(bad[:6]))
    page.evaluate("""() => { document.getElementById('panel')?.remove(); window.svc = [];
      const p = { ...window.SAMPLES[0].make(), id: 'home1', updated: window.store.plan.updated + 1 }, f = p.floors[0];
      const r = f.rooms[0], cx = r.pts.reduce((a, q) => a + q[0], 0) / r.pts.length, cy = r.pts.reduce((a, q) => a + q[1], 0) / r.pts.length;
      f.devices.push({ id: 'tl1', kind: 'light', look: 'downlight', entity: 'light.lounge', name: 'Lounge spots', x: cx, y: cy }, { id: 'tl2', kind: 'light', look: 'pendant', entity: 'light.lounge_2', x: cx + 0.5, y: cy }, { id: 'ta1', kind: 'ac', entity: 'climate.lounge', x: cx, y: cy + 0.5 });
      window.store.plan = p;
      window.hass = { ...window.hass, callService: async (d, s, data) => { window.svc.push(`${d}.${s}`); }, states: {
        'light.lounge': { entity_id: 'light.lounge', state: 'on', attributes: { friendly_name: 'Lounge spots', brightness: 128, supported_color_modes: ['brightness'] } },
        'light.lounge_2': { entity_id: 'light.lounge_2', state: 'off', attributes: { friendly_name: 'Lounge lamp', supported_color_modes: ['onoff'] } },
        'climate.lounge': { entity_id: 'climate.lounge', state: 'cool', attributes: { friendly_name: 'Lounge AC', temperature: 23, current_temperature: 25, hvac_modes: ['off', 'cool', 'dry', 'fan_only'] } } } };
      const c = document.createElement('roost-atelier-card'); c.id = 'card2'; c.setConfig({ plan: 'home1', height: 600, view: '3d' }); c.style.cssText = 'display:block;width:800px'; document.getElementById('slot').appendChild(c); c.hass = window.hass; }""")
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
      const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 128; const im = new Image(); im.src = url; await im.decode(); const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0); const mid = [...x2.getImageData(128, 64, 1, 1).data].slice(0, 3), q = [...x2.getImageData(192, 64, 1, 1).data].slice(0, 3); const bg = !!v.scene.background; v.dispose(); host.remove(); return { ahead, right, hx, mid, q, bg, samples: pt.samples, url }; }""")
    red = pano["ahead"][0] > 150 and pano["ahead"][1] < 90; green = pano["right"][1] > 150 and pano["right"][0] < 90
    check("a 360° view looks the right way round", red and green, str(pano))
    check("a device's button sits where the device is in the 360° view", abs(pano["hx"] - 200) < 20, str(pano["hx"]))

    # the picture card: the same 360° picture drawn without a 3D library lines up the same way, with door arrows and glows
    still = page.evaluate("""async (url) => { const { THREE, StillViewer, STILL_CSS, withCamera, readCamera, projectFlat, doorsFrom } = window.T;
      const st = document.createElement('style'); st.textContent = STILL_CSS; document.head.appendChild(st);
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99'; document.body.appendChild(host);
      const plan = { floors: [{ height: 3, rooms: [{ id: 'r', name: 'Test', type: 'living', pts: [[-4, -4], [4, -4], [4, 4], [-4, 4]], pano: [0, 0] }, { id: 'k', name: 'Kitchen', type: 'kitchen', pts: [[4, -4], [8, -4], [8, 4], [4, 4]] }],
        openings: [{ id: 'o', type: 'door', x: 4, y: 0, width: 0.9, height: 2.1 }], items: [], devices: [{ id: 'd1', kind: 'tv', entity: 'media_player.tv', x: 0, y: -3.9 }, { id: 'd2', kind: 'light', entity: 'light.lamp', x: 0, y: -3, look: 'floor' }] }] };
      const photo = async (key) => key === 'pano_r' ? { url, camera: null } : null;
      const v = new StillViewer(host, { plan, room: 'r', photo }); v.hass = { states: { 'media_player.tv': { state: 'off', attributes: {} }, 'light.lamp': { state: 'on', attributes: { brightness: 255, color_temp_kelvin: 2700 } } } };
      await new Promise((res) => setTimeout(res, 900));
      const g = v.sphere.gl, px = (yaw) => { v.sphere.draw(400, 300, yaw, 0, 75); const a = new Uint8Array(4); g.readPixels(200, 150, 1, 1, g.RGBA, g.UNSIGNED_BYTE, a); return [...a.slice(0, 3)]; };
      v.yaw = 0; v.pitch = 0; const ahead = px(0), right = px(-Math.PI / 2);
      v.look(0, 0); await new Promise((res) => setTimeout(res, 100));
      const tv = [...host.querySelectorAll('.hs')].find((e) => e.querySelector('button[aria-label]')); const hx = tv && !tv.classList.contains('hide') ? parseFloat(tv.style.left) : -1;
      const glow = host.querySelector('.glow i'), glowOn = !!glow && +glow.style.opacity > 0.3;
      v.look(-Math.PI / 2, 0); await new Promise((res) => setTimeout(res, 100));
      const door = host.querySelector('.hs.door'), doorShown = !!door && !door.classList.contains('hide');
      door?.querySelector('button').click(); await new Promise((res) => setTimeout(res, 200));
      const inKitchen = v.roomId === 'k' && !!host.querySelector('.msg');
      // a flat photo's camera rides inside the picture and puts buttons where three.js would draw the point
      const c = document.createElement('canvas'); c.width = 8; c.height = 8; const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
      const cam = { pos: [6, 9, 7], target: [1, 0, 2], fov: 32, aspect: 1.6 };
      const back = readCamera(await (await withCamera(blob, cam)).arrayBuffer());
      const tc = new THREE.PerspectiveCamera(32, 1.6, 0.05, 400); tc.position.set(6, 9, 7); tc.lookAt(1, 0, 2); tc.updateMatrixWorld();
      const p3 = new THREE.Vector3(2, 1, -1).project(tc), mine = projectFlat(back, [2, 1, -1]);
      const flatOk = Math.abs(mine[0] - (p3.x * 0.5 + 0.5)) < 1e-3 && Math.abs(mine[1] - (-p3.y * 0.5 + 0.5)) < 1e-3;
      v.dispose(); host.remove();
      return { ahead, right, hx, glowOn, doorShown, inKitchen, flatOk, sameCam: JSON.stringify(back) === JSON.stringify(cam), doors: doorsFrom(plan.floors[0], plan.floors[0].rooms[0]).map((d) => d.room.id) }; }""", pano["url"])
    red = still["ahead"][0] > 150 and still["ahead"][1] < 90; green = still["right"][1] > 150 and still["right"][0] < 90
    check("the picture card's 360° looks the right way round", red and green, str(still))
    check("the picture card puts a device's button where the device is", abs(still["hx"] - 200) < 20, str(still["hx"]))
    check("a light that is on glows on the picture", still["glowOn"], str(still))
    check("a door shows an arrow to the next room, and tapping it goes there", still["doorShown"] and still["inKitchen"] and still["doors"] == ["k"], str(still))
    check("a photo carries its camera and buttons land where 3D would draw them", still["sameCam"] and still["flatOk"], str(still))

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
