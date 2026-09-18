export const GROUPS = [
  ['人物', ['男性','女性','单人','多人','背影','侧脸']],
  ['场景', ['室内','街头','自然','水边']],
  ['光线与天气', ['白天','夜晚','黄昏','雨天','雪景']],
  ['色彩与构图', ['蓝色','绿色','红色','暖色','留白','纵深']]
];
export const TAGS = GROUPS.flatMap(x => x[1]);
const ALIASES = [
  ['雨夜',['雨天','夜晚']],['雨后的街道',['街头','雨后']],['雨后',['雨后']],
  ['男性',['男性']],['男人',['男性']],['男生',['男性']],['男士',['男性']],['男孩',['男孩']],
  ['女性',['女性']],['女人',['女性']],['女生',['女性']],['女士',['女性']],['女孩',['女孩']],
  ['一个人',['单人']],['独自一人',['单人']],['单人',['单人']],['多人',['多人']],['人群',['多人']],
  ['背影',['背影']],['侧脸',['侧脸']],['室内',['室内']],['房间',['室内']],['街头',['街头']],['街道',['街头']],['街景',['街头']],
  ['自然',['自然']],['风景',['自然']],['户外',['户外']],['水边',['水边']],['海边',['海边']],['河边',['河边']],['湖边',['湖边']],
  ['白天',['白天']],['日间',['白天']],['夜晚',['夜晚']],['夜间',['夜晚']],['夜景',['夜晚']],['晚上',['夜晚']],['黄昏',['黄昏']],['傍晚',['黄昏']],['日落',['黄昏']],
  ['雨天',['雨天']],['下雨',['雨天']],['雨中',['雨天']],['雪景',['雪景']],['雪天',['雪景']],['下雪',['正在下雪']],
  ['蓝色',['蓝色']],['偏蓝',['蓝色']],['绿色',['绿色']],['偏绿',['绿色']],['红色',['红色']],['偏红',['红色']],['暖色',['暖色']],['留白',['留白']],['纵深',['纵深']],
  ['male',['男性']],['man',['男性']],['men',['男性']],['female',['女性']],['woman',['女性']],['women',['女性']],
  ['one person',['单人']],['single person',['单人']],['solo',['单人']],['several people',['多人']],['multiple people',['多人']],['group',['多人']],
  ['back view',['背影']],['from behind',['背影']],['side profile',['侧脸']],['profile',['侧脸']],
  ['indoors',['室内']],['indoor',['室内']],['interior',['室内']],['room',['室内']],['street',['街头']],['streets',['街头']],
  ['nature',['自然']],['landscape',['自然']],['waterside',['水边']],['waterfront',['水边']],
  ['daytime',['白天']],['daylight',['白天']],['day',['白天']],['night',['夜晚']],['nighttime',['夜晚']],
  ['dusk',['黄昏']],['twilight',['黄昏']],['sunset',['黄昏']],['rain',['雨天']],['rainy',['雨天']],
  ['snow',['雪景']],['snowy',['雪景']],['blue',['蓝色']],['green',['绿色']],['red',['红色']],
  ['warm tones',['暖色']],['warm colors',['暖色']],['warm colours',['暖色']],['negative space',['留白']],['depth',['纵深']]
].sort((a,b)=>b[0].length-a[0].length);
export function parseQuery(query) {
  let rest = query.trim().toLowerCase(); const found = new Set();
  for (const [word, tags] of ALIASES) {
    const re = new RegExp(/^[a-z ]+$/.test(word) ? `\\b${word.replaceAll(' ', '\\s+')}\\b` : word, 'g');
    if (re.test(rest)) { tags.forEach(t=>found.add(t)); rest=rest.replace(re,' '); }
  }
  rest=rest.replace(/我想找|我想看|想找|想看|一幅|绘画|油画|画作|以及|还有|并且|最好|偏|有|和|与|的|一些|一点|是|请/g,'');
  rest=rest.replace(/\b(?:please|find|me|a|an|painting|paintings|with|and|of|in|at|the)\b/g,'');
  const unknown=rest.split(/[\s，,、；;。.!！?？/＋+]+/).filter(Boolean);
  for(const tag of [...found]) if(!TAGS.includes(tag)){unknown.push(tag);found.delete(tag);}
  return {tags:[...found],unknown:[...new Set(unknown)]};
}
export function filterArtworks(artworks,tags){return artworks.filter(a=>tags.every(t=>a.tags.includes(t)&&!!a.evidence?.[t]));}
export function chooseRandom(pool,seen,currentId,random=Math.random){
  if(!pool.length)return {art:null,restarted:false};
  let choices=pool.filter(a=>!seen.has(a.id));let restarted=false;
  if(!choices.length){restarted=true;choices=pool.filter(a=>a.id!==currentId);if(!choices.length)choices=pool;}
  return {art:choices[Math.min(choices.length-1,Math.floor(random()*choices.length))],restarted};
}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function colorDistance(a,b){
  const aa=(a.colors||[]).filter(c=>/^#[\da-f]{6}$/i.test(c)).map(rgb),bb=(b.colors||[]).filter(c=>/^#[\da-f]{6}$/i.test(c)).map(rgb);
  if(!aa.length||!bb.length)return Infinity;
  const directed=(x,y)=>x.reduce((sum,p)=>sum+Math.min(...y.map(q=>Math.hypot(...p.map((v,i)=>v-q[i])))),0)/x.length;
  return (directed(aa,bb)+directed(bb,aa))/2;
}
