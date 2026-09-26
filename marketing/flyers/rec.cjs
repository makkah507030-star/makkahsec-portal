const { chromium } = require('playwright');
const { spawn } = require('child_process');
const key = process.argv[2], FFMPEG = process.argv[3];
const FPS = 30, DUR = 30, N = FPS * DUR;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/motion-' + key + '.html');
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const ff = spawn(FFMPEG, ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-',
    '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart',
    `out/makkahsec-motion-${key}.mp4`]);
  ff.stderr.pipe(process.stderr);
  for (let i = 0; i < N; i++) {
    await p.evaluate(ms => document.getAnimations().forEach(a => a.currentTime = ms), i * 1000 / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(key, i);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log(key, 'done');
})();
