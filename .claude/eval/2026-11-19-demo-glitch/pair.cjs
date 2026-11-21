const sharp=require('../../../node_modules/sharp');const fs=require('fs');
(async()=>{for(const dev of ['phone-portrait','phone-landscape','laptop']){
 const steps=['2-lesson','4-quiz'];const tiles=[];
 for(const lab of ['prod','rebased'])for(const s of steps){const f=`shots-${lab}/${dev}-${s}.jpg`;const m=await sharp(f).metadata();const sc=dev==='phone-portrait'?520/m.height:(dev==='phone-landscape'?400/m.height:400/m.height);tiles.push({b:await sharp(f).resize(Math.round(m.width*sc),Math.round(m.height*sc)).toBuffer(),w:Math.round(m.width*sc),h:Math.round(m.height*sc)});}
 const W=tiles.reduce((a,t)=>a+t.w+6,0),H=tiles[0].h;let x=0;const comps=tiles.map(t=>{const c={input:t.b,left:x,top:0};x+=t.w+6;return c});
 await sharp({create:{width:W,height:H,channels:3,background:'#888'}}).composite(comps).jpeg({quality:78}).toFile(`pair-${dev}.jpg`);}})()
