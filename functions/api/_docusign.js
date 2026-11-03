// No credentials or access tokens are returned to a browser.
const fail = (message,status=502) => Object.assign(new Error(message),{status});
export function docusignConfigured(env) {
    return ['DOCUSIGN_INTEGRATION_KEY','DOCUSIGN_USER_ID','DOCUSIGN_ACCOUNT_ID','DOCUSIGN_PRIVATE_KEY'].every(k=>Boolean(env[k]));
}
const base64 = bytes => {let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const b64url = bytes => base64(bytes).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export function signatureTabs(value) {
    if (!Array.isArray(value) || !value.length || value.length>30) throw fail('Enter 1–30 reviewed signature positions.',400);
    return value.map(t=>{
        if (!Number.isInteger(t.page) || t.page<1 || t.page>1000 || !Number.isInteger(t.x) || t.x<0 || t.x>2000 || !Number.isInteger(t.y) || t.y<0 || t.y>2000) throw fail('Each signature position requires page, x and y integers within the document.',400);
        return {documentId:'1',pageNumber:String(t.page),xPosition:String(t.x),yPosition:String(t.y),recipientId:'1'};
    });
}
export async function docusignClient(env) {
    if (!docusignConfigured(env)) throw fail('Configure DocuSign demo credentials before signing.',503);
    const mode=env.DOCUSIGN_ENV || 'demo';
    if (!['demo','production'].includes(mode)) throw fail('Invalid DocuSign environment.',503);
    const host=mode==='production'?'account.docusign.com':'account-d.docusign.com';
    const pem=String(env.DOCUSIGN_PRIVATE_KEY).replace(/\\n/g,'\n');
    if (!pem.includes('BEGIN PRIVATE KEY')) throw fail('DocuSign RSA key must be PKCS#8 PEM.',503);
    const der=Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const enc=new TextEncoder();const now=Math.floor(Date.now()/1000);
    const assertion=[{alg:'RS256',typ:'JWT'},{iss:env.DOCUSIGN_INTEGRATION_KEY,sub:env.DOCUSIGN_USER_ID,aud:host,iat:now,exp:now+3600,scope:'signature impersonation'}].map(x=>b64url(enc.encode(JSON.stringify(x)))).join('.');
    const signed=`${assertion}.${b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(assertion))))}`;
    const tokenResponse=await fetch(`https://${host}/oauth/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:signed})});
    const token=await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw fail('DocuSign authentication failed. Check demo credentials and signature/impersonation consent.',503);
    const auth={Authorization:`Bearer ${token.access_token}`};
    const info=await fetch(`https://${host}/oauth/userinfo`,{headers:auth});
    if (!info.ok) throw fail('Could not verify DocuSign account.');
    const account=(await info.json()).accounts?.find(a=>a.account_id===env.DOCUSIGN_ACCOUNT_ID);
    if (!account || !/^https:\/\/[a-z0-9-]+\.docusign\.net$/i.test(account.base_uri)) throw fail('DocuSign account or API origin is invalid.',503);
    const root=`${account.base_uri}/restapi/v2.1/accounts/${encodeURIComponent(account.account_id)}`;
    async function call(path,method='GET',body,pdf=false) {
        const r=await fetch(root+path,{method,headers:{...auth,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
        if (!r.ok) throw fail(`DocuSign ${method} failed (${r.status}); review the envelope before retrying.`);
        if (pdf) {const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>20*1024*1024 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw fail('DocuSign returned an invalid or oversized PDF.');return bytes;}
        return r.status===204?{}:r.json();
    }
    return {mode,call,encodePDF:base64};
}
