import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {SCHEMA_VERSION,questionIds,nextQuestion,validateAnswers,undoAnswer} from '../public/classify-logic.mjs';
import {ContributionStore,handleContribution} from '../server/contributions.mjs';
import worker from '../server/worker.mjs';
const catalog=JSON.parse(fs.readFileSync('public/artworks.json','utf8'));
const art=catalog.find(a=>a.expandedCatalog);
const answers={people:'no',setting:'outdoor',light:'unknown',water:'yes'};
const body=()=>({version:SCHEMA_VERSION,participant:'f3491fda-dcc5-4bd9-b5cb-e4dd58e10aee',artworkId:art.id,answers:{...answers}});
const request=(data=body(),headers={},method='POST')=>new Request('https://paintlight.test/api/contributions',{method,headers:{origin:'https://paintlight.test','content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(data)}:{})});
function storage(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){const s=db.prepare(query);return s.columns().length?s.all(...args):(s.run(...args),[]);}};
 return {db,sql};
}
test('conditional questions, unknown answers, and undo preserve a valid complete or partial observation',()=>{
 assert.equal(questionIds({people:'no'}).length,4);assert.equal(questionIds({people:'yes'}).length,5);
 assert(validateAnswers(answers));assert(validateAnswers({people:'yes',count:'unknown',setting:'unknown',light:'unknown',water:'unknown'}));
 assert(!validateAnswers({...answers,count:'one'}));assert(!validateAnswers({people:'yes',setting:'indoor',light:'day',water:'no'}));
 assert(!validateAnswers({...answers,light:'probably'}));assert(!validateAnswers({setting:'indoor'},false));
 const undone=undoAnswer(answers);assert.equal(nextQuestion(undone),'water');assert(validateAnswers(undone,false));assert(!validateAnswers(undone));
 assert.deepEqual(undoAnswer({people:'yes',count:'many'}),{people:'yes'});
 assert.equal(nextQuestion({people:'no'}),'setting');
});
test('SQLite observations survive object recreation; retries and concurrent duplicates store one pending record without changing catalog tags',async()=>{
 const {db,sql}=storage();let object=new ContributionStore({storage:{sql}});
 const req=data=>new Request('https://contributions.internal/submit',{method:'POST',body:JSON.stringify(data)});
 try{
  const original=JSON.stringify(catalog);const results=await Promise.all([object.fetch(req(body())),object.fetch(req(body()))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM observations').get().n,1);
  object=new ContributionStore({storage:{sql}});assert.equal((await object.fetch(req(body())).then(r=>r.json())).duplicate,true);
  const altered=body();altered.answers.water='no';await object.fetch(req(altered));
  const stored=db.prepare('SELECT * FROM observations').get();assert.equal(stored.status,'pending');assert.deepEqual(JSON.parse(stored.answers),answers);
  assert.equal(JSON.stringify(catalog),original);
 }finally{db.close();}
});
test('public contribution route accepts only bounded same-origin observations of unreviewed catalog works',async()=>{
 const {db,sql}=storage();const store=new ContributionStore({storage:{sql}});let sent;
 const env={CONTRIBUTION_LIMITER:{limit:async()=>({success:true})},CONTRIBUTIONS:{idFromName:n=>n,get:()=>({fetch:r=>{sent=r.clone();return store.fetch(r);}})},ASSETS:{fetch:async()=>Response.json(catalog)}};
 try{
  let r=await worker.fetch(request({...body(),extraSecret:'do not store me'}),env);assert.equal(r.status,201);assert.deepEqual(Object.keys(await sent.json()).sort(),['answers','artworkId','participant','version']);
  assert.equal((await handleContribution(request(body(),{origin:'https://other.test'}),env,async()=>catalog)).status,403);
  assert.equal((await handleContribution(request(body(),{'sec-fetch-site':'cross-site'}),env,async()=>catalog)).status,403);
  assert.equal((await handleContribution(request(null,{},'GET'),env,async()=>catalog)).status,405);
  assert.equal((await handleContribution(request({...body(),participant:['f3491fda-dcc5-4bd9-b5cb-e4dd58e10aee']}),env,async()=>catalog)).status,400);
  assert.equal((await handleContribution(request({...body(),artworkId:catalog.find(a=>!a.expandedCatalog).id}),env,async()=>catalog)).status,400);
  assert.equal((await handleContribution(request({...body(),answers:{people:'no'}}),env,async()=>catalog)).status,400);
  assert.equal((await handleContribution(request({...body(),padding:'x'.repeat(3000)}),env,async()=>catalog)).status,413);
  assert.equal((await handleContribution(request(),{},async()=>catalog)).status,503);
  env.CONTRIBUTION_LIMITER.limit=async()=>({success:false});assert.equal((await handleContribution(request(),env,async()=>catalog)).status,429);
 }finally{db.close();}
});
