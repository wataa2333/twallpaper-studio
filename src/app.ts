import {TWallpaper} from '../vendor/twallpaper/twallpaper';
import {TWallpaperWebGL} from '../vendor/webgl/twallpaper';
import {hexToVec3} from '../vendor/webgl/hex-to-vec3';
import {COLORS,generateRandomColors} from '../vendor/colors';
import {PATTERNS} from '../vendor/patterns';
import {positions} from '../vendor/twallpaper/constants';
import patternData from './pattern-data.json';
import {composeWallpaper} from './export';

declare global {interface Window {desktop:any;prepareExport:any;composeExport:any;runSmokeTests:any;testExportPayload:any;testPreviewFixture:any}}
const $ = (id:string)=>document.getElementById(id) as any;
const clone = (v:any)=>JSON.parse(JSON.stringify(v));
const defaults = {width:1920,height:1080,format:'png',renderer:'canvas',fps:60,tails:90,animate:true,scrollAnimate:true,colors:clone(COLORS[0].colors),enablePattern:true,mixBlendMode:'overlay',pattern:{image:'animals.svg',background:'#000000',blur:0,size:'420px',opacity:.5,mask:false}};
let state:any=clone(defaults), engine:any, frame=0, glPhase=0, last=0;
const exportMode=new URLSearchParams(location.search).has('export');
function validate(v:any) {
  const s={...clone(defaults),...v,pattern:{...defaults.pattern,...v.pattern}};
  if(!Array.isArray(s.colors)||s.colors.length<1||s.colors.length>4||s.colors.some((c:any)=>typeof c!=='string'||!/^#([\da-f]{3}|[\da-f]{6})$/i.test(c)))throw Error('颜色须为 1–4 个 HEX 值，如 #88b884');
  s.colors=s.colors.map((c:string)=>c.length===4?'#'+c.slice(1).split('').map(x=>x+x).join(''):c);
  for(const [key,min,max] of [['width',1,16384],['height',1,16384],['fps',1,360],['tails',5,90]] as const)if(!Number.isInteger(s[key])||s[key]<min||s[key]>max)throw Error(`${key} 超出有效范围 ${min}–${max}`);
  if(s.width*s.height>64000000)throw Error('总像素不能超过 6400 万，请降低尺寸');
  if(!['canvas','webgl'].includes(s.renderer)||!['png','jpg'].includes(s.format)||!['normal','overlay','hard-light','soft-light'].includes(s.mixBlendMode))throw Error('配置包含不支持的模式');
  for(const k of ['animate','scrollAnimate','enablePattern'])if(typeof s[k]!=='boolean')throw Error('无效开关设置');
  if(typeof s.pattern.mask!=='boolean'||!/^#[\da-f]{6}$/i.test(s.pattern.background))throw Error('无效图案设置');
  if(!Number.isFinite(s.pattern.blur)||s.pattern.blur<0||s.pattern.blur>5||!Number.isFinite(s.pattern.opacity)||s.pattern.opacity<0||s.pattern.opacity>1)throw Error('无效透明度或模糊值');
  if(typeof s.pattern.size!=='string'||!/^\d+(\.\d+)?px$/.test(s.pattern.size)||parseFloat(s.pattern.size)<1||parseFloat(s.pattern.size)>10000)throw Error('图案尺寸须为 1–10000px');
  const file=String(s.pattern.image).split('/').pop();
  if(!PATTERNS.some(p=>p.path.endsWith('/'+file)))throw Error('配置中的图案不属于内置预设');
  s.pattern.image=file;return s;
}
function patternOptions(){return {...state.pattern,image:patternData[state.pattern.image]}}
function options(){const o={colors:state.colors,fps:state.fps,tails:state.tails,animate:state.animate,scrollAnimate:state.scrollAnimate};return state.enablePattern?{...o,pattern:patternOptions()}:o}
function saved(){return {...state,phase:engine instanceof TWallpaper?{phase:engine.phase,tail:engine.tail}: {glPhase}}}
function status(text:string,error=false){if($('status')){$('status').textContent=text;$('status').className='status'+(error?' error':'')}}
function persist(){localStorage.setItem('twallpaper-studio',JSON.stringify(saved()));$('config').value=JSON.stringify(saved(),null,2)}
function fit(){if(exportMode)return;const area=$('area');const scale=Math.min((area.clientWidth-56)/state.width,(area.clientHeight-56)/state.height);$('box').style.width=`${state.width*scale}px`;$('box').style.height=`${state.height*scale}px`;$('logical').style.width=state.width+'px';$('logical').style.height=state.height+'px';$('logical').style.transform=`scale(${scale})`;$('resolution').textContent=`${state.width} × ${state.height}`}
function syncPattern(){const host=$('wallpaper'),p=patternOptions();host.style.setProperty('--tw-background',p.background);host.style.setProperty('--tw-size',p.size);host.style.setProperty('--tw-opacity',String(p.opacity));host.style.setProperty('--tw-blur',p.blur+'px');host.style.setProperty('--tw-image',state.enablePattern?`url("${p.image}")`:'none');host.querySelector('canvas').classList.toggle('tw-mask',state.enablePattern&&p.mask);host.querySelector('.tw-pattern').style.mixBlendMode=state.mixBlendMode}
function glDraw(){
  const phase=Math.floor(glPhase),t=glPhase-phase;
  for(let i=0;i<4;i++){const a=positions[(phase+i*2)%8],b=positions[(phase+1+i*2)%8];engine[`color${i+1}Pos`]=[a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t]}
  engine.renderGradient();
}
function glLoop(time:number){if(state.animate&&time-last>=1000/state.fps){glPhase=(glPhase+1/state.tails)%8;glDraw();last=time}frame=requestAnimationFrame(glLoop)}
function buildEngine(phase?:any){
  cancelAnimationFrame(frame);
  if(engine instanceof TWallpaper){engine.scrollAnimate(false);engine.dispose()}
  else if(engine?.gl){engine.gl.getExtension('WEBGL_lose_context')?.loseContext()}
  const host=$('wallpaper');host.innerHTML='';
  if(state.renderer==='canvas'){
    engine=new TWallpaper(host,{...options(),pattern:patternOptions(),animate:false,scrollAnimate:false});engine.init();
    if(phase&&Number.isFinite(phase.phase)&&Number.isFinite(phase.tail)){engine.phase=((phase.phase%8)+8)%8;engine.tail=phase.tail%state.tails}
    engine.drawGradient();engine.animate(state.animate);
  }else{
    engine=new TWallpaperWebGL(host);const cs=[...state.colors];while(cs.length<4)cs.push(cs[cs.length-1]);
    engine.init({colors:cs.map(hexToVec3),mask:state.pattern.mask,image:patternOptions().image,backgroundColor:state.pattern.background,size:parseFloat(state.pattern.size),opacity:state.pattern.opacity});
    glPhase=Number.isFinite(phase?.glPhase)?phase.glPhase%8:0;glDraw();frame=requestAnimationFrame(glLoop);
  }
  syncPattern();fit();
}
function update(){try{state=validate(state);buildEngine(saved().phase);persist();status('已更新 · 可导出当前画面')}catch(e:any){status(e.message,true)}}
function ui(){
 $('root').innerHTML=`<div class="layout"><aside class="sidebar"><h1>TWallpaper Studio</h1><div class="subtitle">Telegram 风格壁纸 · 离线创作</div>
 <div class="section"><h2>01 / 配色</h2><label class="row"><span>原站预设</span><select id="preset">${COLORS.map((c,i)=>`<option value="${i}">${c.text}</option>`).join('')}<option value="custom">自定义</option></select></label><div id="colors" class="colors"></div><div class="buttons"><button id="random">随机配色</button><button id="add">＋ 颜色</button><button id="remove">－ 颜色</button></div><div class="hint">支持 1–4 种颜色，可使用色盘或 HEX 输入。</div></div>
 <div class="section"><h2>02 / 图案</h2><label class="row"><span>启用图案</span><input id="enablePattern" type="checkbox"></label><label class="row"><span>原站图案</span><select id="pattern">${PATTERNS.map(p=>`<option value="${p.path.split('/').pop()}">${p.text}</option>`).join('')}</select></label><label class="row"><span>遮罩 mask</span><input id="mask" type="checkbox"></label><label class="row"><span>大小 / px</span><input id="size" type="number" min="1" max="10000"></label><label class="row"><span>透明度</span><input id="opacity" type="number" min="0" max="1" step="0.1"></label><label class="row"><span>模糊 / px</span><input id="blur" type="number" min="0" max="5" step="0.1"></label><label class="row"><span>遮罩背景</span><input id="background" type="color"></label><label class="row"><span>混合模式</span><select id="blend">${['normal','overlay','hard-light','soft-light'].map(x=>`<option>${x}</option>`).join('')}</select></label><div class="hint">遮罩开启时，使用背景色；模糊及混合模式不作用于遮罩。</div></div>
 <div class="section"><h2>03 / 动画</h2><label class="row"><span>渲染器</span><select id="renderer"><option value="canvas">Canvas · 原版</option><option value="webgl">WebGL</option></select></label><label class="row"><span>自动动画</span><input id="animate" type="checkbox"></label><label class="row"><span>滚轮动画</span><input id="scrollAnimate" type="checkbox"></label><label class="row"><span>帧率 FPS</span><input id="fps" type="number" min="1" max="360"></label><label class="row"><span>过渡长度 tails</span><input id="tails" type="number" min="5" max="90"></label><button id="next">下一个位置</button></div>
 <div class="section"><h2>04 / 分辨率与导出</h2><label class="row"><span>尺寸预设</span><select id="sizePreset"><option value="custom">自定义</option><option value="1920,1080">1920 × 1080</option><option value="2560,1440">2560 × 1440</option><option value="3840,2160">4K · 3840 × 2160</option><option value="7680,4320">8K · 7680 × 4320</option><option value="3440,1440">超宽 · 3440 × 1440</option><option value="1080,1920">竖屏 · 1080 × 1920</option></select></label><div class="dimensions"><input id="width" type="number" min="1" max="16384"><span>×</span><input id="height" type="number" min="1" max="16384"></div><div class="buttons" style="margin-top:10px"><button id="swap">交换宽高</button><button id="screen">屏幕分辨率</button></div><label class="row"><span>文件格式</span><select id="format"><option value="png">PNG · 无损</option><option value="jpg">JPEG · 高质量</option></select></label><div class="hint">边长 1–16384px，总像素最多 6400 万。导出当前画面，包含图案与遮罩。</div></div>
 <div class="section"><details><summary>配置 JSON / 保存与导入</summary><textarea id="config" readonly></textarea><div class="buttons"><button id="copy">复制</button><button id="save">保存配置</button><button id="import">导入配置</button></div></details><div class="buttons" style="margin-top:15px"><button id="reset">重置</button><button id="github">项目源码</button></div><div class="hint" style="margin-top:12px">基于 crashmax-dev/twallpaper · MIT License<br>设置自动保存在此电脑。F11 全屏预览。</div></div></aside>
 <main class="workspace"><div class="toolbar"><div><h2 style="margin:0">实时预览</h2><div class="subtitle" id="resolution"></div></div><div class="buttons"><span class="tag">19 套配色 / 19 种图案</span><button id="fullscreen">全屏 F11</button></div></div><div class="preview-area" id="area"><div class="preview-box" id="box"><div class="logical" id="logical"><div id="wallpaper" class="tw-wrap"></div></div></div></div><div class="footer"><span id="status" class="status">准备就绪</span><button class="primary" id="export">导出壁纸</button></div></main></div>`;
 fill();buildEngine(state.phase);persist();bind();
}
function fillColors(){
 $('colors').innerHTML=state.colors.map((c:string,i:number)=>`<div class="color"><input type="color" value="${c}" data-color="${i}"><input type="text" value="${c}" data-hex="${i}" maxlength="7" aria-label="颜色 ${i+1}"></div>`).join('');
 $('colors').querySelectorAll('input').forEach((input:any)=>input.onchange=()=>{const i=Number(input.dataset.color??input.dataset.hex),old=state.colors[i];state.colors[i]=input.value;try{state=validate(state);$('preset').value='custom';fillColors();update()}catch(e:any){state.colors[i]=old;status(e.message,true);fillColors()}});
 $('add').disabled=state.colors.length>=4;$('remove').disabled=state.colors.length<=1;
}
function fill(){
 for(const k of ['width','height','format','renderer','fps','tails'])$(k).value=state[k];
 for(const k of ['animate','scrollAnimate','enablePattern'])$(k).checked=state[k];
 for(const k of ['mask','opacity','blur','background']){if(k==='mask')$(k).checked=state.pattern[k];else $(k).value=state.pattern[k]}
 $('size').value=parseFloat(state.pattern.size);$('pattern').value=state.pattern.image;$('blend').value=state.mixBlendMode;
 $('blur').disabled=state.pattern.mask;$('blend').disabled=state.pattern.mask;$('background').disabled=!state.pattern.mask;
 const index=COLORS.findIndex(x=>JSON.stringify(x.colors)===JSON.stringify(state.colors));$('preset').value=index>=0?String(index):'custom';fillColors();
}
function bind(){
 for(const k of ['width','height','fps','tails','format','renderer','animate','scrollAnimate','enablePattern'])$(k).onchange=()=>{
   const old=clone(state);state[k]=['animate','scrollAnimate','enablePattern'].includes(k)?$(k).checked:['format','renderer'].includes(k)?$(k).value:Number($(k).value);
   try{state=validate(state);update()}catch(e:any){state=old;fill();status(e.message,true)}
 };
 for(const k of ['mask','opacity','blur','background','size'])$(k).onchange=()=>{const old=clone(state);state.pattern[k]=k==='mask'?$(k).checked:k==='size'?$(k).value+'px':['opacity','blur'].includes(k)?Number($(k).value):$(k).value;try{state=validate(state);fill();update()}catch(e:any){state=old;fill();status(e.message,true)}};
 $('pattern').onchange=()=>{state.pattern.image=$('pattern').value;update()};$('blend').onchange=()=>{state.mixBlendMode=$('blend').value;update()};
 $('preset').onchange=()=>{if($('preset').value!=='custom'){state.colors=clone(COLORS[Number($('preset').value)].colors);fill();update()}};
 $('random').onclick=()=>{state.colors=generateRandomColors(state.colors.length);fill();update()};$('add').onclick=()=>{if(state.colors.length<4)state.colors.push('#ffffff');fill();update()};$('remove').onclick=()=>{if(state.colors.length>1)state.colors.pop();fill();update()};
 $('next').onclick=()=>{state.animate=false;$('animate').checked=false;if(engine instanceof TWallpaper){engine.toNextPosition(()=>persist())}else{glPhase=(Math.floor(glPhase)+1)%8;glDraw();persist()}status('已暂停 · 当前位置可导出')};
 $('sizePreset').onchange=()=>{if($('sizePreset').value==='custom')return;[state.width,state.height]=$('sizePreset').value.split(',').map(Number);fill();update()};
 $('swap').onclick=()=>{[state.width,state.height]=[state.height,state.width];fill();update()};$('screen').onclick=async()=>{Object.assign(state,await window.desktop.screenSize());fill();update()};
 $('reset').onclick=()=>{state=clone(defaults);fill();buildEngine();persist();status('已恢复原站默认设置')};
 $('copy').onclick=async()=>{try{persist();await navigator.clipboard.writeText($('config').value);status('配置已复制')}catch(e:any){status(e.message,true)}};
 $('save').onclick=async()=>{try{if(await window.desktop.saveConfig(saved()))status('配置已保存')}catch(e:any){status(e.message,true)}};
 $('import').onclick=async()=>{try{const v=await window.desktop.openConfig();if(!v)return;state=validate(v);fill();buildEngine(v.phase);persist();status('配置已导入')}catch(e:any){status(e.message,true)}};
 $('github').onclick=()=>window.desktop.github();
 $('fullscreen').onclick=toggleFull;
 $('export').onclick=async()=>{const button=$('export');button.disabled=true;try{status('正在生成壁纸…');const payload=exportPayload();if(await window.desktop.exportImage(payload))status('壁纸已保存');else status('已取消保存')}catch(e:any){status('导出失败：'+e.message,true)}finally{button.disabled=false}};
 $('area').addEventListener('wheel',(e:WheelEvent)=>{if(!state.scrollAnimate)return;e.preventDefault();if(engine instanceof TWallpaper){engine.onWheel(e)}else{glPhase=((glPhase+e.deltaY/50/state.tails)%8+8)%8;glDraw()}},{passive:false});
 new ResizeObserver(fit).observe($('area'));
 window.addEventListener('beforeunload',persist);
 document.addEventListener('keydown',e=>{if(e.key==='F11'){e.preventDefault();toggleFull()}if(e.key==='Escape'){document.body.classList.remove('full-preview');fit()}});
}
async function toggleFull(){
 if(document.fullscreenElement){await document.exitFullscreen();document.body.classList.remove('full-preview')}
 else{document.body.classList.add('full-preview');try{await document.documentElement.requestFullscreen()}catch(e:any){status(e.message,true)}}
 fit();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('full-preview');fit()});
function exportPayload(){
 if(!(engine instanceof TWallpaper))engine.renderGradient();
 const canvas=$('wallpaper').querySelector('canvas');return {width:state.width,height:state.height,format:state.format,config:saved(),gradient:canvas.toDataURL('image/png')};
}
window.prepareExport=async (payload:any)=>{
 state=validate(payload.config);document.body.className='export-body';
 $('root').innerHTML='<div class="logical" id="logical"><div class="tw-wrap" id="wallpaper"><canvas class="tw-canvas"></canvas><div class="tw-pattern"></div></div></div>';
 $('logical').style.width=payload.width+'px';$('logical').style.height=payload.height+'px';
 const image=new Image();image.src=payload.gradient;await image.decode();
 const canvas=$('wallpaper').querySelector('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);syncPattern();
 if(state.enablePattern){const p=new Image();p.src=patternOptions().image;await p.decode()}
 await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
};
window.composeExport=(payload:any)=>composeWallpaper(payload,validate(payload.config));
window.testExportPayload=(w:number,h:number,mask:boolean,blend:string)=>{state.width=w;state.height=h;state.pattern.mask=mask;state.mixBlendMode=blend;state.animate=false;buildEngine();return exportPayload()};
window.testPreviewFixture=(overrides:any)=>{
 state=validate({...clone(defaults),width:3840,height:2160,animate:false,tails:5,colors:COLORS.find(c=>c.text==='Ice')!.colors,...overrides,pattern:{...defaults.pattern,image:'math.svg',size:'1500px',...overrides.pattern}});
 buildEngine({phase:3,tail:2});return exportPayload();
};
window.runSmokeTests=async ()=>{
 const assert=(v:any,m:string)=>{if(!v)throw Error(m)};
 assert(COLORS.length===19&&PATTERNS.length===19,'Preset counts');
 for(const p of PATTERNS){const im=new Image();im.src=p.path;await im.decode();assert(im.width>0,p.text)}
 for(const c of COLORS){state.colors=clone(c.colors);state.animate=false;buildEngine();const pixels=engine.ctx.getImageData(0,0,50,50).data;assert(pixels[3]===255,c.text)}
 let rejected=0;for(const v of [{width:-1},{width:16384,height:16384},{colors:['oops']},{pattern:{image:'../evil.svg'}}]){try{validate({...defaults,...v})}catch{rejected++}}
 assert(rejected===4,'Invalid config rejection');
 state=clone(defaults);state.animate=false;fill();buildEngine();persist();
 const round=validate(saved());assert(round.pattern.image==='animals.svg','Config round trip');
 state.renderer='webgl';buildEngine();engine.renderGradient();
 const pixel=new Uint8Array(4);engine.gl.readPixels(100,75,1,1,engine.gl.RGBA,engine.gl.UNSIGNED_BYTE,pixel);assert(pixel[3]===255&&pixel[0]+pixel[1]+pixel[2]>0,'WebGL renders');
 const snapshot=exportPayload();assert(snapshot.gradient.length>1000,'WebGL snapshot');
 state=clone(defaults);state.animate=false;fill();buildEngine();persist();
 return {colorPresets:COLORS.length,patternPresets:PATTERNS.length,patternsDecoded:true,allColorsRendered:true,invalidConfigsRejected:rejected,configRoundTrip:true,webglRender:true,webglSnapshot:true};
};
if(!exportMode){try{const data=localStorage.getItem('twallpaper-studio');if(data)state=validate(JSON.parse(data))}catch{}ui()}
