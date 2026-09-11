// Original BUTAI score: a 8-bar ambient composition, synthesized locally.
// No third-party recording, analytics, or autoplay audio.
(() => {
  'use strict';
  const welcome = document.querySelector('#welcome');
  const main = document.querySelector('main');
  const soundButton = document.querySelector('#sound');
  const motionButton = document.querySelector('#motion');
  const status = document.querySelector('#audio-status');
  const chapters = [...document.querySelectorAll('.chapter')];
  const navLinks = [...document.querySelectorAll('.chapter-nav a')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let quiet = reduced.matches, frame = 0, started = false;
  let context, master, delay, feedback, timer, beat = 0, nextTime = 0, playing = false;
  const midi = n => 440 * 2 ** ((n - 69) / 12);
  function tone(note, time, duration, volume, shape = 'sine') {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = shape;
    oscillator.frequency.value = midi(note);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .035);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(master); envelope.connect(delay);
    oscillator.start(time); oscillator.stop(time + duration + .05);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function schedule() {
    if (!playing || context.state !== 'running') return;
    const chords = [[57,60,64,71],[53,57,60,64],[48,55,59,64],[55,59,62,69]];
    const melody = [0,2,1,3,2,1,3,2,0,1,2,3,1,2,3,1];
    while (nextTime < context.currentTime + .18) {
      const chord = chords[Math.floor(beat / 16) % 4];
      tone(chord[melody[beat % 16]] + 12, nextTime, 1.8, .08, 'sine');
      if (beat % 8 === 0) {
        chord.forEach(n => tone(n, nextTime, 4, .025, 'triangle'));
        tone(chord[0] - 12, nextTime, 2.5, .12);
      }
      beat++; nextTime += 60 / 88 / 2;
    }
  }
  function audioLabel() {
    soundButton.textContent = playing ? '音楽 ON' : '音楽 OFF';
    soundButton.setAttribute('aria-pressed', String(playing));
  }
  async function stopMusic() {
    playing = false; clearInterval(timer); audioLabel();
    if (context && context.state === 'running') await context.suspend();
  }
  async function startMusic() {
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Audio unavailable');
        context = new Audio();
        master = context.createGain(); master.gain.value = .22;
        const limiter = context.createDynamicsCompressor();
        master.connect(limiter); limiter.connect(context.destination);
        delay = context.createDelay(2); delay.delayTime.value = 60 / 88 * .75;
        feedback = context.createGain(); feedback.gain.value = .22;
        delay.connect(feedback); feedback.connect(delay); feedback.connect(master);
      }
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio blocked');
      playing = true; nextTime = context.currentTime + .05;
      clearInterval(timer); schedule(); timer = setInterval(schedule, 75); audioLabel();
      status.textContent = '音楽を再生しています。';
    } catch { playing = false; audioLabel(); status.textContent = 'この環境では音楽を再生できません。音なしでお楽しみください。'; }
  }
  async function enter(withSound) {
    if (started) return;
    started = true;
    welcome.hidden = true; document.body.classList.remove('entering');
    main.inert = false;
    document.querySelector('.experience-controls').hidden = false;
    document.querySelector('#replay').hidden = false;
    window.scrollTo({top:0, behavior:'instant'}); main.focus({preventScroll:true});
    requestTick();
    if (withSound) await startMusic();
  }
  function render() {
    frame = 0;
    for (const chapter of chapters) {
      const rect = chapter.getBoundingClientRect();
      const progress = quiet ? 0 : Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - innerHeight)));
      chapter.style.setProperty('--p', progress.toFixed(4));
    }
    const sections = [...chapters, document.querySelector('.finale')];
    let current = 0;
    sections.forEach((s,i) => { if (s.getBoundingClientRect().top < innerHeight * .55) current = i; });
    navLinks.forEach((a,i) => i === current ? a.setAttribute('aria-current','step') : a.removeAttribute('aria-current'));
  }
  function requestTick() { if (!frame) frame = requestAnimationFrame(render); }
  function setMotion(value) {
    quiet = value; document.body.classList.toggle('quiet', quiet);
    motionButton.textContent = quiet ? '動きをつける' : '動きを止める';
    motionButton.setAttribute('aria-pressed', String(quiet)); requestTick();
  }
  document.querySelector('#start-sound').addEventListener('click', () => enter(true));
  document.querySelector('#start-silent').addEventListener('click', () => enter(false));
  soundButton.addEventListener('click', async () => {
    soundButton.disabled = true;
    try { if (playing) await stopMusic(); else await startMusic(); }
    finally { soundButton.disabled = false; }
  });
  motionButton.addEventListener('click', () => setMotion(!quiet));
  reduced.addEventListener('change', e => setMotion(e.matches));
  addEventListener('scroll', requestTick, {passive:true});
  addEventListener('resize', requestTick);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
  addEventListener('pagehide', () => stopMusic());
  document.querySelector('#replay').addEventListener('click', () => {
    stopMusic(); beat = 0; started = false;
    welcome.hidden = false; main.inert = true;
    document.body.classList.add('entering');
    document.querySelector('.experience-controls').hidden = true;
    document.querySelector('#start-sound').focus();
  });
  setMotion(quiet);
  // Progressive enhancement: all four chapters remain readable without JS.
  welcome.hidden = false; main.inert = true; document.body.classList.add('entering');
})();
