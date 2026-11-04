// Shared public Contact and Insurance forms. Recipients are selected on the server.
import { initAuthUI } from './auth-client.js?v=20261103-checkout-download';
initAuthUI();
for(const form of document.querySelectorAll('form[data-inquiry-form]')) {
    const alertBox=form.querySelector('[data-form-alert]'),submit=form.querySelector('[type="submit"]');
    const choices=[...form.querySelectorAll('[data-insurance-type]')];
    let busy=false;
    for(const choice of choices)choice.addEventListener('click',()=>choice.setAttribute('aria-pressed',String(choice.getAttribute('aria-pressed')!=='true')));
    const show=(message,success)=>{
        alertBox.textContent=message;alertBox.className=`form-alert ${success?'form-alert-success':'form-alert-error'}`;
        alertBox.setAttribute('role',success?'status':'alert');alertBox.hidden=false;alertBox.focus();
    };
    form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy || !form.reportValidity())return;
        const values=new FormData(form),payload={inquiryType:form.dataset.inquiryType};
        for(const key of ['name','email','phone','propertyAddress','message'])payload[key]=String(values.get(key) || '').trim();
        if(payload.inquiryType==='insurance')payload.insuranceTypes=choices.filter(choice=>choice.getAttribute('aria-pressed')==='true').map(choice=>choice.dataset.insuranceType);
        const original=submit.textContent;busy=true;form.setAttribute('aria-busy','true');alertBox.hidden=true;
        const controls=[...form.querySelectorAll('button,input,textarea')];for(const control of controls)control.disabled=true;submit.textContent='Sending…';
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
        try {
            const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
            const data=await response.json().catch(()=>({}));if(!response.ok || data.success!==true)throw new Error(data.error || 'Your request could not be sent. Please try again.');
            form.reset();for(const choice of choices)choice.setAttribute('aria-pressed','false');
            show(data.emailSent===false?'Request received. We will be in touch soon.':'Request sent. We will be in touch soon.',true);
        }catch(error){show(error.name==='AbortError'?'The request took too long. Please try again.':error.message || 'Your request could not be sent. Please try again.',false);}
        finally{clearTimeout(timeout);busy=false;form.removeAttribute('aria-busy');for(const control of controls)control.disabled=false;submit.textContent=original;}
    });
}
