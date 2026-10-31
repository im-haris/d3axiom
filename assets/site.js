/* D3 Axiom shared scripts */
/* ---------- Lead form with email code verification (EmailJS) ----------
   Fill in these four values from your EmailJS dashboard (emailjs.com). Until all four are set,
   the form cannot send and shows the WhatsApp fallback instead.
   Your own email address is set inside the EmailJS "lead" template, never in this page. */
var EMAILJS = {
  publicKey: 'gFXEN538csoJ1QXKk',       // Account > General > Public Key
  serviceId: 'service_qag5zbp',       // Email Services > your service ID
  otpTemplateId: 'template_ppoms08',   // code template: To Email {{to_email}}, body uses only {{code}} (no other variables, no links)
  leadTemplateId: 'template_1ds8fr4'   // template that emails the verified lead to you (To Email: your address)
};
(function(){
  var SUBJECTS={contact:'D3 Axiom website: email enquiry',calculator_unlock:'D3 Axiom calculators: unlock request'};
  var CODE_TTL=10*60*1000, MAX_TRIES=5, RESEND_WAIT=60;
  var modal=null,opener=null,opts={},pending=null,resendTimer=null;
  function configured(){return !!(EMAILJS.publicKey&&EMAILJS.serviceId&&EMAILJS.otpTemplateId&&EMAILJS.leadTemplateId);}
  function send(templateId,params){
    return fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({service_id:EMAILJS.serviceId,template_id:templateId,user_id:EMAILJS.publicKey,template_params:params})})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);});
  }
  function newCode(){
    var n;
    try{var a=new Uint32Array(1);crypto.getRandomValues(a);n=a[0]%1000000;}catch(e){n=Math.floor(Math.random()*1000000);}
    return String(n).padStart(6,'0');
  }
  // ---- typo suggestions for common email domains ----
  var DOMAINS=['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com','msn.com','protonmail.com','proton.me','yahoo.co.uk','hotmail.co.uk','me.com','mail.com','zoho.com','gmx.com'];
  function dist(a,b){var m=a.length,n=b.length,d=[],i,j;for(i=0;i<=m;i++)d[i]=[i];for(j=0;j<=n;j++)d[0][j]=j;
    for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
  function suggest(email){
    var at=email.lastIndexOf('@');if(at<1)return null;
    var user=email.slice(0,at),dom=email.slice(at+1).toLowerCase();
    if(!dom||DOMAINS.indexOf(dom)>-1)return null;
    var fixed=dom.replace(/\.(con|cmo|ocm|vom|comm|om|co\.)$/,'.com');
    if(fixed!==dom&&DOMAINS.indexOf(fixed)>-1)return user+'@'+fixed;
    var best=null,bd=3;
    DOMAINS.forEach(function(d){var x=dist(dom,d);if(x<bd){bd=x;best=d;}});
    if(best&&bd<=2)return user+'@'+best;
    if(fixed!==dom)return user+'@'+fixed;
    return null;
  }
  function q(sel){return modal.querySelector(sel);}
  function build(){
    modal=document.createElement('div');
    modal.className='lead-modal';modal.hidden=true;
    modal.innerHTML='<div class="lead-backdrop" data-close></div>'+
      '<div class="lead-box" role="dialog" aria-modal="true" aria-labelledby="lead-title" aria-describedby="lead-text">'+
      '<button type="button" class="lead-x" data-close aria-label="Close">&times;</button>'+
      '<h3 id="lead-title"></h3><p id="lead-text" class="note"></p>'+
      '<form class="lead-form" id="lead-step1" novalidate>'+
      '<label for="lead-email">Your email<input id="lead-email" type="email" autocomplete="email" required></label>'+
      '<p class="lead-sugg" id="lead-sugg" hidden></p>'+
      '<p class="lead-err" id="lead-err" role="alert" hidden></p>'+
      '<label for="lead-name">Your name (optional)<input id="lead-name" type="text" autocomplete="name"></label>'+
      '<label for="lead-brand">Brand or store (optional)<input id="lead-brand" type="text"></label>'+
      '<label for="lead-msg" class="lead-msgwrap">Your message<textarea id="lead-msg"></textarea></label>'+
      '<button class="btn" type="submit" style="justify-content:center">Send me a code &rarr;</button>'+
      '<p class="note">We email you a 6-digit code to confirm the address is correct.</p></form>'+
      '<form class="lead-form" id="lead-step2" novalidate hidden>'+
      '<label for="lead-code">6-digit code<input id="lead-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"></label>'+
      '<p class="lead-err" id="lead-err2" role="alert" hidden></p>'+
      '<button class="btn" type="submit" style="justify-content:center">Verify and send &rarr;</button>'+
      '<p class="lead-links"><button type="button" class="linkbtn" id="lead-resend">Resend code</button> <button type="button" class="linkbtn" id="lead-change">Change email</button></p></form>'+
      '<div class="out" id="lead-out" aria-live="polite"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',function(e){if(e.target.hasAttribute('data-close'))close();});
    modal.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key!=='Tab')return;
      var f=[].slice.call(modal.querySelectorAll('button,input,textarea,a[href]')).filter(function(el){return !el.disabled&&el.offsetParent!==null;});
      if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}
      else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}
    });
    q('#lead-email').addEventListener('blur',showSuggestion);
    q('#lead-step1').addEventListener('submit',step1);
    q('#lead-step2').addEventListener('submit',step2);
    q('#lead-resend').addEventListener('click',resend);
    q('#lead-change').addEventListener('click',function(){showStep(1);q('#lead-email').focus();});
  }
  function showSuggestion(){
    var s=suggest(q('#lead-email').value.trim()),box=q('#lead-sugg');
    if(!s){box.hidden=true;return;}
    box.innerHTML='';box.appendChild(document.createTextNode('Did you mean '));
    var b=document.createElement('button');b.type='button';b.className='linkbtn inline';b.textContent=s;
    b.addEventListener('click',function(){q('#lead-email').value=s;box.hidden=true;q('#lead-email').focus();});
    box.appendChild(b);box.appendChild(document.createTextNode('?'));box.hidden=false;
  }
  function showStep(n){
    q('#lead-step1').hidden=n!==1;q('#lead-step2').hidden=n!==2;
    q('#lead-out').classList.remove('on');q('#lead-out').textContent='';
  }
  function fail(msg){var out=q('#lead-out');out.textContent=(msg||'Sorry, we could not send that.')+' Please message us on WhatsApp instead: +92 321 5922201.';out.classList.add('on');}
  function busy(form,on,text){var b=form.querySelector('button[type=submit]');if(on){b.dataset.label=b.innerHTML;b.disabled=true;b.textContent=text;}else{b.disabled=false;if(b.dataset.label)b.innerHTML=b.dataset.label;}}
  function startResendWait(){
    var b=q('#lead-resend'),left=RESEND_WAIT;clearInterval(resendTimer);b.disabled=true;b.textContent='Resend code ('+left+'s)';
    resendTimer=setInterval(function(){left--;if(left<=0){clearInterval(resendTimer);b.disabled=false;b.textContent='Resend code';}else b.textContent='Resend code ('+left+'s)';},1000);
  }
  function sendCode(){
    pending.code=newCode();pending.expires=Date.now()+CODE_TTL;pending.tries=0;
    return send(EMAILJS.otpTemplateId,{to_email:pending.data.email,code:pending.code});
  }
  function open(o){
    if(!modal)build();
    opts=o||{};opener=document.activeElement;pending=null;
    q('#lead-title').textContent=opts.title||'Send us an email';
    q('#lead-text').textContent=opts.text||'';
    q('.lead-msgwrap').hidden=opts.message===false;
    q('#lead-step1').reset();q('#lead-step2').reset();
    q('#lead-err').hidden=true;q('#lead-err2').hidden=true;q('#lead-sugg').hidden=true;
    q('label[for=lead-name]').hidden=!!opts.compact;q('label[for=lead-brand]').hidden=!!opts.compact;
    if(opts.email)q('#lead-email').value=opts.email;if(opts.name)q('#lead-name').value=opts.name;
    showStep(1);if(opts.email)showSuggestion();
    modal.hidden=false;document.body.style.overflow='hidden';
    q('#lead-email').focus();
  }
  function close(){
    if(!modal||modal.hidden)return;
    modal.hidden=true;document.body.style.overflow='';clearInterval(resendTimer);
    if(opener&&opener.focus)opener.focus();
  }
  function step1(e){
    e.preventDefault();
    var email=q('#lead-email'),err=q('#lead-err'),v=email.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){err.textContent='Please enter a valid email address, like name@company.com.';err.hidden=false;email.setAttribute('aria-invalid','true');email.focus();return;}
    err.hidden=true;email.removeAttribute('aria-invalid');
    if(!configured()){fail('Sorry, we could not submit your email right now.');return;}
    var type=opts.type||'contact';
    pending={data:{email:v,subject:opts.subject||SUBJECTS[type]||'D3 Axiom website enquiry',enquiry_type:type,
      name:q('#lead-name').value.trim(),brand:q('#lead-brand').value.trim(),message:opts.messageText!=null?opts.messageText:q('#lead-msg').value.trim(),
      page:location.pathname,sent_at:new Date().toISOString(),verified:'yes'}};
    var form=q('#lead-step1');busy(form,true,'Sending code...');
    sendCode().then(function(){
      showStep(2);
      q('#lead-title').textContent='Check your email';
      q('#lead-text').textContent='We sent a 6-digit code to '+v+'. It expires in 10 minutes. Check your spam folder if you do not see it.';
      startResendWait();q('#lead-code').focus();
    }).catch(function(){pending=null;fail('Sorry, we could not send the code.');})
    .then(function(){busy(form,false);});
  }
  function step2(e){
    e.preventDefault();
    var input=q('#lead-code'),err=q('#lead-err2'),c=input.value.replace(/\D/g,'');
    if(!pending){showStep(1);return;}
    if(Date.now()>pending.expires){err.textContent='This code has expired. Press "Resend code" to get a new one.';err.hidden=false;return;}
    if(pending.tries>=MAX_TRIES){err.textContent='Too many attempts. Press "Resend code" to get a new code.';err.hidden=false;return;}
    if(c!==pending.code){pending.tries++;err.textContent='That code is not right. Please check the email and try again.';err.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
    err.hidden=true;input.removeAttribute('aria-invalid');
    var form=q('#lead-step2');busy(form,true,'Sending...');
    send(EMAILJS.leadTemplateId,pending.data).then(function(){
      form.hidden=true;clearInterval(resendTimer);
      q('#lead-title').textContent='Thank you!';
      q('#lead-text').textContent=opts.successText?opts.successText:pending.data.enquiry_type==='calculator_unlock'?'Your email is confirmed and unlimited use is now unlocked on this device.':'Your email is confirmed. We have your message and will reply within one business day.';
      if(typeof opts.onSuccess==='function')opts.onSuccess();
      pending=null;
    }).catch(function(){fail('Your email is confirmed, but we could not send your message.');})
    .then(function(){busy(form,false);});
  }
  function resend(){
    if(!pending)return;
    var b=q('#lead-resend');b.disabled=true;
    sendCode().then(function(){q('#lead-err2').hidden=true;q('#lead-code').value='';startResendWait();q('#lead-code').focus();})
    .catch(function(){b.disabled=false;fail('Sorry, we could not resend the code.');});
  }
  window.D3Lead={open:open,close:close,configured:configured};
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-lead]');
    if(!b)return;e.preventDefault();
    open({type:b.getAttribute('data-lead'),title:'Send us an email',text:'Write your message and we will reply by email within one business day.'});
  });
})();
(function(){
  var h=document.querySelector('header.top'),m=document.querySelector('.menu-btn');
  if(h&&m){
    m.addEventListener('click',function(){var o=h.classList.toggle('open');m.setAttribute('aria-expanded',o)});
    h.querySelectorAll('.links a').forEach(function(a){a.addEventListener('click',function(){h.classList.remove('open');m.setAttribute('aria-expanded','false')})});
  }
  // dropdown menus: click/tap to open, Escape or outside click to close
  var dds=document.querySelectorAll('.dd');
  function closeAll(except){dds.forEach(function(d){if(d!==except){d.classList.remove('open');var b=d.querySelector('.dd-btn');if(b)b.setAttribute('aria-expanded','false');}});}
  dds.forEach(function(d){
    var b=d.querySelector('.dd-btn');
    b.addEventListener('click',function(e){e.stopPropagation();var o=!d.classList.contains('open');closeAll(d);d.classList.toggle('open',o);b.setAttribute('aria-expanded',o);});
    d.addEventListener('keydown',function(e){if(e.key==='Escape'){d.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus();}});
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.dd'))closeAll();});
  // links that preselect a service in the contact form
  document.querySelectorAll('[data-svc]').forEach(function(a){
    a.addEventListener('click',function(){var sel=document.getElementById('svc');if(sel)sel.value=a.dataset.svc});
  });
  // blog category filter
  var fb=document.querySelectorAll('.filters button');
  fb.forEach(function(b){b.addEventListener('click',function(){
    fb.forEach(function(x){x.classList.toggle('on',x===b)});
    document.querySelectorAll('[data-cat]').forEach(function(c){c.hidden=b.dataset.f!=='all'&&c.dataset.cat!==b.dataset.f});
  })});
  // other lead forms (home enquiry, tools beta, portfolio): confirm the email with a code, then send
  var LABELS={svc:'Service',link:'Store or website link',msg:'Goal'};
  document.querySelectorAll('form.fs-form').forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!form.reportValidity())return;
      var out=form.querySelector('.out');
      var show=function(t){out.textContent=t;out.classList.add('on')};
      var email='',name='',order=[],vals={};
      [].forEach.call(form.elements,function(el){
        var k=el.name||el.id;
        if(!k||el.type==='submit'||el.type==='button'||k==='_hp'||k==='hp')return;
        if((el.type==='checkbox'||el.type==='radio')&&!el.checked)return;
        var v=String(el.value).trim();
        if(k==='email'){email=v;return;}
        if(k==='name'){name=v;return;}
        if(!v)return;
        var lab=LABELS[k]||k;
        if(vals[lab]!=null)vals[lab]+=', '+v;else{vals[lab]=v;order.push(lab);}
      });
      if(!window.D3Lead||!D3Lead.configured()){show('Sorry, the request could not be sent. Please message us on WhatsApp: +92 321 5922201.');return;}
      var ok=form.dataset.ok||'Thanks! We have your request and will reply within one business day.';
      D3Lead.open({compact:true,message:false,type:form.dataset.type||'enquiry',subject:form.dataset.subject,
        email:email,name:name,messageText:order.map(function(l){return l+': '+vals[l];}).join('\n'),
        title:'Confirm your email',text:'We will email you a 6-digit code to confirm your address, then send your request.',
        successText:'Your email is confirmed. '+ok,
        onSuccess:function(){form.reset();show(ok);}});
    });
  });
})();
