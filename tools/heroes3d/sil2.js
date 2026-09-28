new Promise(function(res){var g=window.SR_PHASER_GAME;g.scene.getScenes(false).forEach(function(s){(s.children&&s.children.list||[]).forEach(function(o){try{if(o.frame){o.frame.glTexture;}}catch(e){o.setVisible(false);}});});try{g.loop.sleep();g.loop.wake();}catch(e){}
var T=window.THREE,L=window.SR_HERO3D._live,k=new T.MeshBasicMaterial({color:0x000000});var n=0;
L.forEach(function(f){f.contactShadow.visible=false;f.model.traverse(function(o){if(o.isMesh){o.material=k;n++;}});});
setTimeout(function(){g.loop.sleep();res({figs:L.length,meshes:n});},600);})
