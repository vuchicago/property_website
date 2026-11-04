import { authFetch, onAuthUserChanged } from './auth-client.js?v=20261103-checkout-download';
const form=document.getElementById('official-form-setup'),status=document.getElementById('form-status'),inspect=document.getElementById('inspect-official');
form.elements.year.value=new Date().getFullYear();
let revision=0;
const endpoint=()=>`/api/admin/appeal-forms?year=${encodeURIComponent(form.elements.year.value)}&kind=${encodeURIComponent(form.elements.kind.value)}`;
async function result(response) {const data=await response.json();if(!response.ok)throw new Error(data.error || 'Could not load official forms.');return data;}
async function load() {
    const observed=++revision;
    form.hidden=true;
    form.elements.file.value='';
    for(const name of ['officialReviewed','mappingReviewed','signaturesBlank'])form.elements[name].checked=false;
    try {
        const data=await result(await authFetch(endpoint()));
        if(observed!==revision)return;
        form.hidden=false;
        document.getElementById('form-source').href=data.sourceUrl;
        form.elements.sourceUrl.value=data.published?.sourceUrl || data.sourceUrl;
        form.elements.mapping.value=data.published?JSON.stringify(data.published.mapping,null,2):'';
        document.getElementById('official-value-list').textContent=JSON.stringify(data.values,null,2);
        document.getElementById('official-field-list').textContent='';
        status.textContent=data.published?`Published template: ${data.published.revision.slice(0,12)}. Import a new version when the official form changes.`:'This form needs a reviewed template. Owners can save their information while the preparation desk sets it up.';
    }catch(error){if(observed===revision){form.hidden=true;status.textContent=error.message;}}
}
async function upload(action) {
    const file=form.elements.file.files[0];if(!file)throw new Error('Choose the current official PDF first.');
    const data={action};
    if(action==='publish')Object.assign(data,{mapping:JSON.parse(form.elements.mapping.value),sourceUrl:form.elements.sourceUrl.value,officialReviewed:form.elements.officialReviewed.checked,mappingReviewed:form.elements.mappingReviewed.checked,signaturesBlank:form.elements.signaturesBlank.checked});
    const body=new FormData();body.set('data',JSON.stringify(data));body.set('file',file);
    return result(await authFetch(endpoint(),{method:'POST',body}));
}
inspect.addEventListener('click',async()=>{
    const observed=revision;
    inspect.disabled=true;
    try {
        const data=await upload('inspect');
        if(observed!==revision)return;
        document.getElementById('official-field-list').textContent=JSON.stringify(data.fields,null,2);
        if(!form.elements.mapping.value)form.elements.mapping.value=JSON.stringify(Object.fromEntries(data.fields.map(field=>[field.name,field.signature?{skip:true,reason:'Owner signs after review'}:{source:'',required:true}])),null,2);
        status.textContent=`Inspected ${data.pages} page(s). Map every field and review the actual PDF before publishing.`;
    }catch(error){status.textContent=error.message;}finally{inspect.disabled=false;}
});
form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
    try{const data=await upload('publish');status.textContent=`Published reviewed template ${data.revision.slice(0,12)}. It is available for prefilled owner packets.`;}
    catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
form.elements.year.addEventListener('change',load);form.elements.kind.addEventListener('change',load);
onAuthUserChanged(user=>{if(user?.emailVerified)void load();else{revision++;form.hidden=true;status.textContent='Sign in with a verified administrator account to manage official forms.';}});
