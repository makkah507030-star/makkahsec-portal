const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
  for (const k of ['teacher','admin','guardian','student']) {
    await p.goto('file://' + __dirname + '/' + k + '.html');
    await p.evaluate(() => document.fonts.ready);
    const m = await p.evaluate(() => {
      const s = document.querySelector('.sheet').getBoundingClientRect();
      const f = document.querySelector('footer').getBoundingClientRect();
      const body = document.querySelector('.body');
      return { sheetH: s.height, footerBottom: f.bottom, bodyOverflow: body.scrollHeight - body.clientHeight,
               fonts: [...document.fonts].filter(x => x.status === 'loaded').length };
    });
    console.log(k, JSON.stringify(m));
    await p.screenshot({ path: k + '.png', fullPage: false });
    await p.pdf({ path: 'out/makkahsec-flyer-' + k + '.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  }
  await b.close();
})();
