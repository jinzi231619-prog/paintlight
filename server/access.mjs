import {createRemoteJWKSet,jwtVerify} from 'jose';
const keys=new Map();
export function accessConfigured(env){return /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'')&&!!env.ACCESS_AUD;}
export async function viewer(request,env,resolver){
 if(!accessConfigured(env))return null;
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('CF_Authorization='))?.slice(17);
 const token=request.headers.get('cf-access-jwt-assertion')||cookie;
 if(!token||token.length>16000)return null;
 const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
 if(!resolver){if(!keys.has(issuer))keys.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));resolver=keys.get(issuer);}
 try{const {payload}=await jwtVerify(token,resolver,{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['sub','exp','iat']});return typeof payload.sub==='string'&&payload.sub.length<=200?{id:payload.sub}:null;}catch{return null;}
}
