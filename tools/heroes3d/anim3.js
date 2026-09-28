new Promise(function(res0){var g=window.SR_PHASER_GAME;g.scene.getScenes(false).forEach(function(s){(s.children&&s.children.list||[]).forEach(function(o){try{if(o.frame){o.frame.glTexture;}}catch(e){o.setVisible(false);}});});try{g.loop.sleep();g.loop.wake();}catch(e){}
setTimeout(function(){res0({timeout:true,partial:window.__animOut});},20000);
(function(res){var L=window.SR_HERO3D._live,out={figs:L.length};window.__animOut=out;var clips=['idle','hop','attack','cast','hit','faint'];
var v=new window.THREE.Vector3();function probe(f){var p=[];f.model.traverse(function(o){if(o.isBone){o.getWorldPosition(v);p.push(v.x,v.y,v.z);}});return p;}
var i=0;function next(){if(i>=clips.length){L.forEach(function(f){f.heroRevive&&f.heroRevive();});res(out);return;}
var c=clips[i++],r={maxStep:0,frames:0,has:0,dur:0};L.forEach(function(f){f.dead=false;if(f.actions[c]){r.has++;r.dur=f.actions[c].getClip().duration;}f.playClip(c,0.12);});
var prev=L.map(probe),t0=performance.now();function fr(){var cur=L.map(probe);cur.forEach(function(p,j){for(var q=0;q<p.length;q++){var d=Math.abs(p[q]-prev[j][q]);if(d>r.maxStep)r.maxStep=d;}});prev=cur;r.frames++;
if(performance.now()-t0<Math.max(1200,r.dur*1000+300))requestAnimationFrame(fr);else{r.maxStep=+r.maxStep.toFixed(4);r.clipNow=L.map(function(f){return f.clip});out[c]=r;next();}}requestAnimationFrame(fr);}
next();})(res0);})