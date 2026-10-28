/* Bloom's lightweight Canvas peony (the filename is retained for compatibility).
 * No rendering dependencies, textures or bitmap flower.
 * A fixed seeded set of petals is sampled as curved surfaces in 3D, projected
 * to Canvas and painted as smooth paths. Bloom changes curvature, not scale.
 * Uses the existing bloom:progress and bloom:flower events.
 */
(() => {
'use strict';
const TAU = Math.PI * 2, clamp = x => Math.max(0, Math.min(1,x));
const ease = x => { x=clamp(x); return x*x*(3-2*x); };
const mix=(a,b,t)=>a+(b-a)*t;
let seed=271026;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function path(ctx,points,close=true){
 ctx.beginPath(); const last=points[points.length-1];
 if(close)ctx.moveTo((last.x+points[0].x)/2,(last.y+points[0].y)/2);else ctx.moveTo(points[0].x,points[0].y);
 for(let i=0;i<points.length-(close?0:1);i++){
  const p=points[i],q=points[(i+1)%points.length];ctx.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);
 }
 if(close)ctx.closePath();else{const p=points[points.length-1];ctx.lineTo(p.x,p.y);}
}
const FLOWER_STYLES = {
 peony: { hue:345, saturation:52, center:'stamens', scale:1, rings:null },
 rose: { hue:351, saturation:61, center:'hidden', scale:.92, rings:[
  {n:7,len:2.48,w:.89,z:0,r:.17,start:.19,end:1,angle:1.86},
  {n:9,len:2.12,w:.76,z:.12,r:.14,start:.13,end:.93,angle:1.59},
  {n:10,len:1.78,w:.62,z:.23,r:.11,start:.09,end:.84,angle:1.31},
  {n:9,len:1.40,w:.49,z:.34,r:.09,start:.04,end:.76,angle:1.06},
  {n:8,len:1.07,w:.37,z:.43,r:.06,start:0,end:.64,angle:.83}
 ]},
 ranunculus: { hue:23, saturation:63, center:'hidden', scale:.91, rings:[
  {n:10,len:2.25,w:.70,z:0,r:.19,start:.22,end:1,angle:1.73},
  {n:12,len:2.02,w:.62,z:.10,r:.17,start:.18,end:.96,angle:1.56},
  {n:14,len:1.80,w:.54,z:.20,r:.14,start:.14,end:.89,angle:1.40},
  {n:15,len:1.57,w:.47,z:.30,r:.12,start:.10,end:.81,angle:1.23},
  {n:16,len:1.34,w:.39,z:.39,r:.09,start:.05,end:.73,angle:1.03},
  {n:12,len:1.07,w:.31,z:.47,r:.06,start:0,end:.65,angle:.84}
 ]},
 camellia: { hue:341, saturation:48, center:'stamens', scale:.96, rings:[
  {n:7,len:2.55,w:1.03,z:0,r:.19,start:.18,end:1,angle:2.01},
  {n:8,len:2.23,w:.86,z:.13,r:.16,start:.14,end:.92,angle:1.77},
  {n:9,len:1.92,w:.73,z:.25,r:.12,start:.09,end:.83,angle:1.49},
  {n:9,len:1.59,w:.60,z:.36,r:.09,start:.05,end:.74,angle:1.18},
  {n:7,len:1.23,w:.43,z:.45,r:.06,start:0,end:.63,angle:.90}
 ]}
};
class CanvasPeony {
 constructor(canvas){
  this.species='peony'; this.style=FLOWER_STYLES.peony;
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.progress=.35;this.petals=[];this.pending=0;this.visible=false;
  if(!this.ctx)throw new Error('Canvas 2D is unavailable');
  seed=271026;
  // Listed outside to inside. The inner rings lead; broad timing overlap
  // keeps the whole flower moving instead of finishing one ring at a time.
  const rings=[
   {n:8,len:2.6,w:.79,z:0,r:.20,start:0,end:1,angle:2.18},
   {n:10,len:2.35,w:.68,z:.10,r:.17,start:0,end:.96,angle:1.94},
   {n:12,len:2.05,w:.58,z:.20,r:.14,start:0,end:.92,angle:1.66},
   {n:12,len:1.73,w:.47,z:.31,r:.11,start:0,end:.88,angle:1.35},
   {n:11,len:1.43,w:.36,z:.40,r:.08,start:0,end:.82,angle:1.05},
   {n:9,len:1.12,w:.27,z:.48,r:.06,start:0,end:.70,angle:.87}
  ];
  this.buildPetals(rings);
  this.stamens=Array.from({length:38},()=>({a:rand()*TAU,r:.06+Math.sqrt(rand())*.25,h:.80+rand()*.20}));
  this.onResize=()=>this.resize();
  if('ResizeObserver' in window){this.observer=new ResizeObserver(this.onResize);this.observer.observe(canvas.parentElement);}
  window.addEventListener('resize',this.onResize);
 }
 buildPetals(rings){
  this.petals=[]; seed=271026 + this.species.length*117;
  rings.forEach((ring,layer)=>{for(let i=0;i<ring.n;i++)this.petals.push({ring,layer,id:this.petals.length,az:TAU*(i+.43*(layer%2))/ring.n+layer*.48+(rand()-.5)*.15,len:ring.len*(.94+rand()*.12),width:ring.w*(.88+rand()*.24),phase:(rand()-.5)*.04,twist:(rand()-.5)*.14,seed:rand()*TAU,tint:(rand()-.5)*8});});
  this.back=this.petals.filter(p=>Math.sin(p.az)>=0).sort((a,b)=>a.layer-b.layer);
  this.front=this.petals.filter(p=>Math.sin(p.az)<0).sort((a,b)=>b.layer-a.layer);
 }
 setSpecies(species){
  if(this.species===species)return;
  this.species=species; this.style=FLOWER_STYLES[species] || FLOWER_STYLES.peony;
  if(species==='gardenia'||species==='iris'){this.requestDraw();return;}
  if(this.style.rings)this.buildPetals(this.style.rings);
  else {this.species='peony'; this.buildPetals([
   {n:8,len:2.6,w:.79,z:0,r:.20,start:0,end:1,angle:2.18},
   {n:10,len:2.35,w:.68,z:.10,r:.17,start:0,end:.96,angle:1.94},
   {n:12,len:2.05,w:.58,z:.20,r:.14,start:0,end:.92,angle:1.66},
   {n:12,len:1.73,w:.47,z:.31,r:.11,start:0,end:.88,angle:1.35},
   {n:11,len:1.43,w:.36,z:.40,r:.08,start:0,end:.82,angle:1.05},
   {n:9,len:1.12,w:.27,z:.48,r:.06,start:0,end:.70,angle:.87}
  ]);}
  this.requestDraw();
 }
 resize(){
  if(!this.visible)return;
  const r=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
  if(!r.width||!r.height)return;
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.requestDraw();
 }
 setProgress(p){this.progress=clamp(Number(p)||0);this.requestDraw();}
 requestDraw(){if(this.visible&&!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;if(this.visible)this.draw();});}
 setVisible(visible){
  this.visible=visible;this.canvas.style.display=visible?'block':'none';
  if(visible)this.resize();else{cancelAnimationFrame(this.pending);this.pending=0;}
 }
 project(x,y,z){return {x:450+x*135,y:400+y*78-z*112,depth:y*.82+z*.57};}
 surface(p,progress){
  const r=p.ring;const q=ease((progress-Math.max(0,r.start+p.phase))/(Math.min(1,r.end+p.phase)-Math.max(0,r.start+p.phase)));
  const spine=[];let radius=r.r,z=r.z,prev=0;
  for(let i=0;i<=64;i++){
   const s=i/64;
   const closed=.99-2.40*Math.pow(s,1.28);
   const opened=.35+(r.angle-.35)*Math.pow(s,1.12);
   const local=ease(clamp(q*(1.10-.10*s)));
   const angle=mix(closed,opened,local);
   if(i){const a=(prev+angle)/2;radius+=Math.sin(a)*p.len/64;z+=Math.cos(a)*p.len/64;}
   spine.push({r:radius,z,a:angle});prev=angle;
  }
  const get=(u,t)=>{
   const profile=(.016+.984*Math.pow(Math.sin(Math.PI*.5*t),.86))*(1-.10*t);
   let s=t*(1-.23*Math.pow(Math.abs(u),2.2))+Math.pow(t,7)*(.012*Math.sin(12*u+p.seed)+.006*Math.sin(25*u-p.seed));s=clamp(s);
   const k=Math.min(63,Math.floor(s*64)),f=s*64-k,A=spine[k],B=spine[k+1];
   let rr=mix(A.r,B.r,f),zz=mix(A.z,B.z,f),angle=mix(A.a,B.a,f);
   const wrap=mix(1.13,.52,q);
   let side=p.width*profile*Math.sin(u*wrap)/Math.sin(wrap);
   const cup=-p.width*profile*(1-Math.cos(u*wrap))/Math.sin(wrap);
   const rim=Math.pow(Math.abs(u),5),tip=Math.pow(t,7);
   const ripple=(.026+.027*q)*profile*(.3*rim+tip)*(Math.sin(14*u+p.seed+3*t)+.42*Math.sin(27*u-p.seed+6*t))+.009*profile*Math.sin(7*u+5*t+p.seed);
   rr+=(cup+ripple)*Math.cos(angle);zz-=(cup+ripple)*Math.sin(angle);
   zz+=p.twist*u*profile*t;side+=.028*Math.sin(3*t+p.seed)*t*t;
   return this.project(rr*Math.cos(p.az)-side*Math.sin(p.az),rr*Math.sin(p.az)+side*Math.cos(p.az),zz);
  };
  return {p,q,get,depth:get(0,.60).depth};
 }
 paintPetal(ctx,s){
  const {p,get}=s,outline=[];
  for(let j=0;j<=18;j++)outline.push(get(-1,j/18));
  for(let j=1;j<=28;j++)outline.push(get(-1+2*j/28,1));
  for(let j=17;j>=0;j--)outline.push(get(1,j/18));
  const base=get(0,0),tip=get(0,1),left=get(-1,.75),right=get(1,.75);
  // Each surface receives its own soft tissue gradient, never triangle fills.
  const light=(Math.cos(p.az+1.0)*.5+.5)*5;
  const baseHue=this.style.hue, baseSat=this.style.saturation;
  const pink=(l,sat=baseSat,h=baseHue)=>`hsl(${h+p.tint*.25} ${sat}% ${l+light}%)`;
  path(ctx,outline);ctx.shadowColor='rgba(111,48,73,.14)';ctx.shadowBlur=12;ctx.shadowOffsetY=3;
  const grad=ctx.createLinearGradient(base.x,base.y,tip.x,tip.y);
  grad.addColorStop(0,pink(49,baseSat-14));grad.addColorStop(.28,pink(68,baseSat-5));grad.addColorStop(.66,pink(80,baseSat+4));grad.addColorStop(1,pink(89,baseSat+10));
  ctx.fillStyle=grad;ctx.fill();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.save();ctx.clip();
  // Broad transverse shading describes the petal's changing cup.
  const across=ctx.createLinearGradient(left.x,left.y,right.x,right.y);
  across.addColorStop(0,'rgba(128,55,81,.11)');across.addColorStop(.25,'rgba(255,237,233,.03)');across.addColorStop(.46,'rgba(255,247,239,.26)');across.addColorStop(.72,'rgba(255,242,237,.05)');across.addColorStop(1,'rgba(129,53,80,.12)');
  ctx.fillStyle=across;ctx.fill();
  // Veins live at fixed surface coordinates, so they follow the unfolding.
  for(let k=-9;k<=9;k++){
   const points=[],u=k/10;
   for(let j=1;j<=17;j++){const t=j/17;points.push(get(u*(.32+.68*t)+.011*Math.sin(t*6+p.seed+k),t));}
   path(ctx,points,false);ctx.lineWidth=k%3===0?.7:.45;ctx.strokeStyle=k%2===0?'rgba(255,248,240,.25)':'rgba(130,75,84,.11)';ctx.stroke();
  }
  const folds=[-.69,-.27,.21,.62];
  folds.forEach((u,i)=>{const points=[];for(let j=5;j<=20;j++){const t=j/20;points.push(get(u+.055*Math.sin(t*4+p.seed+i),t));}path(ctx,points,false);ctx.strokeStyle='rgba(255,246,240,.10)';ctx.lineWidth=3.5;ctx.stroke();});
  ctx.restore();
  const lip=[];for(let i=0;i<=36;i++)lip.push(get(-1+2*i/36,1));path(ctx,lip,false);ctx.strokeStyle='rgba(255,246,238,.58)';ctx.lineWidth=1.1;ctx.stroke();
 }
 center(ctx){
  const c=this.project(0,0,.63);ctx.save();
  const g=ctx.createRadialGradient(c.x,c.y,2,c.x,c.y,39);g.addColorStop(0,'#a77e4a');g.addColorStop(1,'#bd7790');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(c.x,c.y,30,17,0,0,TAU);ctx.fill();
  this.stamens.forEach(st=>{const a=this.project(st.r*.4*Math.cos(st.a),st.r*.4*Math.sin(st.a),.63),b=this.project(st.r*Math.cos(st.a),st.r*Math.sin(st.a),st.h);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(a.x,b.y,b.x,b.y);ctx.strokeStyle='#d7b46f';ctx.lineWidth=1.3;ctx.stroke();ctx.beginPath();ctx.ellipse(b.x,b.y,2.3,1.3,st.a,0,TAU);ctx.fillStyle='#e7c68a';ctx.fill();});ctx.restore();
 }

 // Shared surface renderer for the three companion flowers. Each point is
 // attached to one persistent petal; progress changes its bend and edge curl.
 // These are botanical illustrations, not measured growth simulations.
 botanicalPetals(species){
  this.botanicalCache ??= new Map();
  if(this.botanicalCache.has(species))return this.botanicalCache.get(species);
  let state=species==='iris'?4187:species==='rose'?6203:8819;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const petals=[];
  const ring=(count,length,width,height,angle,start,end,layer,kind='round')=>{
   for(let i=0;i<count;i++){
    const az=species==='iris'
     ? (kind==='fall'?Math.PI/2:-Math.PI/2)+i*TAU/3
     : i*TAU/count+layer*2.39996+.16;
    petals.push({
     kind,layer,az:az+(random()-.5)*.07,
     length:length*(.96+random()*.08),width:width*(.94+random()*.12),
     height,angle,start,end,phase:(random()-.5)*.022,
     seed:random()*TAU,tint:(random()-.5)*5,
     twist:(random()-.5)*.08
    });
   }
  };
  if(species==='rose'){
   // Broad guard petals release around a high, still-folded central cup.
   ring(5,2.35,.89,0,2.36,0,1,0);
   ring(6,2.02,.80,.13,2.05,.05,1,1);
   ring(7,1.67,.68,.25,1.72,.13,1,2);
   ring(6,1.30,.51,.37,1.28,.22,1,3);
   ring(5,.94,.36,.47,.84,.30,1,4);
   ring(3,.65,.25,.52,.59,.36,1,5);
  }else if(species==='gardenia'){
   // A double gardenia: broad ivory lobes surrounding folded inner whorls.
   ring(7,2.22,.85,0,2.27,0,1,0);
   ring(6,1.80,.74,.12,1.96,.07,1,1);
   ring(5,1.36,.58,.24,1.55,.16,1,2);
   ring(4,.94,.40,.35,1.12,.24,1,3);
   ring(3,.61,.27,.43,.76,.32,1,4);
  }else{
   // Three falls bend outward/down; three standards remain upright.
   ring(3,2.82,.82,0,3.02,0,1,0,'fall');
   ring(3,2.48,.73,.10,.12,0,1,1,'standard');
  }
  const back=petals.filter(p=>Math.sin(p.az)<0).sort((a,b)=>a.layer-b.layer);
  const front=petals.filter(p=>Math.sin(p.az)>=0).sort((a,b)=>b.layer-a.layer);
  const result={back,front};
  this.botanicalCache.set(species,result);
  return result;
 }
 botanicalSurface(p,species){
  const iris=species==='iris',gardenia=species==='gardenia';
  // Stagger the starts, but every petal finishes at exactly 100%.
  // Variation affects release timing only, never the completion percentage.
  const start=iris?0:Math.max(0,p.start+p.phase);
  const progress=clamp((this.progress-start)/(1-start));
  // Iris responds immediately; avoid a delay followed by two ease-in curves.
  // Keep meaningful motion in the last third for rose and gardenia.
  const q=iris?.65*progress+.35*ease(progress):progress*(.8+.2*progress);
  const spine=[];
  let radius=iris?.045:.10,z=p.height,previous=0;
  for(let i=0;i<=64;i++){
   const t=i/64;
   const closed=iris?.17-.34*t:.53-1.28*Math.pow(t,1.35);
   const opened=p.kind==='standard'
    ? .65+(p.angle-.65)*Math.pow(t,1.65)
    : .28+(p.angle-.28)*Math.pow(t,iris?.90:1.12);
   // The tip lags the base slightly, then reaches its final bend at 100%.
   // A small tip lag fades continuously; no second ease or early clamping.
   const local=iris?q+.12*q*(1-q)*(1-t):q-.14*q*(1-q)*t;
   const angle=mix(closed,opened,local);
   if(i){const a=(previous+angle)/2;radius+=Math.sin(a)*p.length/64;z+=Math.cos(a)*p.length/64;}
   spine.push({radius,z,angle});previous=angle;
  }
  const get=(u,t)=>{
   const profile=.012+.988*Math.pow(Math.sin(Math.PI*.5*t),iris?1.65:.90);
   const asymmetry=gardenia?.055:iris?.015:.025;
   const ruffle=iris?.016:gardenia?.002:.006;
   const s=clamp(t*(1-.24*u*u+asymmetry*u)+ruffle*Math.pow(t,7)*Math.sin(u*15+p.seed));
   const k=Math.min(63,Math.floor(s*64)),f=s*64-k,A=spine[k],B=spine[k+1];
   let rr=mix(A.radius,B.radius,f),zz=mix(A.z,B.z,f);
   const angle=mix(A.angle,B.angle,f);
   const wrap=mix(2.15,iris?.38:gardenia?.55:.65,q);
   // Constant arc width: the petal broadens by uncurling across its surface.
   let side=p.width*profile*Math.sin(u*wrap)/wrap;
   // Transverse cupping relaxes, while the rim gently rolls away.
   const cup=-p.width*profile*(1-Math.cos(u*wrap))/wrap;
   const edge=Math.pow(Math.abs(u),6),tip=Math.pow(t,8);
   const ripple=(iris?.045:gardenia?.009:.018)*profile*(.35*edge+tip)*Math.sin(13*u+3*t+p.seed);
   const roll=(species==='rose'?.11:gardenia?.05:.018)*q*tip*(.6+.4*u*u);
   rr+=(cup+ripple+roll)*Math.cos(angle);
   zz-=(cup+ripple+roll)*Math.sin(angle);
   zz+=p.twist*u*t*profile;
   side+=(gardenia?.15:.04)*profile*t*t;
   const twist=iris?.025*Math.sin(t*3+p.seed)
    : (gardenia?.35:.20)*t+(1-q)*.34*t*t;
   const az=p.az+twist;
   const x=rr*Math.cos(az)-side*Math.sin(az);
   const y=rr*Math.sin(az)+side*Math.cos(az);
   return {x:450+x*132,y:390+y*(gardenia?108:iris?78:94)-zz*(gardenia?92:110)};
  };
  return {p,q,get,species};
 }
 irisSilhouette(ctx,get){
  // A curled petal can overlap itself in projection. Filling only its outer
  // outline cancels opposite windings and leaves a slit across the fold.
  // Fill the union of surface patches instead, with one shared gradient.
  // Consistent winding also makes the clip continuous across the turned rim.
  const rows=28,cols=32,points=[];
  for(let j=0;j<=rows;j++){
   const row=[];
   for(let i=0;i<=cols;i++)row.push(get(-1+2*i/cols,j/rows));
   points.push(row);
  }
  ctx.beginPath();
  const triangle=(a,b,c)=>{
   const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   if(Math.abs(area)<1e-9)return;
   if(area<0)[b,c]=[c,b];
   ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();
  };
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const a=points[j][i],b=points[j][i+1],c=points[j+1][i+1],d=points[j+1][i];
   triangle(a,b,c);triangle(a,c,d);
  }
 }
 paintBotanicalPetal(ctx,s){
  const {get,p,species}=s,outline=[];
  const rose=species==='rose',iris=species==='iris';
  for(let j=0;j<=20;j++)outline.push(get(-1,j/20));
  for(let j=1;j<=32;j++)outline.push(get(-1+2*j/32,1));
  for(let j=19;j>=0;j--)outline.push(get(1,j/20));
  const base=get(0,0),tip=get(0,1),left=get(-1,.73),right=get(1,.73);
  const light=2*Math.cos(p.az+1)+p.tint*.18;
  const palette=rose
   ? [[354,65,23],[352,66,36],[350,65,49],[352,60,61]]
   : iris
    ? [[263,37,35],[264,40,56],[267,48,72],[270,54,86]]
    : [[48,24,65],[47,31,84],[48,49,94],[47,61,98]];
  const color=([h,sat,l])=>`hsl(${h+p.tint*.3} ${sat}% ${Math.min(99,l+light)}%)`;
  ctx.save();
  if(iris)this.irisSilhouette(ctx,get);else path(ctx,outline);
  const gradient=ctx.createLinearGradient(base.x,base.y,tip.x,tip.y);
  [0,.32,.72,1].forEach((at,i)=>gradient.addColorStop(at,color(palette[i])));
  ctx.fillStyle=gradient;
  ctx.shadowColor=rose?'rgba(65,13,32,.17)':iris?'rgba(66,46,98,.14)':'rgba(97,88,61,.17)';
  ctx.shadowBlur=10;ctx.shadowOffsetY=3;ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.save();ctx.clip();
  const across=ctx.createLinearGradient(left.x,left.y,right.x,right.y);
  across.addColorStop(0,rose?'rgba(55,5,25,.18)':'rgba(86,73,91,.12)');
  across.addColorStop(.3,'rgba(255,246,230,.02)');
  across.addColorStop(.47,rose?'rgba(255,192,185,.13)':'rgba(255,253,242,.32)');
  across.addColorStop(.66,'rgba(255,248,237,.04)');
  across.addColorStop(1,'rgba(77,65,81,.13)');
  ctx.fillStyle=across;ctx.fill();
  // Veins use fixed (u,t) coordinates, including on the bending iris falls.
  for(let k=-10;k<=10;k++){
   const points=[];
   for(let j=1;j<=22;j++){
    const t=j/22,u=k/11*(.30+.70*t)+.009*Math.sin(t*7+p.seed+k);
    points.push(get(u,t));
   }
   path(ctx,points,false);ctx.lineWidth=k%3===0?.85:.45;
   ctx.strokeStyle=k%2===0
    ? (rose?'rgba(255,208,198,.16)':'rgba(255,252,242,.29)')
    : (iris?'rgba(85,51,136,.20)':'rgba(100,71,72,.09)');
   ctx.stroke();
  }
  for(const u of [-.62,-.22,.28,.66]){
   const points=[];
   for(let j=5;j<=22;j++)points.push(get(u+.035*Math.sin(j/6+p.seed),j/22));
   path(ctx,points,false);ctx.strokeStyle=rose?'rgba(255,194,184,.06)':'rgba(255,254,242,.13)';
   ctx.lineWidth=species==='gardenia'?6:3;ctx.stroke();
  }
  if(p.kind==='fall'){
   // Pale throat and individual gold hairs, rather than a painted yellow bar.
   const throat=[];
   for(let j=0;j<=18;j++)throat.push(get(-.15*Math.sin(j/18*Math.PI),.13+j/18*.44));
   for(let j=18;j>=0;j--)throat.push(get(.15*Math.sin(j/18*Math.PI),.13+j/18*.44));
   path(ctx,throat);ctx.fillStyle='rgba(255,236,194,.65)';ctx.fill();
   for(let j=0;j<40;j++){
    const t=.17+j/40*.35,u=.045*Math.sin(j*2.4+p.seed);
    const a=get(u,t),b=get(u+.022*Math.cos(j*1.7),t+.013);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y-2.2);
    ctx.strokeStyle=j%3?'#e6bc62':'#fff0ba';ctx.lineWidth=1.5;ctx.stroke();
   }
  }
  ctx.restore();
  const lip=[];for(let j=0;j<=40;j++)lip.push(get(-1+j/20,1));
  path(ctx,lip,false);ctx.lineWidth=.9;
  ctx.strokeStyle=rose?'rgba(255,193,186,.35)':'rgba(255,251,239,.65)';ctx.stroke();
  ctx.restore();
 }
 drawBotanical(ctx,species){
  const {back,front}=this.botanicalPetals(species);
  // Stable painter order avoids depth-sort jumps when scrubbing backward.
  // Folded inner petals form the center themselves: no overlaid spiral graphic.
  back.forEach(p=>this.paintBotanicalPetal(ctx,this.botanicalSurface(p,species)));
  front.forEach(p=>this.paintBotanicalPetal(ctx,this.botanicalSurface(p,species)));
 }
 drawRose(ctx){this.drawBotanical(ctx,'rose');}
 drawGardenia(ctx){this.drawBotanical(ctx,'gardenia');}
 drawIris(ctx){this.drawBotanical(ctx,'iris');}

 draw(){
  const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
  ctx.clearRect(0,0,w,h);ctx.save();
  // Contain the artwork without stretching petals on wide or narrow screens.
  const scale=Math.min(w/900,h/760);
  ctx.translate((w-900*scale)/2,(h-760*scale)/2);ctx.scale(scale,scale);
  ctx.translate(450,400);ctx.scale(this.style.scale,this.style.scale);ctx.translate(-450,-400);
  if(this.species==='gardenia'){this.drawGardenia(ctx);ctx.restore();return;}
  if(this.species==='iris'){this.drawIris(ctx);ctx.restore();return;}
  if(this.species==='rose'){this.drawRose(ctx);ctx.restore();return;}
  // Fixed painter order prevents sorting pops when the gesture reverses.
  // Rear petals, center, then front petals, far surfaces first.
  this.back.forEach(p=>this.paintPetal(ctx,this.surface(p,this.progress)));
  if(this.style.center==='stamens' && this.progress>.40)this.center(ctx);
  this.front.forEach(p=>this.paintPetal(ctx,this.surface(p,this.progress)));
  ctx.restore();
 }
 destroy(){this.observer?.disconnect();window.removeEventListener('resize',this.onResize);cancelAnimationFrame(this.pending);}
}

const stage=document.getElementById('stage');
const artwork=document.querySelector('.artwork');
if(!stage||!artwork)return;
const canvas=document.createElement('canvas');
canvas.id='peonyCanvas';canvas.setAttribute('role','img');
canvas.setAttribute('aria-label','Botanical flower with petals unfolding in layers');
artwork.appendChild(canvas);
try{
 const peony=new CanvasPeony(canvas);
 const sync=()=>{
  const visible=['peony','rose','iris','gardenia'].includes(stage.dataset.flower);
  if(visible){
   peony.setSpecies(stage.dataset.flower);
   const names={peony:'Soft pink peony',iris:'Lavender bearded iris',rose:'Velvet red rose',gardenia:'Ivory double gardenia'};
   canvas.setAttribute('aria-label',names[stage.dataset.flower]+' with individually unfolding petals');
  }
  peony.setVisible(visible);
  if(visible){
   document.getElementById('flowerSvg').style.display='none';
   const atlas=document.getElementById('peonyAtlas');
   if(atlas)atlas.style.display='none';
  }
 };
 peony.setProgress(Number(document.getElementById('bloomRange').value)/100);
 window.addEventListener('bloom:progress',e=>peony.setProgress(e.detail.value/100));
 window.addEventListener('bloom:flower',sync);
 window.BLOOM_PEONY_READY=true;
 if(typeof window.render==='function')window.render();
 sync();
}catch(error){
 canvas.remove();window.BLOOM_PEONY_READY=false;
 console.warn('Canvas peony unavailable; retaining the image fallback.',error);
 if(typeof window.render==='function')window.render();
}
})();
