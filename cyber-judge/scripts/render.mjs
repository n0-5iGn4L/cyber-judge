// 赛博判官 · 报告渲染器
// 输入：单份报告数据（reports.v0.3.json 中的一项）
// 输出：完整自包含 HTML 字符串；CSS / JS 由调用方传入并内联
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/report-template');

/* ---------- 基础工具 ---------- */
export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escAttr = esc;

export function safeUrl(raw) {
  try {
    const u = new URL(String(raw));
    if ((u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password) return u.href;
  } catch {}
  return null;
}

const SUPPORT = {
  '支持较强': { kind: 'ordered', n: 3 },
  '支持有限': { kind: 'ordered', n: 2 },
  '支持不足': { kind: 'ordered', n: 1 },
  '有明确反证': { kind: 'refuted' },
  '暂无法判断': { kind: 'unknown' },
  '规范判断': { kind: 'normative' },
};

const LEGEND = [
  ['支持较强', '直接材料与主张相符，关键反证不足以推翻。'],
  ['支持有限', '部分材料相符，关键连接仍依赖推断或来源单一。'],
  ['支持不足', '提出了说法，但没有支撑它的关键证据。'],
  ['有明确反证', '可核对材料与主张直接冲突。'],
  ['暂无法判断', '缺少决定性材料，现有解释难以区分。'],
  ['规范判断', '评价原则类主张，不按事实支持度计。'],
];

const KIND_LABEL = { event: '事件争议', 'public-issue': '公共议题' };

/* ---------- 引用记录 ---------- */
class Cites {
  constructor(report) {
    this.report = report;
    this.map = new Map(report.sources.map((s) => [s.id, s]));
    this.n = 0;
    this.bySource = new Map();
  }

  render(ids = [], sectionLabel = '') {
    return ids.map((id) => {
      const src = this.map.get(id);
      if (!src) return '';
      this.n += 1;
      const anchor = `c${this.n}`;
      if (!this.bySource.has(id)) this.bySource.set(id, new Map());
      const refs = this.bySource.get(id);
      if (!refs.has(sectionLabel)) refs.set(sectionLabel, anchor);
      const label = `证据 ${id}：${src.title}（${src.date}）`;
      return `<a class="cite" id="${anchor}" href="#source-${escAttr(id)}" title="${escAttr(label)}" aria-label="${escAttr(label)}">${esc(id)}</a>`;
    }).join('');
  }

  refsFor(id) {
    const refs = this.bySource.get(id);
    if (!refs) return [];
    return [...refs.entries()].map(([label, anchor]) => ({ label, anchor }));
  }
}

/* ---------- 片段 ---------- */
function para(item, cites, sectionLabel, cls = 'body-text') {
  return `<p class="${cls}">${esc(item.text)}${cites.render(item.source_ids, sectionLabel)}</p>`;
}

function claimBlock(claim, cites, sectionLabel) {
  const meta = SUPPORT[claim.support] || { kind: 'ordered', n: 0 };
  let marks = '';
  if (meta.kind === 'ordered') {
    marks = `<span class="bars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= meta.n ? 'on' : ''}"></i>`).join('')}</span>`;
  } else if (meta.kind === 'refuted') {
    marks = '<span class="support-mark cross" aria-hidden="true"></span>';
  } else if (meta.kind === 'unknown') {
    marks = '<span class="support-mark open" aria-hidden="true"></span>';
  } else {
    marks = '<span class="support-mark" aria-hidden="true"></span>';
  }
  const def = LEGEND.find(([k]) => k === claim.support);
  const title = def ? `${claim.support}：${def[1]}` : claim.support;
  return `<div class="duo claim">
  <div class="claim-main">
    <p class="speaker">${esc(claim.speaker)}</p>
    <p class="claim-text">${esc(claim.claim)}${cites.render(claim.source_ids, sectionLabel)}</p>
  </div>
  <div class="claim-note">
    <div class="support" data-support="${escAttr(claim.support)}">
      ${marks}<span class="support-label" title="${escAttr(title)}">${esc(claim.support)}</span>
    </div>
    <p class="support-reason">${esc(claim.reason)}</p>
  </div>
</div>`;
}

function navItems(report, cites) {
  const items = [{ href: '#facts', key: 'facts', n: '00', t: '事实' }];
  report.issues.forEach((it, i) => {
    items.push({
      href: `#issue-${it.id}`, key: `issue-${it.id}`,
      n: String(i + 1).padStart(2, '0'),
      t: it.nav_label || `争论点 ${i + 1}`,
    });
  });
  items.push({ href: '#conclusion', key: 'conclusion', n: String(report.issues.length+1).padStart(2,'0'), t: '结论' });
  items.push({ href: '#sources', key: 'sources', n: String(report.issues.length+2).padStart(2,'0'), t: '证据' });
  return items.map((x) => `<a href="${escAttr(x.href)}" data-nav="${escAttr(x.key)}"><span class="n">${x.n}</span><span class="t">${esc(x.t)}</span></a>`).join('\n      ');
}

function hero(report) {
  const q = report.title_question || report.title;
  const comma = q.indexOf('，');
  const lines = comma > 0 && comma < q.length - 1
    ? [q.slice(0, comma + 1), q.slice(comma + 1)]
    : [q];
  const subjects = report.title_subject || '';
  const idx = report.issues.map((it, i) => `<a href="#issue-${escAttr(it.id)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(it.nav_label || it.question)}</span></a>`).join('\n      ');

  return `<header class="hero">
    <div class="toprail">
      <div class="left">${esc(KIND_LABEL[report.kind] || '报告')} · 公开材料分析</div>
      <div class="right">材料截至 ${esc(report.as_of)}<span class="dot">/</span>${report.issues.length} 项争论点<span class="dot">/</span>${report.sources.length} 件证据</div>
    </div>
    <div class="hero-grid">
      <div class="case-head">
        <h1 class="case-title">
          ${subjects ? `<span class="case-subject">${esc(subjects)}</span>` : ''}
          ${lines.map((l) => `<span class="q-line">${esc(l)}</span>`).join('\n          ')}
        </h1>
        <div class="hero-verdict">
          <span class="label">核心判断</span>
          <p>${esc(report.headline)}</p>
        </div>
        <p class="hero-summary">${esc(report.summary)}</p>
      </div>
      <aside class="hero-aside" aria-hidden="true">
        <div class="seal hero-stamp"><span>赛</span><span>博</span><span>判</span><span>官</span></div>
      </aside>
    </div>
    <nav class="issue-index" aria-label="争论点索引">
      ${idx}
    </nav>
  </header>`;
}

function facts(report, cites) {
  const bg = report.background.map((p) => para(p, cites, '起因')).join('\n      ');
  const tl = report.timeline.map((t) => `<li>
        <div class="t-date">${esc(t.date)}</div>
        <div class="t-body">
          <p class="t-title">${esc(t.title)}</p>
          <p class="t-text">${esc(t.text)}${cites.render(t.source_ids, '时间线')}</p>
        </div>
      </li>`).join('\n      ');
  const actors = report.actors.map((a) => `<li>
        <span class="actor-name">${esc(a.name)}</span>
        <span class="actor-role">${esc(a.role)}</span>
      </li>`).join('\n      ');

  return `<section class="sec" id="facts" data-nav="facts" aria-labelledby="facts-h">
    <div class="eyebrow">事实</div>
    <h2 class="sec-title" id="facts-h">起因与经过</h2>
    <div class="prose">
      ${bg}
    </div>
    ${report.timeline.length ? `<h3 class="sub-label">时间线</h3>
    <ol class="timeline">
      ${tl}
    </ol>` : ''}
    ${report.actors.length ? `<h3 class="sub-label">各方角色</h3>
    <ul class="actors">
      ${actors}
    </ul>` : ''}
  </section>`;
}

function issue(report, it, i, cites) {
  const no = String(i + 1).padStart(2, '0');
  const secLabel = `争论点 ${no}`;
  const claims = it.claims.map((c) => claimBlock(c, cites, secLabel)).join('\n      ');
  const reasoning = it.reasoning.map((p) => `<p>${esc(p.text)}${cites.render(p.source_ids, secLabel)}</p>`).join('\n        ');

  return `<section class="issue" id="issue-${escAttr(it.id)}" data-nav="issue-${escAttr(it.id)}" aria-labelledby="q-${escAttr(it.id)}">
    <div class="issue-bar">
      <span class="issue-kicker">争论点</span>
      <span class="issue-num">${no}</span>
      <span class="line" aria-hidden="true"></span>
    </div>
    <h2 class="issue-q" id="q-${escAttr(it.id)}">${esc(it.question)}</h2>
    <div class="verdict">
      <span class="label">裁定</span>
      <p>${esc(it.verdict)}</p>
    </div>
    <div class="claims">
      <h3 class="sub-label">各方论点与支持度</h3>
      ${claims}
    </div>
    <div class="reasoning">
      <h3 class="sub-label">为什么这样判断</h3>
      <div class="reasoning-body">
        ${reasoning}
      </div>
    </div>
    ${it.roast ? `<blockquote class="roast">
      <span class="label">判官短评</span>
      <p>${esc(it.roast)}</p>
    </blockquote>` : ''}
  </section>`;
}

function conclusion(report, cites) {
  const body = report.conclusion.map((p) => `<p>${esc(p.text)}${cites.render(p.source_ids, '结论')}</p>`).join('\n        ');
  const qs = report.open_questions.length
    ? `<div class="questions">
      <h3 class="sub-label">最值得继续追问</h3>
      <ol>
        ${report.open_questions.map((q, i) => `<li><span class="qn">${String(i + 1).padStart(2, '0')}</span><span>${esc(q)}</span></li>`).join('\n        ')}
      </ol>
    </div>`
    : '';
  return `<section class="sec" id="conclusion" data-nav="conclusion" aria-labelledby="conclusion-h">
    <div class="eyebrow">结论</div>
    <h2 class="sec-title" id="conclusion-h">本庭判断</h2>
    <div class="conclusion-body">
      ${body}
    </div>
    ${qs}
  </section>`;
}

function evidenceIds(report) {
  const used = new Set();
  report.issues.forEach((it) => {
    it.claims.forEach((c) => c.source_ids.forEach((x) => used.add(x)));
    it.reasoning.forEach((p) => p.source_ids.forEach((x) => used.add(x)));
  });
  report.conclusion.forEach((p) => p.source_ids.forEach((x) => used.add(x)));
  return report.sources.filter((s) => used.has(s.id)).map((s) => s.id);
}

function shareCard(report) {
  const ids = evidenceIds(report);
  const rows = report.issues.map((it, i) => `<li>
          <span class="n">${String(i + 1).padStart(2, '0')}</span>
          <span class="k">${esc(it.nav_label || '')}</span>
          <span class="v">${esc(it.verdict)}</span>
        </li>`).join('\n        ');
  return `<figure class="share" id="card">
    <figcaption class="share-cap"><span>判词卡</span><span>截图即可分享</span></figcaption>
    <div class="share-card">
      <div class="card-top"><span>赛博判官 · 判词摘要</span><span class="date">材料截至 ${esc(report.as_of)}</span></div>
      <p class="card-case">${esc(report.title_subject || report.title)}</p>
      <p class="card-headline">${esc(report.headline)}</p>
      <ol class="card-rows">
        ${rows}
      </ol>
      <div class="card-foot">
        <p class="meta">证据 <b>${ids.map(esc).join(' ')}</b><br>${report.issues.length} 项争论点 · 完整推理与来源见正文</p>
        <div class="seal card-seal" aria-hidden="true"><span>赛</span><span>博</span><span>判</span><span>官</span></div>
      </div>
    </div>
  </figure>`;
}

function legendBlock() {
  return `<div class="legend">
      ${LEGEND.map(([k, d]) => `<div><span class="k">${k}</span><span class="d">${d}</span></div>`).join('\n      ')}
    </div>`;
}

function sources(report, cites) {
  const list = report.sources.map((s) => {
    const url = safeUrl(s.url);
    const refs = cites.refsFor(s.id);
    const refLine = refs.length
      ? `<div class="src-refs"><span class="k">被引用于</span>${refs.map((r) => `<a href="#${r.anchor}">${esc(r.label)}</a>`).join('')}</div>`
      : `<div class="src-refs"><span class="k">本文未直接引用</span><span>作为背景与讨论线索保留</span></div>`;
    const link = url
      ? `<a class="src-url" href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}<span class="ext"> ↗</span></a>`
      : `<div class="src-url">来源链接未通过协议校验，未生成可点击入口</div>`;
    return `<li class="source" id="source-${escAttr(s.id)}">
      <div class="src-id">${esc(s.id)}</div>
      <div class="src-body">
        <h3 class="src-title">${esc(s.title)}</h3>
        <div class="src-meta">${esc(s.date)} · ${esc(s.kind)}</div>
        <p class="src-note">${esc(s.note)}</p>
        ${link}
        ${refLine}
      </div>
    </li>`;
  }).join('\n    ');

  return `<section class="sec" id="sources" data-nav="sources" aria-labelledby="sources-h">
    <div class="eyebrow">证据</div>
    <h2 class="sec-title" id="sources-h">来源与采集</h2>
    <h3 class="sub-label">支持度标注</h3>
    ${legendBlock()}
    <h3 class="sub-label">证据清单</h3>
    <ol class="sources">
    ${list}
    </ol>
    <details class="method">
      <summary>采集与方法说明</summary>
      <div class="method-body">${esc(report.method_note)}</div>
    </details>
  </section>`;
}

/* ---------- 整页 ---------- */
export function renderReport(report, opts = {}) {
  const css = opts.css ?? fs.readFileSync(path.join(HERE, 'report.css'), 'utf8');
  const js = opts.js ?? fs.readFileSync(path.join(HERE, 'report.js'), 'utf8');
  const tmpl = opts.tmpl ?? fs.readFileSync(path.join(HERE, 'report.tmpl.html'), 'utf8');
  const cites = new Cites(report);

  const nav = navItems(report, cites);
  const body = [
    facts(report, cites),
    ...report.issues.map((it, i) => issue(report, it, i, cites)),
    conclusion(report, cites),
    shareCard(report),
    sources(report, cites),
  ].join('\n\n    ');

  const icon = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="5" width="54" height="54" fill="none" stroke="#a33124" stroke-width="5"/><text x="32" y="44" font-size="32" text-anchor="middle" fill="#a33124" font-family="serif">判</text></svg>`,
  );

  const slots = {
    TITLE: esc(report.title),
    DESC: escAttr(report.summary.slice(0, 120)),
    ICON: escAttr(icon),
    CSS: css,
    JS: js,
    NAV: nav,
    SPINE_META: `${esc(KIND_LABEL[report.kind])}<br>材料截至 <b>${esc(report.as_of)}</b><br>${report.issues.length} 项争论点 · ${report.sources.length} 件证据`,
    KIND_LABEL: esc(KIND_LABEL[report.kind]),
    TOPBAR_META: `材料截至 ${esc(report.as_of)}`,
    HERO: hero(report),
    BODY: body,
    AS_OF: esc(report.as_of),
  };

  return tmpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in slots ? slots[k] : m));
}
