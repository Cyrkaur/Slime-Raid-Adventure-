// Electron: E=... Electron shot_main.js -- url out.png glb(0|1) w h waitMs [evalFile]
const {app,BrowserWindow}=require('electron');const fs=require('fs');
const a=process.argv.slice(process.argv.indexOf('--')+1);
const MODE=a[2];const [URL,OUT,GLB,W,H,WAIT,EXTRA]=[a[0],a[1],a[2]==='1',+(a[3]||1920),+(a[4]||1080),+(a[5]||8000),a[6]];
app.commandLine.appendSwitch('force-device-scale-factor','1');
if(process.env.UNCAP==='1'){app.commandLine.appendSwitch('disable-gpu-vsync');app.commandLine.appendSwitch('disable-frame-rate-limit');}
app.whenReady().then(async()=>{
 const w=new BrowserWindow({width:W,height:H,useContentSize:true,show:true,x:0,y:0,webPreferences:{backgroundThrottling:false}});
 const logs=[];w.webContents.on('dom-ready',()=>{w.webContents.executeJavaScript(`window.addEventListener('error',e=>console.log('STACK '+(e.error&&e.error.stack)));1`).catch(()=>{});});w.webContents.on('console-message',(e,l,m)=>logs.push(l+': '+m));
 await w.loadURL(URL);
 await w.webContents.executeJavaScript(`localStorage.setItem('sr_use_gel_glb','${GLB?1:0}');localStorage.setItem('sr_battle_quality','${process.env.Q||'high'}');localStorage.setItem('sr_hero3d','${MODE==='h'?'1':'0'}');1`);
 await w.loadURL(URL);
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 for(let i=0;i<120;i++){const ok=await w.webContents.executeJavaScript(`!!(window.SR_PHASER_GAME&&window.SR_STATE&&SR_PHASER_GAME.scene.getScene('HubScene'))`);if(ok)break;await sleep(500);}
 await sleep(2500);
 const extra=EXTRA?fs.readFileSync(EXTRA,'utf8'):'';
 await w.webContents.executeJavaScript(`(function(){const S=window.SR_STATE;const mk=(e,n)=>{const c=S.createChampion({element:e,rarity:'${process.env.RAR||'Epic'}',level:20,name:n});if(S.refreshChampionDerived)S.refreshChampionDerived(c);return c;};
  const party=[mk('Water','Aqua'),mk('Fire','Blaze'),mk('Plant','Bloom')];const foes=[0,2,3].map(i=>S.buildTutorialFoe(i));
  const g=window.SR_PHASER_GAME;g.scene.getScenes(true).forEach(s=>{if(s.scene.key!=='BattleScene')g.scene.stop(s.scene.key);});
  g.scene.start('BattleScene',{party,foes,region:'greenwild',zone:'greenwild',arena:'greenwild'});['IntroScene','HubScene','BootScene'].forEach(k=>{try{if(k!=='BattleScene')g.scene.stop(k);}catch(e){}});return 1;})()`);
 await sleep(WAIT);
 if(extra){try{const r=await w.webContents.executeJavaScript(extra);logs.push('EXTRA '+JSON.stringify(r));}catch(e){logs.push('EXTRAERR '+e);}await sleep(1500);}
 const fps=await w.webContents.executeJavaScript(`new Promise(res=>{let n=0;const t0=performance.now();function f(){n++;if(performance.now()-t0<4000)requestAnimationFrame(f);else res(n/((performance.now()-t0)/1000));}requestAnimationFrame(f);})`);
 const img=await w.webContents.capturePage();fs.writeFileSync(OUT,img.toPNG());
 fs.writeFileSync(OUT+'.log',logs.join('\n')+'\nFPS '+fps.toFixed(1)+'\n');console.log('OK',OUT,'fps',fps.toFixed(1));app.quit();});
