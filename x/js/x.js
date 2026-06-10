// =====================================================================
//  IMAI LAB — WebGL stage (scroll-driven via window.LAB_STATE)
//  balance ring + iridescent particle streams + bloom
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }from 'three/addons/postprocessing/UnrealBloomPass.js';

// shared scroll-driven state (scroll.js tweens the *target* fields)
const S = window.LAB_STATE = window.LAB_STATE || {};
const DEF = { camZ:7, camX:0, camY:0, ringScale:1, ringTilt:-0.32, ringSpin:1,
              pSpeed:1, hue:0, core:0.85, bloom:0.62 };
for(const k in DEF) if(S[k]===undefined) S[k]=DEF[k];

const canvas   = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setClearColor(0x050507,1);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0,0,7);
const rig = new THREE.Group(); scene.add(rig);

const IRID=/* glsl */`
vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}`;

/* ---- rings ---- */
const ringGroup=new THREE.Group(); rig.add(ringGroup);
function makeRing(radius,tube,opacity,hueShift){
  const geo=new THREE.TorusGeometry(radius,tube,8,320);
  const mat=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
    uniforms:{uTime:{value:0},uOpacity:{value:opacity},uHue:{value:hueShift},uHueShift:{value:0}},
    vertexShader:/* glsl */`varying vec3 vPos;varying vec3 vN;varying vec3 vV;
      void main(){vPos=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:/* glsl */`${IRID}
      uniform float uTime,uOpacity,uHue,uHueShift;varying vec3 vPos;varying vec3 vN;varying vec3 vV;
      void main(){float fres=pow(1.-abs(dot(vN,vV)),1.6);float ang=atan(vPos.y,vPos.x);
        float hue=fract(uHue+uHueShift+ang*0.15+uTime*0.04+vPos.z*0.1);
        vec3 col=hsv2rgb(vec3(hue,0.75,1.0));gl_FragColor=vec4(col*(0.6+fres),uOpacity*(0.25+fres*0.9));}`});
  return new THREE.Mesh(geo,mat);
}
const rings=[makeRing(2.25,.012,.9,.55),makeRing(1.62,.010,.7,.62),makeRing(1.05,.008,.55,.70)];
rings.forEach(r=>ringGroup.add(r));
const arc=makeRing(2.65,.006,.5,.5); arc.geometry=new THREE.TorusGeometry(2.65,.006,8,320,Math.PI*1.35); ringGroup.add(arc);
const allRings=[...rings,arc];

const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-3.2,0),new THREE.Vector3(0,3.2,0)]),
  new THREE.LineBasicMaterial({color:0x9fc4ff,transparent:true,opacity:.25,blending:THREE.AdditiveBlending}));
ringGroup.add(axis);

function radialTexture(){const s=128,c=document.createElement('canvas');c.width=c.height=s;const g=c.getContext('2d');
  const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);grd.addColorStop(0,'rgba(255,255,255,1)');
  grd.addColorStop(.25,'rgba(220,235,255,.8)');grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd;g.fillRect(0,0,s,s);return new THREE.CanvasTexture(c);}
const glowTex=radialTexture();
const core=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xcfe4ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
core.scale.set(1.1,1.1,1); ringGroup.add(core);

/* ---- particles ---- */
const COUNT=6000;
const pos=new Float32Array(COUNT*3), seed=new Float32Array(COUNT);
for(let i=0;i<COUNT;i++){const a=Math.random()*Math.PI*2,r=1.4+Math.random()*1.6;
  pos[i*3]=Math.cos(a)*r+(Math.random()-.5)*.6;pos[i*3+1]=Math.sin(a)*r*.55+(Math.random()-.5)*.6;
  pos[i*3+2]=(Math.random()-.5)*3.2;seed[i]=Math.random();}
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
pGeo.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
const pMat=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
  uniforms:{uTime:{value:0},uSize:{value:renderer.getPixelRatio()*1.0},uFlow:{value:1},uHueShift:{value:0}},
  vertexShader:/* glsl */`uniform float uTime,uSize,uFlow;attribute float aSeed;varying float vH;varying float vA;
    void main(){vec3 p=position;float t=uTime*0.25+aSeed*6.28;float sw=t+length(p.xy)*0.6;
      p.x+=sin(sw)*0.18;p.y+=cos(sw*0.9)*0.14;
      p.z=mod(p.z+uTime*(0.4+aSeed*0.6)*uFlow+1.6,3.2)-1.6;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(uSize*(0.6+aSeed*1.4)*(42.0/-mv.z),0.5,11.0);
      vH=fract(aSeed+atan(p.y,p.x)*0.12+uTime*0.03);vA=smoothstep(1.6,0.2,abs(p.z))*0.5;}`,
  fragmentShader:/* glsl */`${IRID}
    uniform float uHueShift;varying float vH;varying float vA;
    void main(){vec2 d=gl_PointCoord-0.5;float m=smoothstep(0.5,0.0,length(d));
      vec3 col=hsv2rgb(vec3(fract(vH+uHueShift),0.7,1.0));gl_FragColor=vec4(col,m*vA);}`});
const points=new THREE.Points(pGeo,pMat); rig.add(points);

/* ---- starfield ---- */
const sCount=600,sPos=new Float32Array(sCount*3);
for(let i=0;i<sCount;i++){sPos[i*3]=(Math.random()-.5)*30;sPos[i*3+1]=(Math.random()-.5)*18;sPos[i*3+2]=-6-Math.random()*14;}
const sGeo=new THREE.BufferGeometry();sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
scene.add(new THREE.Points(sGeo,new THREE.PointsMaterial({color:0x556070,size:.02,transparent:true,opacity:.6})));

/* ---- bloom ---- */
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.62,0.5,0.28);
composer.addPass(bloom);

/* ---- interaction + resize ---- */
const mouse={x:0,y:0,tx:0,ty:0};
addEventListener('pointermove',e=>{mouse.tx=e.clientX/innerWidth-.5;mouse.ty=e.clientY/innerHeight-.5;});
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setSize(w,h);composer.setSize(w,h);pMat.uniforms.uSize.value=renderer.getPixelRatio()*1.0;}
addEventListener('resize',resize);resize();

/* ---- smoothed live values ---- */
const cur={camZ:7,camX:0,camY:0,ringScale:1,ringTilt:-.32,ringSpin:1,pSpeed:1,hue:0,core:.85,bloom:.62};
const lerp=(a,b,t)=>a+(b-a)*t;

const clock=new THREE.Clock();
function tick(){
  const t=clock.getElapsedTime();
  mouse.x+=(mouse.tx-mouse.x)*.05; mouse.y+=(mouse.ty-mouse.y)*.05;
  // ease toward scroll-driven targets
  for(const k in cur) cur[k]=lerp(cur[k], (S[k]!==undefined?S[k]:cur[k]), 0.06);

  camera.position.set(cur.camX+mouse.x*0.4, cur.camY-mouse.y*0.3, cur.camZ);
  camera.lookAt(0,0,0);

  ringGroup.scale.setScalar(cur.ringScale);
  ringGroup.rotation.z=t*0.05*cur.ringSpin;
  ringGroup.rotation.x=cur.ringTilt+mouse.y*0.4;
  ringGroup.rotation.y=mouse.x*0.5;
  allRings.forEach((r,i)=>{r.material.uniforms.uTime.value=t;r.material.uniforms.uHueShift.value=cur.hue;
    r.rotation.z=t*(0.06+i*0.04)*(i%2?-1:1)*cur.ringSpin;});
  core.material.opacity=cur.core*(0.8+Math.sin(t*3.0)*0.2);

  pMat.uniforms.uTime.value=t;
  pMat.uniforms.uFlow.value=cur.pSpeed;
  pMat.uniforms.uHueShift.value=cur.hue;
  points.rotation.x=cur.ringTilt+mouse.y*0.4; points.rotation.y=mouse.x*0.5;

  bloom.strength=cur.bloom;
  composer.render();
  requestAnimationFrame(tick);
}
tick();
window.LAB_READY=true;
