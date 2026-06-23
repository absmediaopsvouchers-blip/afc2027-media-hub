'use strict';
const path = require('path');
const fs = require('fs');
let JSZip;
try { JSZip = require(path.join(__dirname, 'node_modules', 'jszip')); }
catch (e) { JSZip = require(path.join(__dirname, 'node_modules', 'pptxgenjs', 'node_modules', 'jszip')); }

const file = path.join(__dirname, '..', 'AFC2027 Media Hub - Onboarding Guide.pptx');
const buf = fs.readFileSync(file);

JSZip.loadAsync(buf).then(async (zip) => {
  const slides = Object.keys(zip.files)
    .filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (+a.match(/slide(\d+)/)[1]) - (+b.match(/slide(\d+)/)[1]));
  console.log('TOTAL SLIDES:', slides.length);
  const charts = Object.keys(zip.files).filter((n) => /ppt\/charts\/chart\d+\.xml$/.test(n));
  console.log('CHARTS:', charts.length);

  let allText = '';
  for (const n of slides) {
    const xml = await zip.file(n).async('string');
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const joined = texts.join(' | ').replace(/\s+/g, ' ').trim();
    allText += ' ' + joined;
    console.log('\n== ' + n.replace('ppt/slides/', '') + ' (' + texts.length + ' runs) ==');
    console.log(joined.slice(0, 360));
  }

  console.log('\n----- PLACEHOLDER CHECK -----');
  const bad = allText.match(/\b(lorem|ipsum|TODO|xxx+)\b|\[insert/gi);
  console.log(bad ? 'FOUND: ' + bad.join(', ') : 'clean (no placeholder text)');
}).catch((e) => { console.error(e); process.exit(1); });
