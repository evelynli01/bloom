(() => {
'use strict';
const $=id=>document.getElementById(id), clamp=x=>Math.max(0,Math.min(100,x));
const flower=new CanvasPeony($('flower'));
let value=clamp(Number(new URLSearchParams(location.search).get('p')??35)),target=value,direction=0,raf=0,last=0;
function update(v){value=clamp(v);flower.setProgress(value/100);$('bloom').value=value;$('amount').value=`${Math.round(value)}%`;}
function play(d){direction=d;target=value;['open','close','pause'].forEach(id=>$(id).setAttribute('aria-pressed',String(d==={open:1,close:-1,pause:0}[id])));if(d)schedule();}
function schedule(){if(!raf)raf=requestAnimationFrame(tick);}
function tick(time){raf=0;const dt=last?Math.min((time-last)/1000,.06):1/60;last=time;
 if(direction){update(value+direction*dt*14);target=value;if(value===0||value===100)play(0);}
 else if(Math.abs(target-value)>.015)update(value+(target-value)*(1-Math.exp(-dt/0.075)));else update(target);
 if(direction||Math.abs(target-value)>.015)schedule();else last=0;
}
$('bloom').oninput=()=>{play(0);target=Number($('bloom').value);schedule();};
$('open').onclick=()=>play(1);$('close').onclick=()=>play(-1);$('pause').onclick=()=>play(0);
window.addEventListener('bloom:progress',e=>{play(0);target=clamp(Number(e.detail?.value)||0);schedule();});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT/.test(e.target.tagName))return;if(['Space','ArrowLeft','ArrowRight','Home','End'].includes(e.code))e.preventDefault();if(e.code==='Space')play(direction?0:value>=100?-1:1);if(e.code==='ArrowLeft'||e.code==='ArrowRight'){play(0);target=clamp(value+(e.code==='ArrowRight'?2:-2));schedule();}if(e.code==='Home'||e.code==='End'){play(0);target=e.code==='End'?100:0;schedule();}});
document.addEventListener('visibilitychange',()=>{last=0;});
update(value);
window.peonyDemo={setProgress(v){play(0);target=clamp(Number(v)||0);update(target);},getState:()=>({value,target,direction,petals:flower.petals.length,camera:cameraActive}),renderer:flower};

// Same MediaPipe version, palm normalization and pinch mapping as Bloom.
// Tracking is opt-in and loaded only when the camera button is pressed.
let stream=null,landmarker=null,cameraActive=false,cameraRaf=0,token=0,lastVideo=-1,smoothed=null;
const webcam=$('webcam');
function stopCamera(message='Camera off. The slider is ready.'){
 token++;cameraActive=false;cancelAnimationFrame(cameraRaf);stream?.getTracks().forEach(t=>t.stop());stream=null;webcam.srcObject=null;landmarker?.close();landmarker=null;lastVideo=-1;smoothed=null;$('cameraPanel').hidden=true;$('camera').disabled=false;$('camera').textContent='Use my hand';$('status').textContent=message;
}
async function startCamera(){
 if(cameraActive){stopCamera();return;}
 if(!navigator.mediaDevices?.getUserMedia){$('status').textContent='For hand control, open this demo on localhost or HTTPS.';return;}
 const current=++token;$('camera').disabled=true;$('status').textContent='Preparing hand tracking…';play(0);
 try{
  const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  if(current!==token)return;
  const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  if(current!==token)return;
  const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:1};
  let detector;
  try{detector=await mod.HandLandmarker.createFromOptions(vision,options);}catch(_){options.baseOptions.delegate='CPU';detector=await mod.HandLandmarker.createFromOptions(vision,options);}
  if(current!==token){detector.close();return;}landmarker=detector;
  const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
  if(current!==token){media.getTracks().forEach(t=>t.stop());return;}
  stream=media;webcam.srcObject=stream;await webcam.play();if(current!==token)return;
  cameraActive=true;$('cameraPanel').hidden=false;$('camera').disabled=false;$('camera').textContent='Stop camera';track();
 }catch(err){if(current===token)stopCamera(`Camera unavailable: ${err.message}. Use the slider.`);}
}
function track(){
 if(!cameraActive)return;
 try{
  if(webcam.readyState>=2&&webcam.currentTime!==lastVideo){
   lastVideo=webcam.currentTime;const res=landmarker.detectForVideo(webcam,performance.now()),pts=res.landmarks?.[0];
   if(pts){const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),palm=Math.max(.02,dist(pts[5],pts[17])),pinch=dist(pts[4],pts[8])/palm;const next=clamp((pinch-.22)/1.25*100);smoothed=smoothed===null?next:smoothed*.73+next*.27;window.dispatchEvent(new CustomEvent('bloom:progress',{detail:{value:smoothed}}));$('status').textContent='Hand tracked · Pinch to gather, spread to unfold.';}
   else $('status').textContent='Show your hand · The flower holds its position.';
  }
  cameraRaf=requestAnimationFrame(track);
 }catch(err){stopCamera(`Tracking stopped: ${err.message}`);}
}
$('camera').onclick=startCamera;$('stopCamera').onclick=()=>stopCamera();window.addEventListener('pagehide',()=>{stopCamera();flower.destroy();cancelAnimationFrame(raf);});
})();
