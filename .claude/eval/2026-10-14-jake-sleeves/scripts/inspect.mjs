// Meshes, morph counts, materials, animations and textures of a teacher GLB. node inspect.mjs <file.glb> (repo root)
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
const require = createRequire(path.join(process.cwd(), "package.json"));
const imp = (p) => import(pathToFileURL(path.join(process.cwd(), "node_modules", p, "dist", "index.js")).href);
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const draco = require("draco3dgltf");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const r = (await io.read(process.argv[2])).getRoot();
for (const m of r.listMeshes()) {
  console.log(m.getName(), m.listPrimitives().map((x) => `${x.getAttribute("POSITION").getCount()} v, ${x.listTargets().length} morphs, ${x.getMaterial()?.getName()}`).join(" | "));
}
console.log("anims", r.listAnimations().map((a) => a.getName()).join(","));
console.log("textures", r.listTextures().map((t) => `${t.getName()}:${t.getImage().byteLength}`).join(", "));
