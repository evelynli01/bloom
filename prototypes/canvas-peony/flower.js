/* Original Canvas 2D botanical study. No textures, libraries or bitmap flower.
 * A fixed seeded set of petals is sampled as curved surfaces in 3D, projected
 * to Canvas and painted as smooth paths. Bloom changes curvature, not scale.
 * Public adapter: new CanvasPeony(canvas).setProgress(0..1).
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
class CanvasPeony {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.progress=.35;this.petals=[];this.pending=0;
  seed=271026;
  const rings=[
   {n:8,len:2.6,w:.79,z:0,r:.20,start:0,end:.52,angle:2.18},
   {n:10,len:2.35,w:.68,z:.10,r:.17,start:.10,end:.67,angle:1.94},
   {n:12,len:2.05,w:.58,z:.20,r:.14,start:.23,end:.80,angle:1.66},
   {n:12,len:1.73,w:.47,z:.31,r:.11,start:.38,end:.92,angle:1.35},
   {n:11,len:1.43,w:.36,z:.40,r:.08,start:.50,end:1,angle:1.05},
   {n:9,len:1.12,w:.27,z:.48,r:.06,start:.61,end:1,angle:.87}
  ];
  rings.forEach((ring,layer)=>{for(let i=0;i<ring.n;i++)this.petals.push({ring,layer,id:this.petals.length,az:TAU*(i+.43*(layer%2))/ring.n+layer*.48+(rand()-.5)*.15,len:ring.len*(.94+rand()*.12),width:ring.w*(.88+rand()*.24),phase:(rand()-.5)*.04,twist:(rand()-.5)*.14,seed:rand()*TAU,tint:(rand()-.5)*8});});
  this.stamens=Array.from({length:38},()=>({a:rand()*TAU,r:.06+Math.sqrt(rand())*.25,h:.80+rand()*.20}));
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
 }
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);this.canvas.width=Math.max(1,Math.round(r.width*dpr));this.canvas.height=Math.max(1,Math.round(r.height*dpr));this.requestDraw();}
 setProgress(p){this.progress=clamp(Number(p)||0);this.requestDraw();}
 requestDraw(){if(!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;this.draw();});}
 project(x,y,z){return {x:450+x*135,y:400+y*78-z*112,depth:y*.82+z*.57};}
 surface(p,progress){
  const r=p.ring;const q=ease((progress-Math.max(0,r.start+p.phase))/(Math.min(1,r.end+p.phase)-Math.max(0,r.start+p.phase)));
  const spine=[];let radius=r.r,z=r.z,prev=0;
  for(let i=0;i<=64;i++){
   const s=i/64;
   const closed=.99-2.40*Math.pow(s,1.28);
   const opened=.35+(r.angle-.35)*Math.pow(s,1.12);
   const local=ease(clamp(q*1.22-.22*s));
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
 stem(ctx){
  ctx.save();const g=ctx.createLinearGradient(435,0,462,0);g.addColorStop(0,'#6f8260');g.addColorStop(.5,'#a6af87');g.addColorStop(1,'#6d815d');
  ctx.beginPath();ctx.moveTo(450,407);ctx.bezierCurveTo(442,464,461,539,449,603);ctx.strokeStyle=g;ctx.lineWidth=8;ctx.lineCap='round';ctx.stroke();
  const leaf=(side,y)=>{ctx.save();ctx.translate(451,y);ctx.scale(side,1);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(26,-59,79,-70,114,-80);ctx.bezierCurveTo(89,-28,47,7,0,0);const l=ctx.createLinearGradient(0,0,100,-80);l.addColorStop(0,'#7f926d');l.addColorStop(.5,'#b6be99');l.addColorStop(1,'#8e9e79');ctx.fillStyle=l;ctx.fill();ctx.beginPath();ctx.moveTo(2,-1);ctx.quadraticCurveTo(56,-29,104,-72);ctx.strokeStyle='#e7e8cc88';ctx.lineWidth=1;ctx.stroke();ctx.restore();};
  leaf(-1,551);leaf(1,508);ctx.restore();
 }
 paintPetal(ctx,s){
  const {p,q,get}=s,outline=[];
  for(let j=0;j<=18;j++)outline.push(get(-1,j/18));
  for(let j=1;j<=28;j++)outline.push(get(-1+2*j/28,1));
  for(let j=17;j>=0;j--)outline.push(get(1,j/18));
  const base=get(0,0),tip=get(0,1),left=get(-1,.75),right=get(1,.75);
  // Each surface receives its own soft tissue gradient, never triangle fills.
  const light=(Math.cos(p.az+1.0)*.5+.5)*5;
  const pink=(l,sat=52,h=345)=>`hsl(${h+p.tint*.25} ${sat}% ${l+light}%)`;
  path(ctx,outline);ctx.shadowColor='rgba(111,48,73,.14)';ctx.shadowBlur=12;ctx.shadowOffsetY=3;
  const grad=ctx.createLinearGradient(base.x,base.y,tip.x,tip.y);
  grad.addColorStop(0,pink(49,38));grad.addColorStop(.28,pink(68,47));grad.addColorStop(.66,pink(80,56));grad.addColorStop(1,pink(89,62));
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
   path(ctx,points,false);ctx.lineWidth=k%3===0?.7:.45;ctx.strokeStyle=k%2===0?'rgba(255,248,240,.25)':'rgba(156,67,94,.10)';ctx.stroke();
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
 draw(){
  const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/900,h/760);
  this.stem(ctx);
  const surfaces=this.petals.map(p=>this.surface(p,this.progress));
  // Fixed painter order prevents sorting pops when the gesture reverses.
  // Rear petals, center, then front petals, far surfaces first.
  const back=surfaces.filter(s=>Math.sin(s.p.az)>=0).sort((a,b)=>a.p.layer-b.p.layer);
  const front=surfaces.filter(s=>Math.sin(s.p.az)<0).sort((a,b)=>b.p.layer-a.p.layer);
  back.forEach(s=>this.paintPetal(ctx,s));this.center(ctx);front.forEach(s=>this.paintPetal(ctx,s));
  ctx.restore();
 }
 destroy(){this.observer.disconnect();cancelAnimationFrame(this.pending);}
}
window.CanvasPeony=CanvasPeony;
})();
