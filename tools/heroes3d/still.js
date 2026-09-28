new Promise(function(res){var g=window.SR_PHASER_GAME;g.scene.getScenes(false).forEach(function(s){(s.children&&s.children.list||[]).forEach(function(o){try{if(o.frame){o.frame.glTexture;}}catch(e){o.setVisible(false);}});});try{g.loop.sleep();g.loop.wake();}catch(e){}
setTimeout(function(){g.loop.sleep();res('live');},600);})
