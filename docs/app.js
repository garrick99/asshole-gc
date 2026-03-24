'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const THRESHOLD        = 3;     // consecutive bad days to flag
const DAY_THRESHOLD    = 0.55;  // BSA score to count as a bad day
const RESET_THRESHOLD  = 0.30;  // BSA score required to reset the counter
const CONFIDENCE_MIN   = 0.70;  // minimum confidence to flag

const DIMENSIONS = [
  {
    id: 'condescension',
    weight: 0.90,
    question: 'Do they correct or talk down to you when you didn\'t ask for it?',
    hint: '"Well, actually…" energy. Unsolicited expertise.'
  },
  {
    id: 'bad_faith',
    weight: 0.90,
    question: 'Do they misrepresent your position or move the goalposts in disagreements?',
    hint: 'Strawmanning, deliberate misquoting, or the argument is never resolvable.'
  },
  {
    id: 'weaponized_incompetence',
    weight: 0.85,
    question: 'Do they become mysteriously incapable when tasks would cost them something?',
    hint: 'Strategic helplessness to avoid responsibility.'
  },
  {
    id: 'credit_theft',
    weight: 0.85,
    question: 'Do they claim credit for your work or omit your contribution?',
    hint: 'In meetings, presentations, to management, or in writing.'
  },
  {
    id: 'chronic_negativity',
    weight: 0.70,
    question: 'Are they consistently negative, cynical, or complaint-heavy without constructive follow-through?',
    hint: 'Griping is fine. Griping with no intention to improve anything is a pattern.'
  },
  {
    id: 'selective_empathy',
    weight: 0.75,
    question: 'Are they kind to people with power over them but dismissive to those without?',
    hint: 'Two-faced warmth. Watch how they treat waitstaff, juniors, or strangers.'
  },
  {
    id: 'commitment_failure',
    weight: 0.65,
    question: 'Do they regularly fail to follow through on what they said they\'d do?',
    hint: 'No-shows, missed deadlines, broken promises — without acknowledgment.'
  },
  {
    id: 'boundary_violation',
    weight: 0.88,
    question: 'Do they ignore limits you\'ve clearly stated?',
    hint: 'Re-asking after a clear no. Treating "no" as a negotiating position.'
  },
  {
    id: 'darvo',
    weight: 0.92,
    question: 'When you raise an issue with them, do they flip it and make themselves the victim?',
    hint: 'Deny, Attack, Reverse Victim and Offender. You end up apologizing.'
  },
  {
    id: 'energy_drain',
    weight: 0.60,
    question: 'Do you feel drained, tense, or worse after interactions with them?',
    hint: 'Your body knows. Trust it.'
  },
  {
    id: 'escalation',
    weight: 0.72,
    question: 'Do minor disagreements with them escalate into major conflicts?',
    hint: 'Disproportionate responses. Everything becomes a big deal.'
  },
  {
    id: 'rules_asymmetry',
    weight: 0.68,
    question: 'Do they hold you to standards they don\'t apply to themselves?',
    hint: 'Punctuality, tone, effort, accountability — one rule for them, another for you.'
  },
  {
    id: 'apology_quality',
    weight: 0.65,
    question: 'When they apologize, does it feel hollow or conditional?',
    hint: '"Sorry you feel that way." "I\'m sorry, but…" — not an apology.'
  },
  {
    id: 'pattern_persistence',
    weight: 0.95,
    question: 'Have you addressed this behavior before, and it hasn\'t changed?',
    hint: 'The most predictive signal. History repeats.'
  },
];

const CONTEXT_FACTORS = {
  normal:      1.00,
  deadline:    0.70,
  personal:    0.40,
  bereavement: 0.10,
};

const WEIGHT_SUM = DIMENSIONS.reduce((s, d) => s + d.weight, 0);

const LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];

// ─── Storage ──────────────────────────────────────────────────────────────────

const Store = {
  load() {
    try {
      return JSON.parse(localStorage.getItem('agc_subjects') || '[]');
    } catch { return []; }
  },
  save(subjects) {
    localStorage.setItem('agc_subjects', JSON.stringify(subjects));
  },
};

// ─── Algorithm ────────────────────────────────────────────────────────────────

function contextFactor(eval_) {
  if (eval_.ctx_bereavement) return CONTEXT_FACTORS.bereavement;
  if (eval_.ctx_personal)    return CONTEXT_FACTORS.personal;
  if (eval_.ctx_deadline)    return CONTEXT_FACTORS.deadline;
  return CONTEXT_FACTORS.normal;
}

function bsaScore(eval_) {
  const cf = contextFactor(eval_);
  let raw = 0;
  for (const dim of DIMENSIONS) {
    // scale 0-4 → 0-1
    const dimScore = Math.min((eval_.scores[dim.id] || 0) / 4, 1.0);
    raw += dimScore * dim.weight * cf;
  }
  return raw / WEIGHT_SUM;
}

function isBadDay(score) { return score >= DAY_THRESHOLD; }
function isGoodDay(score) { return score <= RESET_THRESHOLD; }

function consecutiveBadDays(evaluations) {
  let streak = 0;
  // Walk backwards through evaluations
  for (let i = evaluations.length - 1; i >= 0; i--) {
    if (isBadDay(evaluations[i].bsa_score)) {
      streak++;
    } else if (isGoodDay(evaluations[i].bsa_score)) {
      break; // genuine good day resets
    }
    // Between thresholds: doesn't reset but doesn't extend the bad streak
  }
  return streak;
}

function confidence(subject) {
  // Weighted by recency and pattern persistence
  const evals = subject.evaluations;
  if (!evals.length) return 0;

  const recent = evals.slice(-7); // last 7 days
  const avgScore = recent.reduce((s, e) => s + e.bsa_score, 0) / recent.length;

  // Pattern persistence bonus: longer history of bad days increases confidence
  const totalBad = evals.filter(e => isBadDay(e.bsa_score)).length;
  const persistence = Math.min(totalBad / Math.max(evals.length, 1), 1.0);

  // Confidence = blend of recent avg score and persistence
  return Math.min(avgScore * 0.6 + persistence * 0.4, 1.0);
}

function verdict(subject) {
  const streak = consecutiveBadDays(subject.evaluations);
  const conf   = confidence(subject);

  if (streak < THRESHOLD)         return { status: 'monitor',  label: 'MONITOR',  color: 'dim' };
  if (conf < CONFIDENCE_MIN)      return { status: 'review',   label: 'REVIEW',   color: 'yellow' };
  if (conf >= 0.90)               return { status: 'flag-high',label: 'FLAG — HIGH', color: 'red' };
  return                                 { status: 'flag',      label: 'FLAG',     color: 'yellow' };
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App = (() => {

  let subjects = Store.load();
  let activeSubjectId = null;

  function save() { Store.save(subjects); }

  function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + id).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ── Dashboard ──────────────────────────────────────────────

  function showDashboard() {
    renderDashboard();
    showView('dashboard');
  }

  function renderDashboard() {
    const list = document.getElementById('subject-list');
    const empty = document.getElementById('subject-list-empty');
    const resultsPanel = document.getElementById('results-panel');

    if (!subjects.length) {
      empty.style.display = 'flex';
      list.style.display  = 'none';
      resultsPanel.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    list.style.display  = 'grid';

    list.innerHTML = subjects.map(s => {
      const v      = verdict(s);
      const streak = consecutiveBadDays(s.evaluations);
      const conf   = (confidence(s) * 100).toFixed(0);
      const nDays  = s.evaluations.length;

      return `
        <div class="subject-card" onclick="App.showDetail('${s.id}')">
          <div class="subject-card-top">
            <div class="subject-name">${esc(s.name)}</div>
            <div class="verdict-badge verdict-${v.status}">${v.label}</div>
          </div>
          <div class="subject-stats">
            <div class="subject-stat">
              <span class="sstat-val">${streak}</span>
              <span class="sstat-lbl">consecutive bad days</span>
            </div>
            <div class="subject-stat">
              <span class="sstat-val">${conf}%</span>
              <span class="sstat-lbl">confidence</span>
            </div>
            <div class="subject-stat">
              <span class="sstat-val">${nDays}</span>
              <span class="sstat-lbl">days logged</span>
            </div>
          </div>
          <div class="subject-actions" onclick="event.stopPropagation()">
            <button class="action-btn" onclick="App.startEvaluate('${s.id}')">+ Log Day</button>
            <button class="action-btn danger" onclick="App.removeSubject('${s.id}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    // Render results terminal
    renderResults();
    resultsPanel.style.display = 'block';
  }

  function renderResults() {
    const terminal = document.getElementById('results-terminal');
    const runBtn   = document.getElementById('run-btn');

    const flagged = subjects.filter(s => {
      const v = verdict(s);
      return v.status === 'flag' || v.status === 'flag-high';
    });

    let html = '';
    html += line('dim', `Scanning ${subjects.length} subject(s)... done.`);
    html += line('', '');

    if (!subjects.length) {
      html += line('dim', '  No subjects tracked.');
    } else if (!flagged.length) {
      html += line('green', `  No subjects above threshold. Environment clean.`);
    } else {
      html += line('out', `  Candidates flagged: <span class="yellow">${flagged.length}</span>`);
      html += line('', '');
      for (const s of subjects) {
        const v      = verdict(s);
        const streak = consecutiveBadDays(s.evaluations);
        const conf   = (confidence(s) * 100).toFixed(0);
        const dot    = v.color === 'red' ? 'red' : v.color === 'yellow' ? 'yellow' : 'dim';
        html += line('out',
          `  <span class="${dot}">●</span> ${esc(s.name)} ` +
          `<span class="dim">— ${streak} consecutive bad days, confidence: ${conf}%</span>`
        );
      }
    }

    html += line('', '');
    if (flagged.length) {
      html += line('dim', '  Run asshole-gc --run to execute. Use --grace-period to warn first.');
    }

    terminal.innerHTML = html;
    runBtn.disabled = flagged.length === 0;
    runBtn.style.opacity = flagged.length === 0 ? '0.4' : '1';
  }

  // ── Add subject ────────────────────────────────────────────

  function showAddSubject() {
    document.getElementById('subject-name-input').value = '';
    showView('add-subject');
    setTimeout(() => document.getElementById('subject-name-input').focus(), 100);
  }

  function addSubject() {
    const name = document.getElementById('subject-name-input').value.trim();
    if (!name) { flash('subject-name-input', 'Enter a name first'); return; }

    const subject = { id: uuid(), name, evaluations: [], created: Date.now() };
    subjects.push(subject);
    save();
    activeSubjectId = subject.id;
    buildEvalForm(subject);
    showView('evaluate');
  }

  // ── Evaluate ───────────────────────────────────────────────

  function startEvaluate(id) {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    activeSubjectId = id;
    buildEvalForm(subject);
    showView('evaluate');
  }

  function buildEvalForm(subject) {
    document.getElementById('eval-subject-name').textContent = subject.name;
    document.getElementById('eval-day-num').textContent = subject.evaluations.length + 1;
    document.getElementById('ctx-deadline').checked    = false;
    document.getElementById('ctx-personal').checked    = false;
    document.getElementById('ctx-bereavement').checked = false;

    const form = document.getElementById('eval-form');
    form.innerHTML = DIMENSIONS.map((dim, i) => `
      <div class="question-block" id="qblock-${dim.id}">
        <div class="question-num">${i + 1} / ${DIMENSIONS.length}</div>
        <div class="question-text">${dim.question}</div>
        <div class="question-hint">${dim.hint}</div>
        <div class="likert">
          ${LABELS.map((lbl, val) => `
            <label class="likert-option">
              <input type="radio" name="${dim.id}" value="${val}" ${val === 0 ? 'checked' : ''}>
              <span class="likert-dot"></span>
              <span class="likert-lbl">${lbl}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function submitEvaluation() {
    const subject = subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;

    const scores = {};
    for (const dim of DIMENSIONS) {
      const el = document.querySelector(`input[name="${dim.id}"]:checked`);
      scores[dim.id] = el ? parseInt(el.value) : 0;
    }

    const eval_ = {
      date:            new Date().toISOString().slice(0, 10),
      scores,
      ctx_deadline:    document.getElementById('ctx-deadline').checked,
      ctx_personal:    document.getElementById('ctx-personal').checked,
      ctx_bereavement: document.getElementById('ctx-bereavement').checked,
      bsa_score:       0,
    };
    eval_.bsa_score = bsaScore(eval_);

    subject.evaluations.push(eval_);
    save();
    showDashboard();
  }

  // ── Detail view ────────────────────────────────────────────

  function showDetail(id) {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    const v      = verdict(subject);
    const streak = consecutiveBadDays(subject.evaluations);
    const conf   = (confidence(subject) * 100).toFixed(0);

    document.getElementById('detail-name').textContent = subject.name;
    const badge = document.getElementById('detail-badge');
    badge.textContent = v.label;
    badge.className = `verdict-badge verdict-${v.status}`;

    // Top dimensions
    const topDims = subject.evaluations.length
      ? DIMENSIONS.map(dim => {
          const avg = subject.evaluations.reduce((s, e) => s + (e.scores[dim.id] || 0), 0)
                    / subject.evaluations.length;
          return { dim, avg };
        }).sort((a, b) => (b.avg * b.dim.weight) - (a.avg * a.dim.weight)).slice(0, 5)
      : [];

    // History chart (simple bar)
    const historyRows = subject.evaluations.slice(-14).map(e => {
      const pct = Math.round(e.bsa_score * 100);
      const cls = isBadDay(e.bsa_score) ? 'bar-bad' : isGoodDay(e.bsa_score) ? 'bar-good' : 'bar-mid';
      return `
        <div class="history-row">
          <span class="history-date">${e.date}</span>
          <div class="history-bar-wrap">
            <div class="history-bar ${cls}" style="width:${pct}%"></div>
          </div>
          <span class="history-score">${pct}%</span>
        </div>
      `;
    }).join('');

    document.getElementById('detail-body').innerHTML = `
      <div class="detail-stats">
        <div class="detail-stat"><span class="dstat-val">${streak}</span><span class="dstat-lbl">consecutive bad days</span></div>
        <div class="detail-stat"><span class="dstat-val">${conf}%</span><span class="dstat-lbl">confidence</span></div>
        <div class="detail-stat"><span class="dstat-val">${subject.evaluations.length}</span><span class="dstat-lbl">days logged</span></div>
      </div>

      ${topDims.length ? `
        <h3 class="detail-section-title">Top Signals</h3>
        <div class="top-signals">
          ${topDims.map(({ dim, avg }) => `
            <div class="signal-row">
              <span class="signal-name">${dim.question.split('?')[0]}?</span>
              <div class="signal-bar-wrap">
                <div class="signal-bar" style="width:${Math.round((avg/4)*100)}%"></div>
              </div>
              <span class="signal-pct">${Math.round((avg/4)*100)}%</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${historyRows ? `
        <h3 class="detail-section-title">BSA History (last 14 days)</h3>
        <div class="history-chart">${historyRows}</div>
        <div class="history-legend">
          <span class="leg-item"><span class="leg-dot bar-good"></span> Good day (&le;30%)</span>
          <span class="leg-item"><span class="leg-dot bar-mid"></span> Neutral</span>
          <span class="leg-item"><span class="leg-dot bar-bad"></span> Bad day (&ge;55%)</span>
        </div>
      ` : ''}

      <div class="detail-actions">
        <button class="btn-primary" onclick="App.startEvaluate('${subject.id}')">+ Log Another Day</button>
        <button class="btn-secondary" onclick="App.clearSubject('${subject.id}')">Clear History</button>
      </div>
    `;

    showView('detail');
  }

  // ── Run modal ──────────────────────────────────────────────

  function executeRun() {
    const flagged = subjects.filter(s => {
      const v = verdict(s);
      return v.status === 'flag' || v.status === 'flag-high';
    });
    if (!flagged.length) return;

    const modal  = document.getElementById('run-modal');
    const output = document.getElementById('modal-output');
    modal.style.display = 'flex';

    let html = '';
    const lines = [
      ['out',   'Initializing collection...'],
      ['out',   ''],
      ...flagged.map(s => {
        const v    = verdict(s);
        const conf = (confidence(s) * 100).toFixed(0);
        return ['out',
          `  Sending grace period notice → <span class="yellow">${esc(s.name)}</span> ` +
          `<span class="dim">(confidence: ${conf}%)</span>`
        ];
      }),
      ['', ''],
      ['green', '✓ Grace period notices sent.'],
      ['green', '✓ Collection scheduled.'],
      ['dim',   ''],
      ['dim',   '  Subjects will be re-evaluated in 7 days.'],
      ['dim',   '  Genuine improvement clears the flag.'],
      ['dim',   '  No change → collection executes.'],
      ['', ''],
      ['out',   `  ${flagged.length} subject(s) in grace period.`],
    ];

    // Animate lines
    output.innerHTML = '';
    let i = 0;
    const next = () => {
      if (i >= lines.length) return;
      const [cls, text] = lines[i++];
      output.innerHTML += `<div class="term-line ${cls ? 'out' : ''}">${
        cls === 'green' ? `<span class="green">${text}</span>` :
        cls === 'dim'   ? `<span class="dim">${text}</span>` :
        text
      }</div>`;
      output.scrollTop = output.scrollHeight;
      setTimeout(next, 80);
    };
    next();
  }

  function closeModal() {
    document.getElementById('run-modal').style.display = 'none';
  }

  // ── Utilities ──────────────────────────────────────────────

  function removeSubject(id) {
    if (!confirm('Remove this subject and all their history?')) return;
    subjects = subjects.filter(s => s.id !== id);
    save();
    renderDashboard();
  }

  function clearSubject(id) {
    if (!confirm('Clear all evaluation history for this subject?')) return;
    const s = subjects.find(s => s.id === id);
    if (s) { s.evaluations = []; save(); showDetail(id); }
  }

  function line(cls, text) {
    return `<div class="term-line${cls ? ' ' + cls : ''}">${text}</div>`;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function flash(inputId, msg) {
    const el = document.getElementById(inputId);
    el.style.borderColor = 'var(--red)';
    el.placeholder = msg;
    setTimeout(() => {
      el.style.borderColor = '';
      el.placeholder = 'e.g. Dave (Engineering)';
    }, 1500);
  }

  // ── Init ───────────────────────────────────────────────────

  showDashboard();

  return {
    showDashboard, showAddSubject, addSubject,
    startEvaluate, submitEvaluation,
    showDetail, executeRun, closeModal,
    removeSubject, clearSubject,
  };

})();
