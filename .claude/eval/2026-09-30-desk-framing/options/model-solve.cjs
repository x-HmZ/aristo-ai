const e=require("./explore.cjs");
const {K,A}=e;
const off=e.sub(e.POS0,e.TGT0), r=Math.hypot(...off), P=Math.PI/6, EO=[0,r*Math.cos(P),r*Math.sin(P)];
const POSE=e.add(e.TGT0,EO);
const at=(f)=>{ const pos=e.add(e.A,e.mul(e.sub(POSE,e.A),f)); return {pos, tgt:e.add(e.TGT0,e.sub(pos,POSE))}; };
const FMIN=+process.env.FMIN||0.5, M=16, TOP=76, BOT=88, CTRL=52, DESIGN_H=+process.env.DH||450, CTRL_TOP=+process.env.CT||100;
function ctrl(pos,tgt,W,H){ const Pj=e.cam(pos,tgt,W,H); const z0=A[2]+(CTRL_TOP-DESIGN_H/2)*K, z1=z0+CTRL*K; return Math.abs(Pj([0,A[1],z1])[1]-Pj([0,A[1],z0])[1]); }
function fitF(W,H,cw){ let lo=0.3,hi=8; for(let i=0;i<60;i++){const m=(lo+hi)/2; const p=at(m); const b=e.box(p.pos,p.tgt,W,H,cw,DESIGN_H); if(b.right-b.left>W-2*M) lo=m; else hi=m;} return hi; }
function ev(W,H,cw,f){const p=at(f); return {p,c:ctrl(p.pos,p.tgt,W,H),b:e.box(p.pos,p.tgt,W,H,cw,DESIGN_H)};}
function solve(W,H,minCtrl=44){
  const id=ev(W,H,520,1); if(id.b.left>=M && id.b.right<=W-M && id.c>=minCtrl && id.b.top>=TOP && id.b.bottom<=H-BOT) return {id:true,cw:520,f:1,...id};
  const g=(cw)=>ev(W,H,cw,Math.max(FMIN,fitF(W,H,cw)));
  if (g(520).c>=minCtrl) return {cw:520,f:Math.max(FMIN,fitF(W,H,520)),...g(520)};
  let lo=150,hi=520; for(let i=0;i<40;i++){const m=(lo+hi)/2; if(g(m).c>=minCtrl) lo=m; else hi=m;} const cw=Math.floor(lo); return {cw,f:Math.max(FMIN,fitF(W,H,cw)),...g(cw)};
}
module.exports={solve,at,ev,ctrl,POSE};
if(require.main===module){
 console.log("DESIGN_H",DESIGN_H,"CTRL_TOP",CTRL_TOP);
 for (const [W,H,m] of [[1024,768,53],[1280,720,49],[1920,1080,74],[1440,900,0]]) { const x=ev(W,H,520,1); console.log("today",W+"x"+H,"model ctrl",x.c.toFixed(1),"measured min",m); }
 for (const [W,H] of [[360,640],[360,780],[390,844],[430,932],[768,1024],[834,1194],[1024,768],[1280,720],[1920,1080]]) {
   const s=solve(W,H); console.log(W+"x"+H, s.id?"IDENTITY":"", "cw",s.cw,"f",s.f.toFixed(3),"ctrl",s.c.toFixed(1),"x",s.b.left.toFixed(0),s.b.right.toFixed(0),"y",s.b.top.toFixed(0),s.b.bottom.toFixed(0),"camY",s.p.pos[1].toFixed(2));
 }
}
