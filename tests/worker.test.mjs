import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import worker from '../server/worker.mjs';import {viewer} from '../server/access.mjs';
const config={ACCESS_TEAM_DOMAIN:'paintlight-test.cloudflareaccess.com',ACCESS_AUD:'test-app'};
test('Access authentication verifies signature, audience, expiry, and cookie; identity headers cannot bypass it',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';const resolver=createLocalJWKSet({keys:[jwk]});
 const sign=(aud='test-app',exp='2h')=>new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://'+config.ACCESS_TEAM_DOMAIN).setAudience(aud).setSubject('alice').setIssuedAt().setExpirationTime(exp).sign(privateKey);
 const token=await sign();const req=headers=>new Request('https://paintlight.test/api/private/uploads',{headers});
 assert.deepEqual(await viewer(req({'cf-access-jwt-assertion':token}),config,resolver),{id:'alice'});
 assert.deepEqual(await viewer(req({cookie:'CF_Authorization='+token}),config,resolver),{id:'alice'});
 for(const t of ['forged',await sign('wrong-audience'),await sign('test-app','-1h')])assert.equal(await viewer(req({'cf-access-jwt-assertion':t}),config,resolver),null);
 assert.equal(await viewer(req({'oai-authenticated-user-id':'alice'}),config,resolver),null);
});
test('independent public gallery loads without login; private routes fail closed',async()=>{
 const env={ASSETS:{fetch:async()=>Response.json(JSON.parse(fs.readFileSync('public/artworks.json','utf8')))},SEARCH_LIMITER:{limit:async()=>({success:true})}};
 const r=await worker.fetch(new Request('https://paintlight.test/api/search?q=窗边&source=library'),env);assert.equal(r.status,200);assert.equal((await r.json()).sources[0].name,'网站画库');
 const account=await worker.fetch(new Request('https://paintlight.test/api/account'),env).then(r=>r.json());assert.equal(account.uploadsReady,false);assert.equal(account.signedIn,false);
 const privateRequest=new Request('https://paintlight.test/api/private/uploads',{headers:{'oai-authenticated-user-id':'alice','cf-access-jwt-assertion':'fake'}});assert.equal((await worker.fetch(privateRequest,env)).status,401);
 assert.equal((await worker.fetch(new Request('https://paintlight.test/api/uploads'),env)).status,404);
 env.SEARCH_LIMITER.limit=async()=>({success:false});assert.equal((await worker.fetch(new Request('https://paintlight.test/api/search?q=moon'),env)).status,429);
});
