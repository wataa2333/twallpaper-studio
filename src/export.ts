import patternData from './pattern-data.json';

function canvas(width:number,height:number){const c=document.createElement('canvas');c.width=width;c.height=height;return c}
async function load(src:string){const image=new Image();image.src=src;await image.decode();return image}

// Render in target image pixels, independent of native window size and DPI.
// CSS center-repeat, opacity, blend modes and masks are reproduced here.
export async function composeWallpaper(payload:any,config:any):Promise<string>{
 const {width,height}=payload,p=config.pattern;
 const output=canvas(width,height),ctx=output.getContext('2d')!;
 ctx.fillStyle=p.background;ctx.fillRect(0,0,width,height);
 const gradient=await load(payload.gradient);
 if(!config.enablePattern){ctx.drawImage(gradient,0,0,width,height);return encode()}
 const uri=patternData[p.image],image=await load(uri);
 const svg=new DOMParser().parseFromString(atob(uri.split(',')[1]),'image/svg+xml').documentElement;
 const box=svg.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number);
 const tileWidth=parseFloat(p.size),tileHeight=tileWidth*box[3]/box[2];
 const padding=p.mask?0:Math.ceil(p.blur*4);
 const layer=canvas(width+padding*2,height+padding*2),lc=layer.getContext('2d')!;
 // Center the same tile that CSS background-position / mask-position centers.
 const left=(width-tileWidth)/2,top=(height-tileHeight)/2;
 const startX=left-Math.ceil((left+padding)/tileWidth)*tileWidth;
 const startY=top-Math.ceil((top+padding)/tileHeight)*tileHeight;
 for(let y=startY;y<height+padding;y+=tileHeight)for(let x=startX;x<width+padding;x+=tileWidth)lc.drawImage(image,x+padding,y+padding,tileWidth,tileHeight);
 if(p.mask){
   lc.globalCompositeOperation='source-in';lc.drawImage(gradient,0,0,width,height);
   ctx.globalAlpha=p.opacity;ctx.drawImage(layer,0,0);
 }else{
   ctx.drawImage(gradient,0,0,width,height);
   ctx.globalAlpha=p.opacity;ctx.globalCompositeOperation=config.mixBlendMode;
   if(p.blur)ctx.filter=`blur(${p.blur}px)`;
   ctx.drawImage(layer,-padding,-padding);
 }
 const result=encode();layer.width=layer.height=1;output.width=output.height=1;return result;
 function encode(){const result=output.toDataURL(payload.format==='jpg'?'image/jpeg':'image/png',1);if(result==='data:,')throw Error('无法生成此尺寸的壁纸');return result}
}
