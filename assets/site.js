/* D3 Axiom shared scripts */
(function(){
  var h=document.querySelector('header.top'),m=document.querySelector('.menu-btn');
  if(h&&m){
    m.addEventListener('click',function(){var o=h.classList.toggle('open');m.setAttribute('aria-expanded',o)});
    h.querySelectorAll('.links a').forEach(function(a){a.addEventListener('click',function(){h.classList.remove('open');m.setAttribute('aria-expanded','false')})});
  }
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
  // generic lead forms (tools beta, portfolio request)
  document.querySelectorAll('form.fs-form').forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(form.querySelector('[name=_hp]').value)return;
      var out=form.querySelector('.out'),btn=form.querySelector('button[type=submit]'),label=btn.innerHTML;
      var show=function(t){out.textContent=t;out.classList.add('on')};
      var data={_subject:form.dataset.subject,_cc:'quantumdigitalweb3@gmail.com',_template:'table',_captcha:'false'};
      new FormData(form).forEach(function(v,k){if(k==='_hp')return;data[k]=data[k]?data[k]+', '+v:v});
      data._autoresponse='Hi '+(data.name||'there')+', thanks for contacting D3 Axiom. Haris has your request and will reply within one business day. WhatsApp: +92 321 5922201';
      btn.disabled=true;btn.textContent='Sending...';
      fetch('https://formsubmit.co/ajax/mhskiyani007@gmail.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success==='false'||d.success===false)throw new Error(d.message);
        form.reset();show(form.dataset.ok||'Thanks! We have your request and will reply within one business day.');
      }).catch(function(){
        show('Sorry, the request could not be sent. Please email haris@imcodezero.com or message us on WhatsApp.'+(location.protocol==='file:'?' (Forms only work on the live website.)':''));
      }).then(function(){btn.disabled=false;btn.innerHTML=label});
    });
  });
})();
