/* ===================================================================
   SKY SKIFF — rendering
   =================================================================== */
window.SS = window.SS || {};

SS.R = (function(){
var R = {};
var THREE = window.THREE;

var IS_TOUCH = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
R.IS_TOUCH = IS_TOUCH;

var FOGC = new THREE.Color(0x14415a);
var SUN  = new THREE.Vector3(-0.42, 0.36, 0.83).normalize();

var renderer, scene, camera, water, wMat, sMat, stormWall;
var WSZ=2600, WSEG=150, WSTEP=WSZ/WSEG;

R.init = function(canvas){
  renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:!IS_TOUCH, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, IS_TOUCH?1.5:2));
  renderer.setSize(innerWidth, innerHeight);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOGC, 300, 1500);
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.5, 5000);

  scene.add(new THREE.HemisphereLight(0xcdeeff, 0x0a2230, 0.95));
  var dl = new THREE.DirectionalLight(0xffdcae, 1.25);
  dl.position.copy(SUN).multiplyScalar(300); scene.add(dl);
  var rim = new THREE.DirectionalLight(0x5fa8ff, 0.45);
  rim.position.set(180,90,-220); scene.add(rim);

  buildSky(); buildWater(); buildStorm(); buildScenery();

  R.scene = scene; R.camera = camera; R.renderer = renderer;
  addEventListener('resize', function(){
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
};

function buildSky(){
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2600,24,16), new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ s:{value:SUN.clone()} },
    vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
    'uniform vec3 s;varying vec3 vD;',
    'void main(){float h=vD.y;',
    ' vec3 hi=vec3(.035,.153,.243), mid=vec3(.086,.290,.376), lo=vec3(.855,.549,.353);',
    ' float t=clamp(h*1.5+.18,0.,1.);',
    ' vec3 c=mix(lo,mid,smoothstep(0.,.32,t));',
    ' c=mix(c,hi,smoothstep(.3,1.,t));',
    ' float sd=max(dot(vD,normalize(s)),0.);',
    ' c+=pow(sd,900.)*vec3(1.4,1.25,.95);',
    ' c+=pow(sd,14.)*vec3(.42,.26,.10);',
    ' c+=pow(clamp(1.-abs(h)*5.5,0.,1.),2.6)*vec3(.20,.10,.04);',
    ' gl_FragColor=vec4(c,1.);}'].join('\n')
  })));
}

function buildWater(){
  wMat = new THREE.ShaderMaterial({ fog:false, uniforms:{
    uT:{value:0}, uO:{value:new THREE.Vector2()},
    uCam:{value:new THREE.Vector3()}, uSun:{value:SUN.clone()}, uFog:{value:FOGC.clone()} },
    vertexShader:[
    'uniform float uT;uniform vec2 uO;',
    'varying vec3 vN;varying vec3 vW;varying float vH;varying float vF;',
    'float wv(vec2 p){return sin(p.x*.047+uT*1.05)*.58+sin(p.y*.061-uT*1.32)*.46',
    ' +sin((p.x+p.y)*.021+uT*.63)*.82+sin((p.x-p.y)*.104-uT*1.9)*.19;}',
    'void main(){vec3 p=position;vec2 w=p.xy+uO;float e=1.2;',
    ' float h=wv(w);p.z+=h;vH=h;',
    ' float hx=wv(w+vec2(e,0.))-wv(w-vec2(e,0.));',
    ' float hy=wv(w+vec2(0.,e))-wv(w-vec2(0.,e));',
    ' vN=normalize(vec3(-hx/(2.*e),1.,hy/(2.*e)));',
    ' vec4 mv=modelViewMatrix*vec4(p,1.);vF=-mv.z;',
    ' vW=(modelMatrix*vec4(p,1.)).xyz;',
    ' gl_Position=projectionMatrix*mv;}'].join('\n'),
    fragmentShader:[
    'uniform vec3 uCam;uniform vec3 uSun;uniform vec3 uFog;',
    'varying vec3 vN;varying vec3 vW;varying float vH;varying float vF;',
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uCam-vW);vec3 L=normalize(uSun);',
    ' float t=clamp(vH*.5+.5,0.,1.);',
    ' vec3 c=mix(vec3(.008,.047,.086),vec3(.055,.286,.376),t);',
    ' c+=max(dot(N,L),0.)*vec3(.055,.105,.115);',
    ' vec3 H=normalize(L+V);',
    ' c+=pow(max(dot(N,H),0.),120.)*vec3(1.35,1.15,.85);',
    ' c+=pow(max(dot(N,H),0.),22.)*.22*vec3(.75,.58,.38);',
    ' c=mix(c,vec3(.15,.32,.42),pow(1.-max(dot(N,V),0.),4.)*.55);',
    ' c+=smoothstep(.80,1.0,t)*vec3(.22,.40,.45);',
    ' gl_FragColor=vec4(mix(c,uFog,clamp((vF-300.)/1200.,0.,1.)),1.);}'].join('\n')});
  water = new THREE.Mesh(new THREE.PlaneGeometry(WSZ,WSZ,WSEG,WSEG), wMat);
  water.rotation.x = -Math.PI/2;
  scene.add(water);
}

function buildStorm(){
  sMat = new THREE.ShaderMaterial({ transparent:true, side:THREE.DoubleSide, depthWrite:false, fog:false,
    uniforms:{ uT:{value:0} },
    vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
    'uniform float uT;varying vec2 vU;',
    'void main(){float b=sin(vU.x*200.+uT*1.7)*.5+.5;',
    ' float r=sin(vU.y*24.-uT*3.4)*.5+.5;',
    ' float r2=sin(vU.y*9.-uT*1.3)*.5+.5;',
    ' float a=(.14+b*.24+r*.16+r2*.10)*smoothstep(1.,.12,vU.y);',
    ' vec3 c=mix(vec3(.45,.30,1.),vec3(.75,.55,1.),r);',
    ' gl_FragColor=vec4(c*(.75+r*.7),a);}'].join('\n')});
  stormWall = new THREE.Mesh(new THREE.CylinderGeometry(1,1,170,72,1,true), sMat);
  stormWall.position.y = 68;
  scene.add(stormWall);
}

function buildScenery(){
  var rockMat = new THREE.MeshLambertMaterial({color:0x1d3a48, flatShading:true});
  var capMat  = new THREE.MeshLambertMaterial({color:0x2c5468, flatShading:true});
  for (var i=0;i<28;i++){
    var a=Math.random()*Math.PI*2, r=SS.rnd(SS.ARENA*1.08, SS.ARENA*2.0);
    var h=SS.rnd(26,92), w=SS.rnd(10,30);
    var g=new THREE.Group();
    var m=new THREE.Mesh(new THREE.CylinderGeometry(w*SS.rnd(.25,.5), w, h, (SS.rnd(5,7))|0), rockMat);
    m.position.y=h/2-3; g.add(m);
    var c=new THREE.Mesh(new THREE.ConeGeometry(w*SS.rnd(.3,.55), SS.rnd(8,20), 6), capMat);
    c.position.y=h-2; g.add(c);
    g.position.set(Math.sin(a)*r, 0, Math.cos(a)*r);
    g.rotation.y=Math.random()*3;
    scene.add(g);
  }
  var pylMat = new THREE.MeshLambertMaterial({color:0x0d3346, flatShading:true});
  var lampMat = new THREE.MeshBasicMaterial({color:0xffb648});
  for (var j=0;j<44;j++){
    var b=j/44*Math.PI*2;
    var p=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.5,11,6), pylMat);
    p.position.set(Math.sin(b)*SS.ARENA, 3.5, Math.cos(b)*SS.ARENA);
    var lamp=new THREE.Mesh(new THREE.SphereGeometry(.85,6,5), lampMat);
    lamp.position.y=6.4; p.add(lamp);
    scene.add(p);
  }
}

/* ---------------- boat model ---------------- */
function hullShape(len,wid){
  var s=new THREE.Shape(), L=3.6*len, W=1.15*wid;
  s.moveTo(0,L);
  s.lineTo(W*.83,L*.39); s.lineTo(W,-L*.17); s.lineTo(W*.87,-L*.67);
  s.lineTo(W*.52,-L*.79); s.lineTo(-W*.52,-L*.79);
  s.lineTo(-W*.87,-L*.67); s.lineTo(-W,-L*.17); s.lineTo(-W*.83,L*.39);
  s.closePath(); return s;
}

R.buildBoat = function(bd, loadout){
  var g = new THREE.Group();
  var hm = new THREE.MeshLambertMaterial({color:bd.hull, flatShading:true});
  var dk = new THREE.MeshLambertMaterial({color:0x0a1a24, flatShading:true});
  var tm = new THREE.MeshBasicMaterial({color:bd.trim});
  var L = bd.len, W = bd.wid;

  var hg = new THREE.ExtrudeGeometry(hullShape(L,W), {depth:1.2, bevelEnabled:false});
  hg.rotateX(Math.PI/2); hg.computeVertexNormals();
  g.add(new THREE.Mesh(hg, hm));

  var keel = new THREE.Mesh(new THREE.BoxGeometry(.5*W,.5,4.6*L), dk);
  keel.position.set(0,-1.35,-.2); g.add(keel);
  var deck = new THREE.Mesh(new THREE.BoxGeometry(1.85*W,.16,5.0*L), dk);
  deck.position.set(0,.07,.25*L); g.add(deck);

  for (var s1=-1;s1<=1;s1+=2){
    var tl = new THREE.Mesh(new THREE.BoxGeometry(.1,.1,4.3*L), tm);
    tl.position.set(s1*1.02*W,-.17,.05*L); g.add(tl);
  }
  var nose = new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.9), tm);
  nose.position.set(0,-.1,3.2*L); g.add(nose);

  if (bd.style === 'armor'){
    var ar = new THREE.Mesh(new THREE.BoxGeometry(1.5*W,.72,2.0*L), hm);
    ar.position.set(0,.48,-.5*L); g.add(ar);
    var vs = new THREE.Mesh(new THREE.BoxGeometry(.9*W,.14,.1), tm);
    vs.position.set(0,.62,.5*L); g.add(vs);
    for (var p1=-1;p1<=1;p1+=2){
      var pl = new THREE.Mesh(new THREE.BoxGeometry(.22,.55,1.5*L), hm);
      pl.position.set(p1*1.0*W,.28,-.3*L); pl.rotation.z=p1*.22; g.add(pl);
    }
  } else {
    var cab = new THREE.Mesh(new THREE.BoxGeometry(1.2*W,.5,1.7*L), hm);
    cab.position.set(0,.38,-.45*L); g.add(cab);
    var cp = new THREE.Mesh(new THREE.SphereGeometry(.62,10,7),
      new THREE.MeshLambertMaterial({color:0x9fe8ff, transparent:true, opacity:.34, flatShading:true}));
    cp.scale.set(W,.8,1.2*L); cp.position.set(0,.66,-.4*L); g.add(cp);
    var head = new THREE.Mesh(new THREE.SphereGeometry(.2,7,6),
      new THREE.MeshLambertMaterial({color:0xf0cba8, flatShading:true}));
    head.position.set(0,.66,-.45*L); g.add(head);
  }

  if (bd.style === 'wing' || bd.canFly){
    for (var w1=-1;w1<=1;w1+=2){
      var wing = new THREE.Mesh(new THREE.BoxGeometry(2.3,.13,1.25*L), hm);
      wing.position.set(w1*(1.5*W+.9),.05,-.5*L); wing.rotation.z=w1*-.13; g.add(wing);
      var wt = new THREE.Mesh(new THREE.BoxGeometry(2.1,.07,.16), tm);
      wt.position.set(w1*(1.5*W+.9),.13,.05*L); g.add(wt);
    }
  }

  for (var s2=-1;s2<=1;s2+=2){
    var pod = new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,2.5*L,8), dk);
    pod.rotation.x=Math.PI/2; pod.position.set(s2*1.28*W,-.22,-.25*L); g.add(pod);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(.12,.95,1.35*L), hm);
    fin.position.set(s2*.98*W,.32,-2.2*L); fin.rotation.z=s2*.34; g.add(fin);
  }

  var glows = [];
  var n = bd.thr, spanW = n>2 ? 1.15*W : .62*W;
  for (var k=0;k<n;k++){
    var off = (n===1)?0:(-1+2*k/(n-1))*spanW;
    var yOff = (n>=4 && (k===0||k===n-1)) ? .28 : -.22;
    var th = new THREE.Mesh(new THREE.CylinderGeometry(.44,.5,.74,8), dk);
    th.rotation.x=Math.PI/2; th.position.set(off,yOff,-3.05*L); g.add(th);
    var gl = new THREE.Mesh(new THREE.CircleGeometry(.36,10),
      new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:.55}));
    gl.rotation.y=Math.PI; gl.position.set(off,yOff,-3.44*L); g.add(gl); glows.push(gl);
    var plume = new THREE.Mesh(new THREE.ConeGeometry(.33,2.6,8,1,true),
      new THREE.MeshBasicMaterial({color:bd.trim, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide}));
    plume.rotation.x=-Math.PI/2; plume.position.set(off,yOff,-4.5*L); g.add(plume); glows.push(plume);
  }

  /* ---- one turret per hardpoint, fanned across the deck ---- */
  var turrets = [], muzzles = [];
  var slots = bd.slots;
  for (var q=0;q<slots;q++){
    var gunId = loadout && loadout[q];
    var gd = gunId ? SS.GUNS[gunId] : null;
    var t = new THREE.Group();
    var lat = (slots===1)?0:(-1+2*q/(slots-1))*1.15*W;
    var lon = (1.35 - (q%2)*0.95)*L;
    t.position.set(lat, .42 + (q%2)*.2, lon);

    var col = gd ? gd.col : 0x55707e;
    var base = new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,.3,10), dk);
    t.add(base);

    if (gd){
      var body = new THREE.Mesh(new THREE.BoxGeometry(.52,.34,.72), hm);
      body.position.y=.22; t.add(body);
      var bl = gd.barrelLen, bc = gd.barrels;
      for (var r2=0;r2<bc;r2++){
        var bx = (bc===1)?0:(-1+2*r2/(bc-1))*.19;
        var by = .22 + ((bc>=4 && (r2===1||r2===2))?.12:0);
        var br = new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,bl,7), dk);
        br.rotation.x=Math.PI/2; br.position.set(bx,by,bl/2); t.add(br);
      }
      var mz = new THREE.Mesh(new THREE.SphereGeometry(.40,8,6),
        new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, depthWrite:false}));
      mz.position.set(0,.24,bl); t.add(mz);
      var mr = new THREE.Mesh(new THREE.RingGeometry(.28,.58,12),
        new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false}));
      mr.position.set(0,.24,bl+.1); t.add(mr);
      muzzles.push({mz:mz, mr:mr, flash:0});
      var marker = new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.06),
        new THREE.MeshBasicMaterial({color:col}));
      marker.position.set(0,.41,-.1); t.add(marker);
    } else {
      var plate = new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.1,8), dk);
      plate.position.y=.17; t.add(plate);
      muzzles.push(null);
    }
    g.add(t); turrets.push(t);
  }

  var wk = new THREE.Mesh(new THREE.PlaneGeometry(2.7*W,16),
    new THREE.MeshBasicMaterial({color:0xcdf0ff, transparent:true, opacity:0, depthWrite:false}));
  wk.rotation.x=-Math.PI/2; wk.position.set(0,-1.28,-10*L); g.add(wk);

  var spray=[];
  for (var sp=0;sp<2;sp++){
    var q2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2,4.4),
      new THREE.MeshBasicMaterial({color:0xeaffff, transparent:true, opacity:0, depthWrite:false}));
    q2.rotation.x=-Math.PI/2; q2.rotation.z=(sp?1:-1)*.42;
    q2.position.set((sp?1:-1)*1.5*W,-1.2,1.4*L); g.add(q2); spray.push(q2);
  }

  g.userData = {turrets:turrets, muzzles:muzzles, wk:wk, glows:glows, spray:spray};
  return g;
};

/* ---------------- bolts ---------------- */
var boltGeo, glowGeo, boltM = {};
R.initBolts = function(){
  boltGeo = new THREE.CylinderGeometry(.15,.15,3.0,6); boltGeo.rotateX(Math.PI/2);
  glowGeo = new THREE.CylinderGeometry(.34,.06,5.0,6); glowGeo.rotateX(Math.PI/2);
};
R.syncBolts = function(projs, myId){
  var seen = {};
  for (var i=0;i<projs.length;i++){
    var p=projs[i]; seen[p.id]=1;
    if (!boltM[p.id]){
      var col = p.guide ? 0xff5f70 : p.col;
      var grp = new THREE.Group();
      grp.add(new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({color:col})));
      var tr = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.3, depthWrite:false}));
      tr.position.z=-2.6; grp.add(tr);
      boltM[p.id]=grp; scene.add(grp);
    }
    var m=boltM[p.id];
    m.position.set(p.x,p.y,p.z);
    m.lookAt(p.x+p.vx, p.y+p.vy, p.z+p.vz);
  }
  for (var id in boltM) if (!seen[id]){ scene.remove(boltM[id]); delete boltM[id]; }
};
R.dropBolt = function(id){ if (boltM[id]){ scene.remove(boltM[id]); delete boltM[id]; } };
R.clearBolts = function(){ for (var id in boltM){ scene.remove(boltM[id]); delete boltM[id]; } };

/* ---------------- effects ---------------- */
var fx = [];
R.clearFX = function(){ for (var i=0;i<fx.length;i++) scene.remove(fx[i].o); fx.length=0; };

R.boom = function(x,y,z,col){
  var g=new THREE.Group();
  var core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1), new THREE.MeshBasicMaterial({color:0xfff4d0, transparent:true})); g.add(core);
  var fire=new THREE.Mesh(new THREE.IcosahedronGeometry(2.4,0), new THREE.MeshBasicMaterial({color:0xff9a3c, transparent:true, opacity:.9})); g.add(fire);
  var shell=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6,0), new THREE.MeshBasicMaterial({color:col||0xffd08a, wireframe:true, transparent:true})); g.add(shell);
  var smoke=[], deb=[];
  for (var i=0;i<6;i++){
    var s=new THREE.Mesh(new THREE.IcosahedronGeometry(SS.rnd(1.2,2.2),0), new THREE.MeshBasicMaterial({color:0x4a5560, transparent:true, opacity:.7}));
    s.userData.v=new THREE.Vector3(SS.rnd(-6,6),SS.rnd(3,10),SS.rnd(-6,6));
    s.position.set(SS.rnd(-2,2),SS.rnd(0,2),SS.rnd(-2,2)); g.add(s); smoke.push(s);
  }
  for (var j=0;j<14;j++){
    var d=new THREE.Mesh(new THREE.BoxGeometry(SS.rnd(.3,.7),SS.rnd(.3,.6),SS.rnd(.6,1.3)),
      new THREE.MeshLambertMaterial({color:0x2a4a5c, flatShading:true}));
    d.userData.v=new THREE.Vector3(SS.rnd(-28,28),SS.rnd(6,20),SS.rnd(-28,28));
    g.add(d); deb.push(d);
  }
  g.position.set(x,y,z); scene.add(g);
  fx.push({o:g, life:1.9, max:1.9, k:'boom', core:core, fire:fire, shell:shell, smoke:smoke, deb:deb});
  R.ring(x,z,col||0xffb648);
};
R.ring = function(x,z,c){
  var m=new THREE.Mesh(new THREE.RingGeometry(1,1.6,28),
    new THREE.MeshBasicMaterial({color:c, transparent:true, side:THREE.DoubleSide, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(x,.4,z); scene.add(m);
  fx.push({o:m, life:.85, max:.85, k:'ring'});
};
R.spark = function(x,y,z,c){
  var g=new THREE.Group();
  var s=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,0), new THREE.MeshBasicMaterial({color:c||0xfff0b8, transparent:true})); g.add(s);
  var bits=[];
  for (var i=0;i<5;i++){
    var b=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,.5), new THREE.MeshBasicMaterial({color:c||0xffd98f, transparent:true}));
    b.userData.v=new THREE.Vector3(SS.rnd(-12,12),SS.rnd(2,10),SS.rnd(-12,12)); g.add(b); bits.push(b);
  }
  g.position.set(x,y,z); scene.add(g);
  fx.push({o:g, life:.34, max:.34, k:'spark', s:s, bits:bits});
};
R.splash = function(x,z){
  var m=new THREE.Mesh(new THREE.RingGeometry(.4,.9,14),
    new THREE.MeshBasicMaterial({color:0xaee4ff, transparent:true, side:THREE.DoubleSide, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.set(x,.3,z); scene.add(m);
  fx.push({o:m, life:.5, max:.5, k:'ring'});
};
R.stepFX = function(dt){
  for (var i=fx.length-1;i>=0;i--){
    var it=fx[i]; it.life-=dt; var k=Math.max(0,it.life/it.max);
    if (it.k==='boom'){
      it.core.scale.setScalar(1+(1-k)*2.6); it.core.material.opacity=k*k;
      it.fire.scale.setScalar(1+(1-k)*4.2); it.fire.material.opacity=k*.85;
      it.shell.scale.setScalar(1+(1-k)*7);  it.shell.material.opacity=k*.8;
      for (var a=0;a<it.smoke.length;a++){ var s=it.smoke[a];
        s.position.addScaledVector(s.userData.v,dt); s.userData.v.multiplyScalar(1-dt*1.2);
        s.scale.setScalar(1+(1-k)*2.4); s.material.opacity=k*.55; }
      for (var b=0;b<it.deb.length;b++){ var d=it.deb[b];
        d.position.addScaledVector(d.userData.v,dt); d.userData.v.y-=30*dt;
        d.rotation.x+=dt*6; d.rotation.z+=dt*4; }
    } else if (it.k==='spark'){
      it.s.scale.setScalar(1+(1-k)*2.4); it.s.material.opacity=k;
      for (var c=0;c<it.bits.length;c++){ var bb=it.bits[c];
        bb.position.addScaledVector(bb.userData.v,dt); bb.userData.v.y-=24*dt; bb.material.opacity=k; }
    } else if (it.k==='ring'){
      it.o.scale.setScalar(1+(1-k)*18); it.o.material.opacity=k*.7;
    }
    if (it.life<=0){ scene.remove(it.o); fx.splice(i,1); }
  }
};

R.tickShaders = function(dt){ wMat.uniforms.uT.value+=dt; sMat.uniforms.uT.value+=dt; };
R.setStorm = function(x,z,r){ stormWall.scale.set(r,1,r); stormWall.position.set(x,68,z); };
R.followWater = function(){
  var ox=Math.round(camera.position.x/WSTEP)*WSTEP, oz=Math.round(camera.position.z/WSTEP)*WSTEP;
  water.position.set(ox,0,oz);
  wMat.uniforms.uO.value.set(ox,-oz);
  wMat.uniforms.uCam.value.copy(camera.position);
};
R.render = function(){ renderer.render(scene, camera); };
R.add = function(o){ scene.add(o); };
R.remove = function(o){ scene.remove(o); };

return R;
})();
