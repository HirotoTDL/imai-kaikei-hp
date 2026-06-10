/* =====================================================================
   IMAI LAB — scroll cinema orchestration
   lenis smooth-scroll + gsap scrolltrigger + webgl state driving
   ===================================================================== */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  // shared state consumed by the webgl stage (x.js)
  const S = window.LAB_STATE = window.LAB_STATE || {};
  Object.assign(S, Object.assign({camZ:7,camX:0,camY:0,ringScale:1,ringTilt:-0.32,ringSpin:1,
    pSpeed:1,hue:0,core:0.85,bloom:0.62}, S));

  function revealAll(){document.body.classList.add('revealed');
    $$('[data-rise]').forEach(e=>e.classList.add('in'));}

  /* ---------------- custom cursor ---------------- */
  (function cursor(){
    const c=$('#cursor'), d=$('#cursor-dot'); if(!c||!d) return;
    let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
    addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;
      d.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`;});
    (function loop(){cx+=(mx-cx)*0.18;cy+=(my-cy)*0.18;
      c.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;requestAnimationFrame(loop);})();
    const hov='a,button,.svc,.m-row,.ct-block,.fact-row li,#chapters a,[data-hover]';
    document.addEventListener('pointerover',e=>{if(e.target.closest(hov))c.classList.add('hover');});
    document.addEventListener('pointerout',e=>{if(e.target.closest(hov))c.classList.remove('hover');});
  })();

  /* ---------------- preloader ---------------- */
  function runBoot(done){
    const boot=$('#boot'),pct=$('#bootPct'),bar=$('#boot .boot-bar i'),txt=$('#bootTxt');
    const phases=['OPENING LEDGER','LOADING ENTRIES','BALANCING DR / CR','SUM → 0','ACCESS GRANTED'];
    let p=0,ph=0;
    const id=setInterval(()=>{
      p=Math.min(100,p+(Math.random()*9+5));
      if(pct)pct.textContent=Math.floor(p);if(bar)bar.style.width=p+'%';
      if(p>(ph+1)*20&&ph<phases.length-1){ph++;if(txt)txt.textContent=phases[ph];}
      if(p>=100){clearInterval(id);if(txt)txt.textContent=phases[phases.length-1];
        setTimeout(()=>{if(boot)boot.classList.add('done');done&&done();},500);}
    },140);
  }

  /* ---------------- hero wordmark split ---------------- */
  function splitHero(){
    const h=$('.hero h1[data-split]'); if(!h) return [];
    const html=h.innerHTML.split('<br>').map(line=>
      [...line].map(ch=>`<span class="ch">${ch}</span>`).join('')).join('<br>');
    h.innerHTML=html; return $$('.hero h1 .ch');
  }

  /* ---------------- chapters + progress (scroll listener; robust) ---------------- */
  function chapterTracking(getScroll){
    const links=$$('#chapters a'), bar=$('#progress i');
    const secs=links.map(a=>$(a.getAttribute('href'))).filter(Boolean);
    function update(){
      const h=document.documentElement.scrollHeight-innerHeight;
      const y=getScroll();
      if(bar)bar.style.transform=`scaleX(${h>0?Math.min(1,y/h):0})`;
      let cur=0;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*0.45)cur=i;});
      links.forEach((a,i)=>a.classList.toggle('active',i===cur));
    }
    return update;
  }

  /* ---------------- MAIN ---------------- */
  function main(){
    const hasGSAP=typeof gsap!=='undefined' && typeof ScrollTrigger!=='undefined';
    const hasLenis=typeof Lenis!=='undefined';
    if(!hasGSAP){ revealAll(); runBoot(); basicChapters(); return; }

    gsap.registerPlugin(ScrollTrigger);

    let lenis=null, getScroll=()=>window.scrollY;
    if(hasLenis){
      lenis=new Lenis({lerp:0.1,smoothWheel:true,wheelMultiplier:1});
      lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(t=>lenis.raf(t*1000));
      gsap.ticker.lagSmoothing(0);
      getScroll=()=>lenis.scroll;
      // anchor links via lenis
      $$('#chapters a, .brand, .scrollcue').forEach(a=>{
        const href=a.getAttribute('href'); if(!href||href[0]!=='#')return;
        a.addEventListener('click',e=>{e.preventDefault();const t=$(href);if(t)lenis.scrollTo(t,{offset:0});});
      });
    }

    /* reveal on enter */
    ScrollTrigger.batch('[data-rise]',{start:'top 86%',
      onEnter:b=>gsap.to(b,{opacity:1,y:0,duration:0.9,stagger:0.08,ease:'power3.out',overwrite:true}),
      onEnterBack:b=>gsap.to(b,{opacity:1,y:0,duration:0.6,stagger:0.05,ease:'power3.out',overwrite:true})});
    gsap.set('[data-rise]',{opacity:0,y:42});

    /* per-act webgl "moods" */
    const MOOD={
      index   :{camZ:7,  camX:0,  ringScale:1,   ringTilt:-0.32,ringSpin:1, pSpeed:1,  hue:0,   core:0.85,bloom:0.62},
      about   :{camZ:5.4,camX:-0.5,ringScale:1.08,ringTilt:-0.75,ringSpin:0.7,pSpeed:0.8,hue:0.10,core:0.9, bloom:0.6},
      services:{camZ:6.6,camX:0.6, ringScale:0.82,ringTilt:-0.05,ringSpin:1.4,pSpeed:2.6,hue:0.36,core:0.7, bloom:0.72},
      method  :{camZ:4.6,camX:0,   ringScale:1.12,ringTilt:0.18, ringSpin:1.8,pSpeed:3.2,hue:0.55,core:0.85,bloom:0.85},
      balance :{camZ:5.0,camX:0,   ringScale:0.32,ringTilt:0,    ringSpin:0.4,pSpeed:0.4,hue:0.62,core:1.7, bloom:1.15},
      contact :{camZ:9,  camX:0,   ringScale:1.0, ringTilt:-0.3, ringSpin:0.6,pSpeed:0.7,hue:0.80,core:0.7, bloom:0.5}
    };
    Object.keys(MOOD).forEach(id=>{
      const el=$('#'+id); if(!el)return;
      const to=()=>gsap.to(S,{...MOOD[id],duration:1.4,ease:'power2.inOut',overwrite:'auto'});
      ScrollTrigger.create({trigger:el,start:'top 60%',end:'bottom 40%',onEnter:to,onEnterBack:to});
    });

    /* ACT 2 — horizontal services */
    const track=$('#hTrack'), svcSec=$('#services');
    if(track&&svcSec){
      const dist=()=>Math.max(0,track.scrollWidth-innerWidth);
      gsap.to(track,{x:()=>-dist(),ease:'none',
        scrollTrigger:{trigger:svcSec,start:'top top',end:()=>'+='+dist(),pin:true,scrub:1,
          anticipatePin:1,invalidateOnRefresh:true}});
    }

    /* ACT 4 — balance: collapse equation into "= 0" */
    const bal=$('#balance');
    if(bal){
      const tl=gsap.timeline({scrollTrigger:{trigger:bal,start:'top top',end:'+=130%',pin:true,scrub:1,anticipatePin:1}});
      tl.to('#eqL',{xPercent:120,opacity:0,ease:'power2.in'},0)
        .to('#eqR',{xPercent:-120,opacity:0,ease:'power2.in'},0)
        .to('.big-equation',{opacity:0,duration:0.3},0.35)
        .fromTo('#eqZero',{opacity:0,scale:0.5},{opacity:1,scale:1,ease:'back.out(1.7)',duration:0.6},0.4)
        .to('#eqZero',{scale:1.04,duration:0.5},'>');
    }

    /* band / interlude background reveal */
    $$('.act.band[data-bg]').forEach(sec=>{
      ScrollTrigger.create({trigger:sec,start:'top 70%',onEnter:()=>sec.classList.add('bg-in'),
        onEnterBack:()=>sec.classList.add('bg-in')});
    });
    $$('.interlude[data-img]').forEach(sec=>{
      ScrollTrigger.create({trigger:sec,start:'top 80%',onEnter:()=>sec.classList.add('bg-in'),
        onEnterBack:()=>sec.classList.add('bg-in')});
      // parallax drift on the bg
      const bg=sec.querySelector('.il-bg');
      if(bg)gsap.to(bg,{yPercent:14,ease:'none',scrollTrigger:{trigger:sec,start:'top bottom',end:'bottom top',scrub:true}});
    });

    /* chapters + progress */
    const update=chapterTracking(getScroll);
    ScrollTrigger.create({start:0,end:'max',onUpdate:update});
    update();

    /* preloader → hero intro */
    runBoot(()=>{
      document.body.classList.add('revealed');
      const chs=splitHero();
      const tl=gsap.timeline();
      if(chs.length) tl.from(chs,{yPercent:120,opacity:0,stagger:0.04,duration:0.9,ease:'power4.out'});
      tl.from('.hero .tagline,.hero .tagline2',{opacity:0,y:20,stagger:0.12,duration:0.7},'-=0.4')
        .from('.hero .ledger,.hero .balance-readout,.hero .scrollcue',{opacity:0,duration:0.8,stagger:0.06},'-=0.5');
      ScrollTrigger.refresh();
    });

    addEventListener('load',()=>ScrollTrigger.refresh());
    setTimeout(()=>ScrollTrigger.refresh(),1500);
  }

  /* basic fallback chapter tracking (no gsap) */
  function basicChapters(){
    const update=chapterTracking(()=>window.scrollY);
    addEventListener('scroll',update,{passive:true});update();
  }

  try{ main(); }
  catch(err){ console.error('scroll init failed',err); revealAll(); runBoot(); }
})();
