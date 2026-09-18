export const SCHEMA_VERSION = 1;
export const QUESTIONS = {
  people: {title:'画里有人物吗？',hint:'只看画面，不用猜画家的意图。',options:[['yes','有人物','♙'],['no','没有人物','○'],['unknown','看不清','?']]},
  count: {title:'能看清几个人？',hint:'远处的小人也算；拿不准就选看不清。',options:[['one','一人','Ⅰ'],['many','两人或更多','Ⅱ'],['unknown','看不清','?']]},
  setting: {title:'主要场景在哪里？',hint:'看主体所在的空间；混合场景可以选不确定。',options:[['indoor','室内','⌂'],['outdoor','室外','↗'],['unknown','不确定','?']]},
  light: {title:'能判断是什么时候吗？',hint:'暗色不一定是夜晚；没有明确线索就选不确定。',options:[['day','白天','☀'],['night','夜晚','☾'],['dusk','黄昏','◒'],['unknown','不确定','?']]},
  water: {title:'画里能看到水面吗？',hint:'例如河流、湖泊或海面；雨和湿地面不算。',options:[['yes','有水面','≈'],['no','没有水面','○'],['unknown','看不清','?']]}
};
export function questionIds(answers={}) {
  return ['people',...(answers.people==='yes'?['count']:[]),'setting','light','water'];
}
export function nextQuestion(answers) {return questionIds(answers).find(id=>!Object.hasOwn(answers,id)) || null;}
export function validateAnswers(answers, complete=true) {
  if(!answers||typeof answers!=='object'||Array.isArray(answers))return false;
  const ids=questionIds(answers),keys=Object.keys(answers);
  if(keys.some(id=>!ids.includes(id)||!QUESTIONS[id].options.some(([value])=>value===answers[id])))return false;
  // A draft must be a contiguous prefix, so changing a branch cannot leave stale answers.
  const answered=ids.slice(0,keys.length);
  return answered.every(id=>Object.hasOwn(answers,id))&&(!complete||keys.length===ids.length);
}
export function undoAnswer(answers) {
  const copy={...answers};const last=questionIds(copy).filter(id=>Object.hasOwn(copy,id)).at(-1);
  if(last)delete copy[last];return copy;
}
export function answerLabel(id,value) {return QUESTIONS[id]?.options.find(([key])=>key===value)?.[1]||'';}
