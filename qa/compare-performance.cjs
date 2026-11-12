const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const before = JSON.parse(fs.readFileSync(path.join(root,'qa/results/perf-20261112-before.json')));
  const after = JSON.parse(fs.readFileSync(path.join(root,'qa/results/perf-20261112-after.json')));
  const visual = [];
  for (const a of before.snapshots) {
    const b = after.snapshots.find(x=>x.route===a.route&&x.width===a.width);
    assert.deepEqual(b, a, `Texto e geometria: ${a.route} ${a.width}px`);
    const name=(a.route==='/'?'home':a.route.slice(1).replaceAll('/','-'))+'-'+a.width+'.png';
    const first=await sharp(path.resolve(root,'../scratch/cosmic-performance/before',name)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const second=await sharp(path.resolve(root,'../scratch/cosmic-performance/after',name)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual(first.info,second.info);
    let different=0,maximum=0;
    for(let n=0;n<first.data.length;n+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(first.data[n+c]-second.data[n+c]);maximum=Math.max(maximum,delta);if(delta)changed=true;}if(changed)different++;}
    visual.push({route:a.route,width:a.width,differentPixels:different,totalPixels:first.info.width*first.info.height,maximumChannelDelta:maximum});
    assert.equal(different,0,`Pixels: ${a.route} ${a.width}px`);
  }
  const report={visual,geometryAndTextIdentical:true,results:after.results.map((b,i)=>({width:b.width,route:b.route,before:{lcp:before.results[i].medianLCP,ttfb:before.results[i].medianTTFB,cls:before.results[i].medianCLS,htmlBytes:before.results[i].medianHtmlBytes,jsBytes:before.results[i].medianJsBytes},after:{lcp:b.medianLCP,ttfb:b.medianTTFB,cls:b.medianCLS,htmlBytes:b.medianHtmlBytes,jsBytes:b.medianJsBytes}}))};
  fs.writeFileSync(path.join(root,'qa/results/perf-20261112-comparison.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(visual));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
