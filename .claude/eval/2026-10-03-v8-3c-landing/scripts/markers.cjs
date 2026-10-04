// Sheet C (V8.3c): a GLB on a turntable, 8 angles at 45 degrees, through the app's loader stack (GLTFLoader + DRACOLoader
// on /draco/, as the 09-09 eval's viewer.html). The page and the model are served by route from this folder, on the dev
// server's origin so /draco/ resolves.
// Usage: node turntable.cjs <file.glb> [base]   -> ../volcano/turntable-<name>.webp
const fs = require("fs");
const path = require("path");
const { chromium, LAUNCH } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , file, base = "http://localhost:3000"] = process.argv;
const name = path.basename(file, ".glb");
const S = 480;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#f3f4f6}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js","three/examples/jsm/":"https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/"}}</script>
</head><body><canvas id="c"></canvas><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
const c=document.getElementById("c"),r=new THREE.WebGLRenderer({canvas:c,antialias:true,preserveDrawingBuffer:true});
r.setPixelRatio(1);r.setSize(${S},${S},true);r.setClearColor(0xf3f4f6,1);r.outputColorSpace=THREE.SRGBColorSpace;
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(35,1,0.01,100);
sc.add(new THREE.AmbientLight(0xffffff,1.6));const d=new THREE.DirectionalLight(0xffffff,2.4);d.position.set(3,5,4);sc.add(d);
const d2=new THREE.DirectionalLight(0xffffff,1.0);d2.position.set(-3,1,-4);sc.add(d2);
const dl=new DRACOLoader();dl.setDecoderPath("/draco/");const gl=new GLTFLoader();gl.setDRACOLoader(dl);
gl.load("/__model.glb",(g)=>{const o=g.scene,box=new THREE.Box3().setFromObject(o),size=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3());
const pivot=new THREE.Group();o.position.sub(ctr);pivot.add(o);sc.add(pivot);const m=Math.max(size.x,size.y,size.z);
cam.position.set(0,m*0.45,m*2.3);cam.lookAt(0,0,0);let tris=0;o.traverse(x=>{if(x.isMesh)tris+=(x.geometry.index?x.geometry.index.count:x.geometry.attributes.position.count)/3});
const mk=(p,c)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(0.03),new THREE.MeshBasicMaterial({color:c,depthTest:false}));s.position.set(p[0]-ctr.x,p[1]-ctr.y,p[2]-ctr.z);s.renderOrder=9;pivot.add(s)};mk([-0.035,-0.39,-0.145],0xff0000);mk([0,-0.2,0.38],0x00ff00);mk([0,-0.2,-0.38],0x0000ff);mk([0.42,-0.2,0],0xffff00);mk([-0.42,-0.2,0],0xff00ff);window.__info={size:[size.x,size.y,size.z],tris};window.__shot=(a)=>{pivot.rotation.y=a;r.render(sc,cam);};window.__ok=true;},undefined,(e)=>{window.__err=String(e)});
</script></body></html>`;

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: S, height: S } });
  await p.route("**/__tt.html", (r) => r.fulfill({ contentType: "text/html", body: HTML }));
  await p.route("**/__model.glb", (r) => r.fulfill({ contentType: "model/gltf-binary", body: fs.readFileSync(file) }));
  await p.goto(base + "/__tt.html");
  await p.waitForFunction(() => window.__ok || window.__err, null, { timeout: 120000 });
  const err = await p.evaluate(() => window.__err);
  if (err) throw new Error(err);
  console.log(JSON.stringify(await p.evaluate(() => window.__info)), `${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
  const tiles = [];
  for (let i = 0; i < 8; i++) {
    await p.evaluate((a) => window.__shot(a), (i * Math.PI) / 4);
    tiles.push({ input: await p.locator("#c").screenshot(), left: (i % 4) * (S + 4) + 4, top: Math.floor(i / 4) * (S + 4) + 4 });
  }
  const out = path.join(__dirname, "..", "volcano", `markers-${name}.webp`);
  await sharp({ create: { width: 4 * (S + 4) + 4, height: 2 * (S + 4) + 4, channels: 3, background: "#999" } }).composite(tiles).webp({ quality: 85 }).toFile(out);
  console.log("wrote", out);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
