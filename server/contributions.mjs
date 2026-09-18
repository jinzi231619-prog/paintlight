import {SCHEMA_VERSION,validateAnswers} from '../public/classify-logic.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validContribution(body) {
  return body&&body.version===SCHEMA_VERSION&&typeof body.participant==='string'&&uuid.test(body.participant)&&
    typeof body.artworkId==='string'&&body.artworkId.length<=100&&validateAnswers(body.answers);
}
export async function handleContribution(request,env,getCatalog) {
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'origin'},403);
  if(!env.CONTRIBUTIONS||!env.CONTRIBUTION_LIMITER)return json({error:'unavailable'},503);
  if(!(await env.CONTRIBUTION_LIMITER.limit({key:request.headers.get('cf-connecting-ip')||'local'})).success)return json({error:'rate_limit'},429);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'format'},415);
  const reader=request.body?.getReader();if(!reader)return json({error:'format'},400);
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return json({error:'size'},413);}chunks.push(value);}
  let data;try{data=JSON.parse(await new Blob(chunks).text());}catch{return json({error:'format'},400);}
  if(!validContribution(data))return json({error:'answers'},400);
  const catalog=await getCatalog();
  if(!catalog.some(a=>a.id===data.artworkId&&a.expandedCatalog&&!a.userAdded))return json({error:'artwork'},400);
  // Only allow known fields; never store IP addresses, supplied notes, or credentials.
  const entry={version:SCHEMA_VERSION,participant:data.participant,artworkId:data.artworkId,answers:data.answers};
  const object=env.CONTRIBUTIONS.get(env.CONTRIBUTIONS.idFromName('pending-v1'));
  return object.fetch(new Request('https://contributions.internal/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)}));
}
// SQLite-backed storage is provisioned by the additive Wrangler migration.
// These are anonymous observations, not verified votes or catalog tags.
export class ContributionStore {
  constructor(ctx){
    this.sql=ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS observations (
      artwork_id TEXT NOT NULL, participant TEXT NOT NULL, schema_version INTEGER NOT NULL,
      answers TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
      PRIMARY KEY (artwork_id, participant)
    )`);
  }
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/submit')return json({error:'not_found'},404);
    const data=await request.json();if(!validContribution(data))return json({error:'answers'},400);
    const existing=[...this.sql.exec('SELECT status FROM observations WHERE artwork_id = ? AND participant = ?',data.artworkId,data.participant)];
    if(existing.length)return json({received:true,duplicate:true,status:'pending'});
    this.sql.exec('INSERT INTO observations (artwork_id, participant, schema_version, answers, created_at) VALUES (?, ?, ?, ?, ?)',data.artworkId,data.participant,SCHEMA_VERSION,JSON.stringify(data.answers),Date.now());
    return json({received:true,duplicate:false,status:'pending'},201);
  }
}
