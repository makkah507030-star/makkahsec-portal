const { chromium } = require('playwright');
const [,, key, ...ts] = process.argv;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 960 } });
 await p.goto('file://' + __dirname + '/motion-' + key + '.html'); await p.evaluate(() => document.fonts.ready);
 await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
 for (const t of ts) { await p.evaluate(ms => document.getAnimations().forEach(a => a.currentTime = ms), t*1000); await p.screenshot({ path: `snap-${key}-${t}.png` }); }
 await b.close(); })();
