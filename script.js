'use strict';

// Navigation never locks page scrolling or disables navigation keys.
const menuButton = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
function closeMenu(restoreFocus = false) {
  mobileNav.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.textContent = 'メニュー';
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => {
  const open = mobileNav.hidden;
  mobileNav.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? '閉じる' : 'メニュー';
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) closeMenu(true);
});
document.addEventListener('click', event => {
  if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

// Five answers form a consultation note; no scoring, income claims or storage.
const questions = [
  { label: '活動の希望', title: '配信を、どんなふうに始めたいですか？', choices: ['副業として始めたい', '将来は本業にしたい', 'まずは自己表現を楽しみたい', 'まだ決めていないので相談したい'] },
  { label: '生活スタイル', title: '今の生活スタイルに近いのは？', choices: ['仕事をしている', '育児・家事が中心', '学業が中心', 'その他・相談して決めたい'] },
  { label: '配信テーマ', title: '興味のある配信テーマは？', choices: ['トーク・日常のこと', '美容・ファッション', '歌・ダンス・パフォーマンス', '自分に合うテーマを相談したい'] },
  { label: '顔出しの希望', title: '顔出しについての希望は？', choices: ['顔出しで活動したい', '顔出しは避けたい', 'まだ決めていないので相談したい'] },
  { label: '最初に相談したいこと', title: 'いちばん気になっていることは？', choices: ['配信で何を話せばよいか', '報酬の仕組みや活動条件', '配信時間と生活の両立', '身バレ・リスナー対応'] }
];
const answers = [];
let currentQuestion = 0;
const quiz = document.getElementById('quiz');
const quizStep = document.getElementById('quiz-step');
const quizResult = document.getElementById('quiz-result');
const quizTitle = document.getElementById('quiz-title');
const quizOptions = document.getElementById('quiz-options');
const quizBack = document.getElementById('quiz-back');
const quizStatus = document.getElementById('quiz-status');
function renderQuestion(focus = true) {
  const question = questions[currentQuestion];
  quizStep.hidden = false;
  quizResult.hidden = true;
  document.getElementById('quiz-counter').textContent = `${currentQuestion + 1} / ${questions.length}`;
  quizTitle.textContent = question.title;
  quizOptions.replaceChildren();
  question.choices.forEach((choice, choiceIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.textContent = choice;
    if (answers[currentQuestion] === choiceIndex) button.classList.add('selected');
    button.addEventListener('click', () => {
      answers[currentQuestion] = choiceIndex;
      if (currentQuestion < questions.length - 1) {
        currentQuestion += 1;
        renderQuestion();
      } else renderResult();
    });
    quizOptions.append(button);
  });
  quizBack.disabled = currentQuestion === 0;
  quiz.querySelectorAll('.quiz-progress span').forEach((dot, index) => dot.classList.toggle('complete', index <= currentQuestion));
  if (focus) quizTitle.focus({ preventScroll: true });
}
function resultLines() {
  return questions.map((question, index) => `${question.label}：${question.choices[answers[index]]}`);
}
function renderResult() {
  quizStep.hidden = true;
  quizResult.hidden = false;
  quizStatus.textContent = '';
  const results = document.getElementById('quiz-results');
  results.replaceChildren();
  questions.forEach((question, index) => {
    const row = document.createElement('div');
    const label = document.createElement('dt');
    const answer = document.createElement('dd');
    label.textContent = question.label;
    answer.textContent = question.choices[answers[index]];
    row.append(label, answer);
    results.append(row);
  });
  document.getElementById('result-title').focus({ preventScroll: true });
}
quizBack.addEventListener('click', () => {
  if (currentQuestion > 0) { currentQuestion -= 1; renderQuestion(); }
});
document.getElementById('quiz-reset').addEventListener('click', () => {
  answers.length = 0;
  currentQuestion = 0;
  renderQuestion();
});
document.getElementById('quiz-copy').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText('BUTAIへの相談メモ\n' + resultLines().join('\n'));
    quizStatus.textContent = 'コピーしました。LINEのトークに貼り付けてご相談ください。';
  } catch {
    quizStatus.textContent = 'コピーできませんでした。上の回答を選択してコピーするか、LINEで直接お伝えください。';
  }
});
document.getElementById('quiz-nojs').hidden = true;
quiz.hidden = false;
renderQuestion(false);

// Optional first-message helper. Nothing is transmitted or persisted here.
const topicMessages = {
  beginner: 'はじめまして。配信は未経験です。BUTAIでの活動内容や、初めての配信までの流れを教えてください。',
  balance: 'はじめまして。学校・仕事と配信を両立したいです。必要な配信時間や頻度、ノルマの有無を教えてください。',
  experienced: 'はじめまして。配信経験があり、BUTAIへの所属を検討しています。所属条件やサポート内容について相談したいです。'
};
const lineMessage = document.getElementById('line-message');
const lineStatus = document.getElementById('line-copy-status');
document.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-topic]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  lineMessage.value = topicMessages[button.dataset.topic];
  lineStatus.textContent = '文章は自由に編集できます。コピーして、LINEのトークに貼り付けてください。';
}));
document.getElementById('copy-line').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(lineMessage.value);
    lineStatus.textContent = 'コピーしました。LINEを開き、トークに貼り付けて送信してください。';
  } catch {
    lineMessage.focus(); lineMessage.select();
    lineStatus.textContent = '文章を選択しました。端末のコピー操作でコピーして、LINEに貼り付けてください。';
  }
});
// Integration hook only: emits an anonymous location label, not message text.
// No analytics service is connected; a CTA click is NOT a confirmed LINE add.
document.querySelectorAll('a[data-cta]').forEach(link => link.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('butai:line_click', {detail:{placement:link.dataset.cta}}));
}));

// Lifestyle buttons prepare the relevant question before jumping to the helper.
document.querySelectorAll('[data-life-topic]').forEach(link => link.addEventListener('click', () => {
  const student = link.dataset.lifeTopic === 'student';
  document.querySelectorAll('[data-topic]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === 'balance')));
  lineMessage.value = student
    ? 'はじめまして。学校と配信を両立したいです。授業や試験の予定に合わせて活動できるか、必要な配信時間・頻度を教えてください。'
    : 'はじめまして。仕事と配信を両立したいです。帰宅後や休日に活動できるか、必要な配信時間・頻度を教えてください。';
  lineStatus.textContent = '相談用の文章を用意しました。コピーしてLINEに貼り付けてください。自由に編集できます。';
}));
