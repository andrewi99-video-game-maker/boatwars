/* ===================================================================
   SKY SKIFF — match loop
   =================================================================== */
window.SS = window.SS || {};

SS.Game = (function(){
var THREE = window.THREE;
var R = SS.R;
var G = {};

var world = { boats:[], projectiles:[], storm:null, findBoat:null };
var meshes = {};
var myId = null, bSeq = 1;
var camYaw=0, camPitch=0.14, lastLook=0, shake=0, camInit=false;
var lockSeek=false, lockCand=null;
var mtime=0, over=false, running=false;
var myDamage=0, myKills=0;
var _v = new THREE.Vector3(), camP = new THREE.Vector3(), camA = new THREE.Vector3();
var SIZE = 10;

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[<>&"]/g,function(c){
  return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; }); }

function findBoat(id){
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].id===id) return world.boats[i];
  return null;
}
world.findBoat = findBoat;

/* ---------------- boat construction ---------------- */
function makeBoat(typeId, loadout, x, z, yaw, isBot, name){
  var d = SS.BOATS[typeId] || SS.BOATS.skiff;
  var fire = []; for (var i=0;i<d.slots;i++) fire.push(false);
  return {
    id: bSeq++, name:name, isBot:isBot, def:d,
    weapons: SS.makeWeapons(loadout, d.slots),
    fire: fire, wantLock:null,
    x:x, y:SS.HOVER, z:z, yaw:yaw, vx:0, vy:0, vz:0,
    hp:d.hp, maxHp:d.hp, flight:d.flight, flying:false, boost:1,
    alive:true, prot:4, kills:0, place:0, surv:0,
    inp:{throttle:0, steer:0, boost:false, fly:false, aimYaw:yaw, aimPitch:0},
    lk:{id:null, p:0, on:false, time:0.8},
    target:null, ret:0, weave:SS.rnd(0,6.3), rest:0, skill:SS.rnd(.35,.92),
    roam:{x:SS.rnd(-200,200), z:SS.rnd(-200,200)}
  };
}

function randomLoadout(def){
  var pool = SS.GUN_IDS, out = [];
  for (var i=0;i<def.slots;i++){
    if (i>0 && Math.random()<0.28){ out.push(null); continue; }
    out.push(pool[(Math.random()*pool.length)|0]);
  }
  if (!out[0]) out[0] = 'pulse';
  return out;
}

function spawnPt(i,n){
  var a=(i/n)*Math.PI*2 + SS.rnd(-0.1,0.1);
  return { x:Math.sin(a)*SS.ARENA*0.86, z:Math.cos(a)*SS.ARENA*0.86, yaw:SS.wrap(a+Math.PI) };
}

/* ---------------- world callbacks ---------------- */
world.onShot = function(b, slot, x, y, z){
  var m = meshes[b.id];
  if (m && m.userData.muzzles[slot]) m.userData.muzzles[slot].flash = 0.075;
  if (b.id === myId) shake = Math.max(shake, 0.09);
};
world.onImpact = function(x,y,z,col){ R.spark(x,y,z,col); };
world.onShield = function(x,y,z){ R.spark(x,y,z,0x9fe8ff); };
world.onSplash = function(x,z){ R.splash(x,z); };
world.onBoltGone = function(id){ R.dropBolt(id); };
world.damage = function(t, dmg, byWho){
  if (!t.alive || t.prot > 0) return;
  t.hp -= dmg;
  if (byWho === myId && t.id !== myId){ myDamage += dmg; hitMark(); }
  if (t.id === myId){ shake = Math.max(shake, 0.42); flashDmg(); }
  if (t.hp <= 0){ t.hp = 0; killBoat(t, byWho); }
};

function killBoat(b, byWho){
  b.alive = false; b.surv = mtime;
  var alive = 0;
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive) alive++;
  b.place = alive + 1;
  var k = byWho != null ? findBoat(byWho) : null;
  if (k && k.alive){ k.kills++; if (k.id === myId){ myKills++; $('kN').textContent = myKills; } }
  feed(b, k);
  R.boom(b.x, b.y, b.z, b.def.trim);
  if (meshes[b.id]){ R.remove(meshes[b.id]); delete meshes[b.id]; }

  if (b.id === myId){ setTimeout(function(){ finish(b); }, 1300); return; }

  var rest = [];
  for (var j=0;j<world.boats.length;j++) if (world.boats[j].alive) rest.push(world.boats[j]);
  if (rest.length <= 1){
    var w = rest[0];
    if (w){ w.place = 1; w.surv = mtime; }
    var me = findBoat(myId);
    setTimeout(function(){ if (me) finish(me); }, 900);
  }
}

function finish(me){
  if (over) return;
  over = true; running = false;
  var r = SS.payout(me.place, myKills, myDamage, me.surv || mtime);
  SS.Save.award(r);
  SS.UI.showResults(r, me);
}

/* ---------------- start ---------------- */
G.start = function(){
  var save = SS.Save.data;
  var mine = SS.Save.activeBoat();

  world.boats.length = 0;
  world.projectiles.length = 0;
  for (var k in meshes){ R.remove(meshes[k]); delete meshes[k]; }
  R.clearBolts(); R.clearFX();

  mtime = 0; over = false; running = true;
  myDamage = 0; myKills = 0;
  lockSeek = false; lockCand = null; camInit = false; shake = 0;
  world.storm = { x:0, z:0, r:SS.ARENA, target:SS.ARENA, nextAt:20, phase:0, dps:3 };

  var sp = spawnPt(0, SIZE);
  var me = makeBoat(mine.type, mine.loadout, sp.x, sp.z, sp.yaw, false, 'You');
  myId = me.id; camYaw = me.yaw;
  world.boats.push(me);

  var names = SS.BOT_NAMES.slice().sort(function(){ return Math.random()-0.5; });
  var tier = SS.BOAT_IDS;
  for (var i=1;i<SIZE;i++){
    var s = spawnPt(i, SIZE);
    var bt = Math.random()<0.3 ? 'skiff' : tier[(Math.random()*tier.length)|0];
    var bd = SS.BOATS[bt];
    world.boats.push(makeBoat(bt, randomLoadout(bd), s.x, s.z, s.yaw, true, names[i-1]||('Bot'+i)));
  }

  SS.UI.buildSlotBars(me);
  $('hullName').textContent = me.def.name;
  $('kN').textContent = '0';
  $('feed').innerHTML = '';
  SS.UI.show('match');
};

G.isRunning = function(){ return running; };
G.me = function(){ return findBoat(myId); };

/* ---------------- per-frame ---------------- */
G.update = function(dt, input){
  if (!running || over) return;
  mtime += dt;

  var st = world.storm;
  if (mtime >= st.nextAt && st.r > 60){
    st.phase++; st.target = Math.max(55, st.r*0.62); st.nextAt = mtime + 30; st.dps += 2;
  }
  st.r = SS.appr(st.r, st.target, (5 + st.phase*1.7)*dt);

  var me = findBoat(myId);
  if (me && me.alive){
    lockCand = pickCandidate(me);
    me.inp.throttle = input.throttle;
    me.inp.steer    = input.steer;
    me.inp.boost    = input.boost;
    me.inp.fly      = input.fly;
    me.inp.aimYaw   = camYaw;
    me.inp.aimPitch = camPitch;
    for (var f=0; f<me.fire.length; f++) me.fire[f] = !!input.fire[f];
    me.wantLock = lockSeek ? lockCand : null;
  }

  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive) continue;
    if (b.prot > 0) b.prot -= dt;
    if (b.isBot) SS.botThink(b, world, dt);
    SS.updateLock(b, findBoat, b.wantLock, dt);
    SS.tickWeapons(b, dt);
    for (var s=0;s<b.weapons.length;s++){
      if (b.fire[s] && b.weapons[s]) SS.fireSlot(b, s, world);
    }
    SS.stepBoat(b, dt);
    var dd = Math.sqrt((b.x-st.x)*(b.x-st.x) + (b.z-st.z)*(b.z-st.z));
    if (dd > st.r) world.damage(b, st.dps*dt, null);
  }

  SS.separate(world.boats);
  SS.stepProjectiles(world, dt);
};

/* ---------------- presentation ---------------- */
G.draw = function(dt, now){
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive) continue;
    var mesh = meshes[b.id];
    if (!mesh){
      var load = [];
      for (var q=0;q<b.weapons.length;q++) load.push(b.weapons[q] ? b.weapons[q].gun.id : null);
      mesh = R.buildBoat(b.def, load);
      meshes[b.id] = mesh; R.add(mesh);
    }
    var ud = mesh.userData;
    var bob = Math.sin(now/620 + b.id*1.7)*0.2 * (b.flying?0.25:1);
    mesh.position.set(b.x, b.y+bob, b.z);
    mesh.rotation.y = b.yaw;

    var spd = Math.sqrt(b.vx*b.vx + b.vz*b.vz);
    var slip = (-b.vx*Math.cos(b.yaw) + b.vz*Math.sin(b.yaw));
    mesh.rotation.z = SS.lerp(mesh.rotation.z, SS.clamp(slip*0.024,-0.5,0.5), SS.clamp(dt*6,0,1));
    mesh.rotation.x = SS.lerp(mesh.rotation.x, SS.clamp(-spd*0.0038,-0.17,0), SS.clamp(dt*4,0,1));

    var sf = SS.clamp(spd/b.def.speed, 0, 1.2);
    ud.wk.material.opacity = SS.clamp(sf*0.4,0,0.4) * (b.flying?0.1:1);
    ud.wk.scale.set(SS.clamp(sf,0.4,1.3), 1, 1);
    for (var sp2=0; sp2<ud.spray.length; sp2++)
      ud.spray[sp2].material.opacity = (b.flying?0:1) * SS.clamp((sf-0.45)*0.7, 0, 0.45);

    var th = SS.clamp(b.inp.throttle, 0, 1);
    for (var gi=0; gi<ud.glows.length; gi++){
      var gl = ud.glows[gi];
      if (gl.geometry.type === 'ConeGeometry'){
        gl.material.opacity = th*(b.inp.boost?0.55:0.3)*(0.75+Math.random()*0.25);
        gl.scale.set(1, th*(b.inp.boost?1.5:1)+0.2, 1);
      } else gl.material.opacity = 0.35 + th*0.55;
    }

    var aimY = (b.id===myId) ? camYaw : b.inp.aimYaw;
    var tRot = SS.clamp(SS.wrap(aimY - b.yaw), -1.75, 1.75);
    for (var ti=0; ti<ud.turrets.length; ti++){
      ud.turrets[ti].rotation.y = tRot;
      var mu = ud.muzzles[ti];
      if (!mu) continue;
      if (mu.flash > 0){
        mu.flash -= dt;
        var o = SS.clamp(mu.flash*13, 0, 1);
        mu.mz.material.opacity = o; mu.mz.scale.setScalar(0.6 + o*0.9);
        mu.mr.material.opacity = o*0.8; mu.mr.scale.setScalar(0.5 + (1-o)*2.2);
      } else { mu.mz.material.opacity = 0; mu.mr.material.opacity = 0; }
    }
  }

  for (var mk in meshes){
    var still = false;
    for (var fi=0; fi<world.boats.length; fi++)
      if (String(world.boats[fi].id) === mk && world.boats[fi].alive){ still = true; break; }
    if (!still){ R.remove(meshes[mk]); delete meshes[mk]; }
  }

  R.syncBolts(world.projectiles, myId);
  R.setStorm(world.storm.x, world.storm.z, world.storm.r);
  drawReticle();
  updateHUD();
  updateCamera(dt);
};

/* ---------------- camera ---------------- */
G.look = function(dx, dy){
  camYaw = SS.wrap(camYaw - dx);
  camPitch = SS.clamp(camPitch + dy, -0.42, 0.55);
  lastLook = performance.now()/1000;
};
G.toggleLock = function(){
  lockSeek = !lockSeek;
  var el = document.getElementById('bL');
  if (el) el.classList.toggle('dn', lockSeek);
  if (!lockSeek) lockCand = null;
};

function pickCandidate(me){
  if (!lockSeek || !me || !me.alive) return null;
  var best=null, bs=1e9;
  for (var i=0;i<world.boats.length;i++){
    var b = world.boats[i];
    if (!b.alive || b.id===myId) continue;
    _v.set(b.x, b.y+0.8, b.z).project(R.camera);
    if (_v.z > 1 || _v.z < -1) continue;
    var d = Math.sqrt(_v.x*_v.x + _v.y*_v.y);
    if (d > 0.62) continue;
    var dist = Math.sqrt((b.x-me.x)*(b.x-me.x) + (b.z-me.z)*(b.z-me.z));
    var sc = d*1.6 + dist/900;
    if (sc < bs){ bs = sc; best = b; }
  }
  return best ? best.id : null;
}

function updateCamera(dt){
  var me = findBoat(myId);
  var f = (me && me.alive) ? me : null;
  if (!f) for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive){ f = world.boats[i]; break; }
  if (!f) return;

  var idle = performance.now()/1000 - lastLook;
  if (idle > 1.1){
    var pull = SS.clamp(dt*1.6, 0, 1);
    camYaw = SS.wrap(camYaw + SS.wrap(f.yaw - camYaw)*pull);
  }
  if (f.lk.on){
    var t = findBoat(f.lk.id);
    if (t){
      var want = Math.atan2(t.x-f.x, t.z-f.z);
      camYaw = SS.wrap(camYaw + SS.wrap(want-camYaw)*SS.clamp(dt*2.2,0,1));
    }
  }
  var spd = Math.sqrt(f.vx*f.vx + f.vz*f.vz);
  var back = 13.5 + spd*0.11;
  var up = 4.6 + camPitch*7.5 + (f.y - SS.HOVER)*0.36;
  var cy = Math.sin(camYaw), cz = Math.cos(camYaw);
  camP.set(f.x - cy*back, f.y + up, f.z - cz*back);
  if (camP.y < 1.8) camP.y = 1.8;
  camA.set(f.x + cy*17, f.y + 1.9 - camPitch*13, f.z + cz*17);

  if (!camInit){ R.camera.position.copy(camP); camInit = true; }
  else R.camera.position.lerp(camP, SS.clamp(dt*9, 0, 1));

  if (shake > 0){
    shake = Math.max(0, shake - dt*2.2);
    var s = shake*shake*1.5;
    R.camera.position.x += SS.rnd(-s,s);
    R.camera.position.y += SS.rnd(-s,s);
    R.camera.position.z += SS.rnd(-s,s);
  }
  R.camera.lookAt(camA);
  R.camera.updateMatrixWorld();
}

G.menuCamera = function(now){
  var t = now/1000;
  R.camera.position.set(Math.sin(t*0.07)*80, 18, Math.cos(t*0.07)*80);
  R.camera.lookAt(Math.sin(t*0.07+1.4)*180, 4, Math.cos(t*0.07+1.4)*180);
  R.setStorm(0, 0, SS.ARENA);
};

/* ---------------- HUD ---------------- */
var hitT = null;
function hitMark(){
  var x = $('xh'); if (!x) return;
  x.classList.add('hit'); clearTimeout(hitT);
  hitT = setTimeout(function(){ x.classList.remove('hit'); }, 110);
}
function flashDmg(){
  var d = $('dmg'); if (!d) return;
  d.style.opacity = '.9';
  setTimeout(function(){ d.style.opacity = '0'; }, 90);
}
function feed(dead, k){
  var d = document.createElement('div'); d.className = 'kl';
  d.innerHTML = k ? '<b>'+esc(k.name)+'</b> <span>sank</span> <b>'+esc(dead.name)+'</b>'
                  : '<b>'+esc(dead.name)+'</b> <span>went down</span>';
  var f = $('feed'); f.insertBefore(d, f.firstChild);
  while (f.children.length > 5) f.removeChild(f.lastChild);
  setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 5500);
}

function drawReticle(){
  var me = findBoat(myId), r = $('ret');
  if (!me || !me.alive){ r.classList.remove('on'); return; }
  var id = me.lk.id != null ? me.lk.id : lockCand;
  var b = id != null ? findBoat(id) : null;
  if (!b || !b.alive){ r.classList.remove('on'); return; }
  _v.set(b.x, b.y+0.9, b.z).project(R.camera);
  if (_v.z > 1){ r.classList.remove('on'); return; }
  var sx = (_v.x*0.5+0.5)*innerWidth, sy = (-_v.y*0.5+0.5)*innerHeight;
  var dist = Math.sqrt((b.x-me.x)*(b.x-me.x)+(b.y-me.y)*(b.y-me.y)+(b.z-me.z)*(b.z-me.z));
  var sc = SS.clamp(42/Math.max(20,dist) + 0.32, 0.32, 1.2);
  r.classList.add('on');
  r.style.left = sx+'px'; r.style.top = sy+'px';
  r.style.transform = 'translate(-50%,-50%) scale('+sc+')';
  $('ring').style.strokeDashoffset = String(276.5*(1-me.lk.p));
  r.classList.toggle('lk', me.lk.on);
  $('htag').textContent = b.name + '  ' + Math.max(0, Math.round(b.hp)) + '  ' + b.def.name;
}

function updateHUD(){
  var me = findBoat(myId); if (!me) return;
  $('hpT').textContent = Math.max(0, Math.round(me.hp));
  $('hpF').style.transform = 'scaleX(' + SS.clamp(me.hp/me.maxHp,0,1) + ')';
  $('boF').style.transform = 'scaleX(' + me.boost + ')';
  if (me.def.canFly){
    $('flyT').textContent = me.flight.toFixed(1)+'s';
    $('flyF').style.transform = 'scaleX(' + SS.clamp(me.flight/me.def.flight,0,1) + ')';
  } else {
    $('flyT').textContent = 'no core';
    $('flyF').style.transform = 'scaleX(0)';
  }
  var al = 0;
  for (var i=0;i<world.boats.length;i++) if (world.boats[i].alive) al++;
  $('aN').textContent = al;
  $('sN').textContent = world.storm.phase === 0 ? 'holding' : Math.round(world.storm.r)+'m';
  $('sV').textContent = Math.round(Math.sqrt(me.vx*me.vx + me.vz*me.vz)*1.94);
  SS.UI.updateSlotBars(me);
}

return G;
})();
