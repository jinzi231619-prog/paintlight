const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function luminance(color){const c=Array.isArray(color)?color:rgb(color);return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function hex(c){return '#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){return a.map((v,i)=>v*(1-t)+b[i]*t)}
function accessible(base,bg,target){let c=base;for(let t=0;t<=1;t+=.025){c=mix(base,target,t);if(contrast(c,bg)>=4.7)return c;}return target;}
function hsl(c){const [r,g,b]=c.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return [(h+360)%360,s,l];}
function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const t=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return t.map(v=>(v+m)*255);}
export function themeFromPalette(palette){
 const colors=palette.filter(c=>/^#[a-f0-9]{6}$/i.test(c)).map(rgb);if(!colors.length)colors.push([40,55,35]);
 const ranked=colors.map((c,i)=>({c,weight:(1-i*.08)*(hsl(c)[1]+.12)*(1-Math.abs(hsl(c)[2]-.48))})).sort((a,b)=>b.weight-a.weight);
 const [h,s]=hsl(ranked[0].c),sat=s<.08?.04:clamp(s*.9,.24,.45);
 const average=colors.reduce((v,c)=>v+luminance(c),0)/colors.length,light=average>.21;
 const bg=fromHsl(h,sat,light?.86:.22),panel=fromHsl(h,sat*.82,light?.92:.19),stage=fromHsl(h,sat*.9,light?.80:.18);
 const surfaces=[bg,panel,stage],target=light?[0,0,0]:[255,255,255];
 let text=fromHsl(h,.12,light?.08:.94),muted=fromHsl(h,.12,light?.19:.76);
 for(const surface of surfaces){text=accessible(text,surface,target);muted=accessible(muted,surface,target);}
 let accent=fromHsl(h,Math.min(.38,sat),light?.20:.80);for(const surface of surfaces)accent=accessible(accent,surface,target);
 const accentText=contrast(accent,[0,0,0])>=contrast(accent,[255,255,255])?[0,0,0]:[255,255,255];
 const line=mix(bg,text,.25),lineStrong=mix(bg,text,.48);
 return {'bg':hex(bg),'panel':hex(panel),'stage':hex(stage),'text':hex(text),'muted':hex(muted),'accent':hex(accent),'accent-dark':hex(accentText),'line':hex(line),'line-strong':hex(lineStrong),'hover':hex(mix(bg,accent,.10)),'accent-hover':hex(mix(accent,light?[0,0,0]:[255,255,255],.05)),'light':light};
}
export function applyTheme(palette){const t=themeFromPalette(palette),root=document.documentElement,mode=t.light?'light':'dark';if((root.style.colorScheme||'dark')!==mode){root.classList.add('theme-instant');requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.remove('theme-instant')));}for(const [k,v] of Object.entries(t))if(k!=='light')root.style.setProperty('--'+k,v);root.style.colorScheme=mode;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.bg);}
export function paletteFromImage(image){
 const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,96,96);const d=ctx.getImageData(0,0,96,96).data,bins=new Map();
 for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const c=[d[i],d[i+1],d[i+2]],key=c.map(v=>Math.floor(v/32)).join(',');const b=bins.get(key)||{n:0,sum:[0,0,0]};b.n++;c.forEach((v,j)=>b.sum[j]+=v);bins.set(key,b);}
 return [...bins.values()].sort((a,b)=>b.n-a.n).slice(0,5).map(b=>hex(b.sum.map(v=>v/b.n)));
}
