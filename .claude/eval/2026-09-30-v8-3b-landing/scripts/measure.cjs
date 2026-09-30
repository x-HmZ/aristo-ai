// Width of each hero line in Archivo wide caps at 100px (wdth 125 and 112), to size the H1 against its column.
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(`<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
    <style>span{font-family:Archivo;font-weight:800;text-transform:uppercase;letter-spacing:-0.02em;font-size:100px;white-space:nowrap}</style>
    ${["One teacher.", "One student.", "Every kid.", "Your teacher is ready"].map((t) => `<div><span data-w="125" style="font-variation-settings:'wdth' 125">${t}</span></div><div><span data-w="112" style="font-variation-settings:'wdth' 112">${t}</span></div>`).join("")}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  console.log(await p.evaluate(() => [...document.querySelectorAll("span")].map((s) => `${s.textContent} wdth${s.dataset.w}: ${Math.round(s.getBoundingClientRect().width)}px per 100px`)));
  await b.close();
})();
