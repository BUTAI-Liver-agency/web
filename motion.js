// Progressive enhancement: content and CTAs never depend on animation completion.
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)');
  const toggle = document.getElementById('motion-toggle');
  let disabled = reduced.matches;
  let observer, tracking, frame = 0;
  const running = new Set(), visiblePhotos = new Set();
  const photos = [...document.querySelectorAll('.prep-photo-intro .story-photo, .conversation-intro .story-photo')];
  const items = [
    ...[...document.querySelectorAll('.life-photo-card figure, .join-photo, .message-photo')].map((el,i) => ({el,type:'photo',i})),
    ...[...document.querySelectorAll('.word-line, #concept h2, .chapter-head h2, #line-title, #join-title')].map((el,i) => ({el,type:'words',i})),
    ...[...document.querySelectorAll('.flow-card')].map((el,i) => ({el,type:'step',i})),
    ...[...document.querySelectorAll('.hero-art, .special-entry')].map(el => ({el,type:'curtain',i:0}))
  ];
  const byElement = new Map(items.map(x => [x.el,x]));
  function animate(el, keyframes, duration, delay = 0) {
    if (!el.animate || disabled) return;
    const a = el.animate(keyframes,{duration,delay,easing:'cubic-bezier(.2,.8,.2,1)',fill:'none'});
    running.add(a);
    a.onfinish = a.oncancel = () => running.delete(a);
  }
  function enter({el,type,i}) {
    if (disabled) return;
    const distance = small.matches ? 14 : 30;
    if (type === 'photo') {
      animate(el,[{opacity:.35,transform:`translateY(${distance}px) rotate(${i%2 ? 2 : -2}deg) scale(.97)`},{opacity:1,transform:'translateY(-3px) rotate(0deg) scale(1)',offset:.8},{opacity:1,transform:'none'}],680,i%2*65);
    } else if (type === 'words') {
      animate(el,[{opacity:.3,transform:'translateY(12px)'},{opacity:1,transform:'none'}],650,el.classList.contains('word-line') ? i*100 : 0);
    } else if (type === 'step') {
      el.classList.add('step-reached');
      animate(el.querySelector('.num'),[{transform:'scale(.9)',opacity:.5},{transform:'scale(1.06)',opacity:1,offset:.75},{transform:'scale(1)',opacity:1}],500);
    } else {
      el.classList.add('curtain-open');
    }
  }
  function render() {
    frame = 0;
    if(disabled || document.hidden) return;
    visiblePhotos.forEach(el => {
      const r = el.getBoundingClientRect();
      const p = Math.max(0,Math.min(1,(innerHeight-r.top)/(innerHeight+r.height)));
      const image = el.querySelector('img');
      image.style.transform = `scale(${1.015+p*(small.matches?.025:.055)}) translateY(${(p-.5)*(small.matches?5:12)}px)`;
    });
  }
  function queue() { if(!disabled && visiblePhotos.size && !frame && !document.hidden) frame=requestAnimationFrame(render); }
  function setup() {
    observer?.disconnect(); tracking?.disconnect();
    running.forEach(a=>a.cancel()); running.clear();
    cancelAnimationFrame(frame); frame=0; visiblePhotos.clear();
    document.documentElement.classList.toggle('scroll-story',!disabled);
    document.querySelectorAll('.curtain-open,.step-reached').forEach(el=>el.classList.remove('curtain-open','step-reached'));
    photos.forEach(el=>{el.classList.add('photo-depth');el.querySelector('img').style.transform='';});
    toggle.textContent=disabled?'動きをつける':'動きを止める';
    toggle.setAttribute('aria-pressed',String(disabled));
    if(disabled || !('IntersectionObserver' in window)) return;
    observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){enter(byElement.get(entry.target));observer.unobserve(entry.target);}
    }),{threshold:.12});
    items.forEach(({el})=>observer.observe(el));
    tracking=new IntersectionObserver(entries=>{
      entries.forEach(entry=>entry.isIntersecting?visiblePhotos.add(entry.target):visiblePhotos.delete(entry.target));queue();
    });
    photos.forEach(el=>tracking.observe(el));
  }
  toggle.hidden=false;
  toggle.addEventListener('click',()=>{disabled=!disabled;setup();});
  reduced.addEventListener('change',e=>{disabled=e.matches;setup();});
  small.addEventListener('change',queue);
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;running.forEach(a=>a.finish());}else queue();
  });
  setup();
})();
