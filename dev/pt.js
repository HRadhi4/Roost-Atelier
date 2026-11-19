import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
const q = new URLSearchParams(location.search);
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(320, 220); document.body.appendChild(r.domElement);
r.toneMapping = THREE.ACESFilmicToneMapping;
const s = new THREE.Scene(), c = new THREE.PerspectiveCamera(40, 320 / 220, 0.1, 100); c.position.set(4, 4, 6); c.lookAt(0, 0, 0);
const env = new GradientEquirectTexture(64); env.topColor.set("#cfe0ff"); env.bottomColor.set("#f2ebe0"); env.update(); s.environment = env; s.background = env;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#c8a070", roughness: 0.6 }));
s.add(floor);
const mats = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xffffff, 0x888888].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.8 }));
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), q.get("multi") ? mats : mats[4]); box.position.y = 0.5; s.add(box);
const sun = new THREE.DirectionalLight("#fff", 2); sun.position.set(3, 5, 2); s.add(sun);
if (q.get("point")) { const l = new THREE.PointLight("#ffcc88", 20, 9, 2); l.position.set(0, 2, 1); s.add(l); }
const pt = new WebGLPathTracer(r); pt.tiles.set(1, 1); pt.renderScale = 0.5; pt.setScene(s, c);
function loop() { pt.renderSample(); window.samples = pt.samples; if (pt.samples < 60) requestAnimationFrame(loop); }
loop();
