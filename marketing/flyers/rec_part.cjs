const { chromium } = require('playwright');
const { spawn } = require('child_process');
const [,, key, FF, from, to, outFile] = process.argv;
const FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/motion-' + key + '.html');
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const ff = spawn(FF, ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-',
    '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p',outFile]);
  for (let i = +from; i < +to; i++) {
    await p.evaluate(ms => document.getAnimations().forEach(a => a.currentTime = ms), i * 1000 / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log('done', from, to);
})();
