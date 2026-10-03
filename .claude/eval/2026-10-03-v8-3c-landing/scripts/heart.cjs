// The real heart (public/landing/heart.glb) rendered alone on a transparent ground, for the V8.3b mockups. Loads
// three from unpkg at the app's version and the model and Draco decoder from the dev server. Usage: node heart.cjs [base]
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const V = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../node_modules/three/package.json"), "utf8")).version;
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  p.on("console", (m) => console.log("console:", m.text().slice(0, 200)));
  p.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 200)));
  await p.goto(BASE + "/draco/draco_wasm_wrapper.js"); // a static file: sets the origin with no app scripts
  await p.setContent(`<style>html,body{margin:0;background:transparent}</style><canvas id="c" width="900" height="900"></canvas>
    <script type="importmap">{"imports":{"three":"https://unpkg.com/three@${V}/build/three.module.js","three/addons/":"https://unpkg.com/three@${V}/examples/jsm/"}}</script>
    <script type="module">
      import * as THREE from "three";
      import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
      import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
      const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6));
      const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(2, 3, 4); s.add(k);
      const f = new THREE.DirectionalLight(0xffe0cc, 0.8); f.position.set(-3, 1, 2); s.add(f);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      const d = new DRACOLoader(); d.setDecoderPath("${BASE}/draco/");
      const l = new GLTFLoader(); l.setDRACOLoader(d);
      l.load("${BASE}/landing/heart.glb", (g) => {
        const m = g.scene; const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3()).length();
        m.position.sub(c); m.rotation.y = -0.5; s.add(m);
        cam.position.set(0, sz * 0.08, sz * 1.9); cam.lookAt(0, 0, 0);
        r.render(s, cam); window.done = true;
      }, undefined, (e) => { window.err = String(e); });
    </script>`, { waitUntil: "load" });
  await p.waitForFunction(() => window.done || window.err, null, { timeout: 30000 });
  const err = await p.evaluate(() => window.err);
  if (err) throw new Error(err);
  await (await p.$("#c")).screenshot({ path: path.join(__dirname, "..", "mockups", "jake", "heart.png"), omitBackground: true });
  console.log("heart.png, three", V);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
