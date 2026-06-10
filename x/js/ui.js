/* =====================================================================
   IMAI LAB — UI data layer (clock · ledger · balance · asset loaders)
   ( preloader / reveals / chapters / cursor are handled in scroll.js )
   ===================================================================== */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const pad=(n,l=2)=>String(n).padStart(l,'0');
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const fmt=v=>Math.floor(v).toLocaleString('en-US');

  /* clock (JST) */
  const clock=$('#clock');
  if(clock) setInterval(()=>{const d=new Date(Date.now()+9*3600*1000);
    clock.textContent=`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}·JST`;},1000);

  /* ledger columns DR / CR */
  function buildLedger(el,align){if(!el)return;for(let i=0;i<14;i++){
    const row=document.createElement('div');row.className='row';row.style.animationDelay=(0.6+i*0.04)+'s';
    const idx=`<span class="i">${pad(i+1)}</span>`,num=`<span class="n">${fmt(rnd(1000,999999))}</span>`;
    row.innerHTML=align==='left'?idx+num:num+idx;el.appendChild(row);}}
  const lL=$('#ledgerL'),lR=$('#ledgerR');
  buildLedger(lL,'left');buildLedger(lR,'right');
  function tick(el){const rows=el&&el.querySelectorAll('.row');if(!rows||!rows.length)return;
    const r=rows[Math.floor(Math.random()*rows.length)],n=r.querySelector('.n');if(!n)return;
    n.textContent=fmt(rnd(1000,999999));r.classList.add('flash');setTimeout(()=>r.classList.remove('flash'),260);}
  if(lL)setInterval(()=>tick(lL),230); if(lR)setInterval(()=>tick(lR),300);

  /* center balance → 0 */
  const balNum=$('#balNum'),sumState=$('#sumState');
  if(balNum) setInterval(()=>{
    if(Math.random()<0.82){balNum.textContent='0.000000';if(sumState)sumState.textContent='BALANCED';}
    else{const d=rnd(-1,1)*Math.pow(10,-rnd(1,6));balNum.textContent=(d>=0?'+':'−')+Math.abs(d).toFixed(6);
      if(sumState)sumState.textContent='RECONCILING';}
  },520);

  /* balance section live equation */
  const eqL=$('#eqL'),eqR=$('#eqR');
  if(eqL&&eqR) setInterval(()=>{const v=Math.floor(rnd(100000,9999999));
    eqL.textContent='+'+v.toLocaleString('en-US');eqR.textContent='−'+v.toLocaleString('en-US');},900);

  /* footer year */
  const fy=$('#footYr'); if(fy) fy.textContent='© '+new Date().getFullYear();

  /* ---- asset loaders (graceful if missing) ---- */
  const load=(src,cb)=>{const im=new Image();im.onload=()=>cb();im.src=src;};

  // logo mark
  (function(){const lm=$('.brand .logo-mark');if(!lm)return;
    load('assets/logo-mark.png',()=>{lm.style.backgroundImage='url(assets/logo-mark.png)';lm.classList.add('on');});})();

  // service card thumbs
  $$('.svc[data-img]').forEach(a=>{const key=a.getAttribute('data-img'),t=a.querySelector('.thumb');if(!t)return;
    load(`assets/${key}.png`,()=>{t.style.backgroundImage=`url(assets/${key}.png)`;t.classList.add('on');});});

  // band-act backgrounds (inject .act-bg)
  $$('.act.band[data-bg]').forEach(sec=>{const n=sec.getAttribute('data-bg');
    const bg=document.createElement('div');bg.className='act-bg';sec.prepend(bg);
    load(`assets/sec-bg-0${n}.png`,()=>{bg.style.backgroundImage=`url(assets/sec-bg-0${n}.png)`;});});

  // interlude backgrounds
  $$('.interlude[data-img]').forEach(sec=>{const key=sec.getAttribute('data-img'),bg=sec.querySelector('.il-bg');if(!bg)return;
    load(`assets/${key}.png`,()=>{bg.style.backgroundImage=`url(assets/${key}.png)`;});});
})();
