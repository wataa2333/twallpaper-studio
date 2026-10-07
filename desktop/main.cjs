const {app,BrowserWindow,ipcMain,dialog,screen,shell,nativeImage} = require('electron');
const fs = require('fs/promises');
const path = require('path');
let main;
const smoke = process.argv.includes('--smoke-test');
if(smoke) app.setPath('userData',path.join(app.getPath('temp'),'twallpaper-studio-smoke'));
if(smoke) app.commandLine.appendSwitch('enable-unsafe-swiftshader');
function createWindow() {
  main = new BrowserWindow({show:!smoke,width:1320,height:900,minWidth:900,minHeight:650,backgroundColor:'#10151b',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:!smoke}});
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.loadFile(path.join(__dirname,'../dist/index.html'));
}
ipcMain.handle('screen-size',()=>{const d=screen.getPrimaryDisplay();return {width:Math.round(d.size.width*d.scaleFactor),height:Math.round(d.size.height*d.scaleFactor)}});
ipcMain.handle('github',()=>shell.openExternal('https://github.com/crashmax-dev/twallpaper'));
ipcMain.handle('owner',()=>shell.openExternal('https://github.com/wataa2333/twallpaper-studio'));
ipcMain.handle('save-config',async (_,config)=>{
  const r=await dialog.showSaveDialog(main,{defaultPath:'twallpaper-options.json',filters:[{name:'JSON',extensions:['json']}]});
  if(r.canceled) return false;
  await fs.writeFile(r.filePath,JSON.stringify(config,null,2));return true;
});
ipcMain.handle('open-config',async ()=>{
  const r=await dialog.showOpenDialog(main,{filters:[{name:'JSON',extensions:['json']}],properties:['openFile']});
  if(r.canceled)return null;
  const stat=await fs.stat(r.filePaths[0]);if(stat.size>1024*1024)throw Error('配置文件过大');
  return JSON.parse(await fs.readFile(r.filePaths[0],'utf8'));
});
async function renderExport(payload) {
  const {width,height}=payload;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16384||height>16384||width*height>64000000)throw Error('尺寸须为 1–16384 的整数，总像素不超过 6400 万');
  // The canvas compositor uses image pixels, avoiding Windows window limits/DPI.
  const win=new BrowserWindow({show:false,width:800,height:600,useContentSize:true,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false},backgroundColor:'#000000'});
  try {
    await win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{export:'1'}});
    const result=await win.webContents.executeJavaScript(`window.composeExport(${JSON.stringify(payload)})`);
    const data=Buffer.from(result.split(',')[1],'base64');
    const image=nativeImage.createFromBuffer(data);
    if(image.isEmpty()||image.getSize().width!==width||image.getSize().height!==height)throw Error('导出图像尺寸不匹配');
    return data;
  } finally {win.destroy()}
}
async function referencePreview(payload){
  const width=960,height=540;
  const win=new BrowserWindow({show:false,width,height,useContentSize:true,webPreferences:{backgroundThrottling:false},backgroundColor:'#000'});
  try{
    await win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{export:'1'}});
    await win.webContents.executeJavaScript(`window.prepareExport(${JSON.stringify(payload)})`);
    await win.webContents.executeJavaScript(`document.getElementById('logical').style.transform='scale(${width/payload.width})';new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    return (await win.webContents.capturePage({x:0,y:0,width,height},{stayHidden:true,stayAwake:true})).toPNG();
  }finally{win.destroy()}
}
function compareScenes(reference,exported){
  const a=nativeImage.createFromBuffer(reference).resize({width:480,height:270,quality:'best'}).toBitmap();
  const b=nativeImage.createFromBuffer(exported).resize({width:480,height:270,quality:'best'}).toBitmap();
  let total=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a[i+c]-b[i+c]);
  return total/(480*270*3);
}
ipcMain.handle('export-image',async (_,payload)=>{
  const ext=payload.format==='jpg'?'jpg':'png';
  const r=await dialog.showSaveDialog(main,{defaultPath:`wallpaper-${payload.width}x${payload.height}.${ext}`,filters:[{name:ext.toUpperCase(),extensions:[ext]}]});
  if(r.canceled)return false;
  const data=await renderExport(payload);await fs.writeFile(r.filePath,data);return true;
});
app.whenReady().then(async ()=>{
  if(smoke)console.log('TEST: app ready');
  createWindow();
  if(smoke){
    try {
      await new Promise(resolve=>main.webContents.once('did-finish-load',resolve));
      console.log('TEST: UI loaded');
      const result=await main.webContents.executeJavaScript('window.runSmokeTests()');
      console.log('TEST: renderers checked');
      await fs.mkdir('artifacts',{recursive:true});
      await main.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      await fs.writeFile('artifacts/preview.png',(await main.webContents.capturePage(undefined,{stayAwake:true,stayHidden:true})).toPNG());
      result.exports=[];
      result.previewComparisons=[];
      for(const overrides of [{enablePattern:false},{mixBlendMode:'overlay'},{mixBlendMode:'normal'},{mixBlendMode:'soft-light'},{mixBlendMode:'hard-light'},{pattern:{mask:true,background:'#283544'}},{pattern:{blur:2.5}}]){
        const payload=await main.webContents.executeJavaScript(`window.testPreviewFixture(${JSON.stringify(overrides)})`);
        const reference=await referencePreview(payload),exported=await renderExport(payload);
        const error=compareScenes(reference,exported);
        const name=!payload.config.enablePattern?'gradient':payload.config.pattern.mask?'mask':payload.config.pattern.blur?'blur':payload.config.mixBlendMode;
        await fs.writeFile(`artifacts/matching-preview-${name}.png`,reference);
        await fs.writeFile(`artifacts/matching-export-${name}.png`,exported);
        console.log('TEST: preview/export comparison',name,error);
        if(error>3)throw Error(`Preview/export mismatch (${name}): mean channel error ${error}`);
        result.previewComparisons.push({mode:name,width:3840,height:2160,meanChannelError:error});
      }
      for(const [width,height,mask,blend] of [[1920,1080,false,'overlay'],[1080,1920,true,'normal'],[3840,2160,false,'soft-light'],[7680,4320,false,'hard-light'],[1379,811,false,'normal']]) {
        const payload=await main.webContents.executeJavaScript(`window.testExportPayload(${width},${height},${mask},'${blend}')`);
        console.log('TEST: export',width,height);
        const data=await renderExport(payload);
        const bitmap=nativeImage.createFromBuffer(data).toBitmap();
        let colored=false;for(let i=0;i<bitmap.length;i+=4){if(bitmap[i]+bitmap[i+1]+bitmap[i+2]>15){colored=true;break}}
        if(!colored)throw Error(`Export ${width}x${height} is blank`);
        const size=nativeImage.createFromBuffer(data).getSize();
        if(size.width!==width||size.height!==height)throw Error('Export pixel dimensions do not match');
        await fs.writeFile(`artifacts/export-${width}x${height}.png`,data);
        result.exports.push({width,height,mask,blend,validPixels:true});
      }
      const jpgPayload=await main.webContents.executeJavaScript("window.testExportPayload(1379,811,false,'normal')");jpgPayload.format='jpg';
      const jpg=await renderExport(jpgPayload);if(jpg[0]!==255||jpg[1]!==216)throw Error('Invalid JPEG');
      await fs.writeFile('artifacts/export-1379x811.jpg',jpg);result.jpegExport=true;
      await fs.writeFile('artifacts/smoke.json',JSON.stringify(result,null,2));
      console.log('SMOKE PASS',JSON.stringify(result));app.exit(0);
    }catch(e){console.error(e);app.exit(1)}
  }
});
app.on('window-all-closed',()=>app.quit());
