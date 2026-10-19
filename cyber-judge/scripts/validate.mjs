// No dependencies. Return actionable errors even for malformed JSON structures.
const SUPPORT = new Set(['支持较强', '支持有限', '支持不足', '有明确反证', '暂无法判断', '规范判断']);
const KINDS = new Set(['event', 'public-issue']);
const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const SLUG = /^[a-z][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = v => typeof v === 'string' && v.trim().length > 0;

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateReports(reports) {
  const errors = [], warnings = [];
  const err = (p, m) => errors.push(`[${p}] ${m}`);
  const warn = (p, m) => warnings.push(`[${p}] ${m}`);
  const text = (o, k, p) => { if (!string(o[k])) err(`${p}.${k}`, '需要非空字符串'); };
  const array = (v, p, nonempty = false) => {
    if (!Array.isArray(v)) { err(p, '需要数组'); return []; }
    if (nonempty && !v.length) err(p, '数组不能为空');
    return v;
  };
  const record = (o, p) => { if (!object(o)) { err(p, '需要对象'); return false; } return true; };
  const seenSlugs = new Set();
  array(reports, 'root', true).forEach((r, ri) => {
    const p = `report[${ri}]`;
    if (!record(r, p)) return;
    if (!string(r.slug) || !SLUG.test(r.slug) || RESERVED.test(r.slug)) err(p, 'slug 必须是安全的小写文件名（字母开头，最长 64，非设备保留名）');
    if (seenSlugs.has(r.slug)) err(p, 'slug 重复');
    seenSlugs.add(r.slug);
    if (r.schema_version !== '0.3') err(p, 'schema_version 需要为 0.3');
    if (!KINDS.has(r.kind)) err(p, 'kind 需为 event 或 public-issue');
    if (!validDate(r.as_of)) err(p, 'as_of 需要真实有效的 YYYY-MM-DD 日期');
    for (const k of ['title','title_subject','title_question','headline','summary','method_note']) text(r,k,p);

    const sourceIds = new Set();
    array(r.sources, `${p}.sources`, true).forEach((s,i) => {
      const sp = `${p}.sources[${i}]`;
      if (!record(s,sp)) return;
      if (!string(s.id) || !ID.test(s.id)) err(sp,'id 必须是字母开头的字母、数字、下划线或连字符');
      if (sourceIds.has(s.id)) err(sp,'id 重复');
      sourceIds.add(s.id);
      for (const k of ['title','date','kind','note']) text(s,k,sp);
      try {
        if (!string(s.url)) throw new Error();
        const url = new URL(s.url);
        if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { err(sp, 'url 需要无认证信息的 http(s) 网页地址'); }
    });
    const used = new Set();
    const citations = (o,p,mayBeNormative=false) => {
      const ids = array(o.source_ids, `${p}.source_ids`);
      if (!ids.length && !mayBeNormative) warn(p,'没有来源：确认是自己的推理；事实陈述需要出处');
      for (const id of ids) {
        if (typeof id !== 'string' || !sourceIds.has(id)) err(p, `未知来源编号：${String(id)}`);
        else used.add(id);
      }
    };
    const paragraphs = (v,p) => array(v,p,true).forEach((b,i) => {
      const bp = `${p}[${i}]`;
      if (!record(b,bp)) return;
      text(b,'text',bp); citations(b,bp);
    });
    paragraphs(r.background,`${p}.background`);
    paragraphs(r.conclusion,`${p}.conclusion`);
    array(r.timeline,`${p}.timeline`).forEach((t,i) => {
      const tp = `${p}.timeline[${i}]`;
      if (!record(t,tp)) return;
      for (const k of ['date','title','text']) text(t,k,tp);
      citations(t,tp);
    });
    array(r.actors,`${p}.actors`).forEach((a,i) => {
      const ap = `${p}.actors[${i}]`;
      if (!record(a,ap)) return;
      text(a,'name',ap); text(a,'role',ap);
    });
    const issueIds = new Set();
    array(r.issues,`${p}.issues`,true).forEach((it,i) => {
      const ip = `${p}.issues[${i}]`;
      if (!record(it,ip)) return;
      if (!string(it.id) || !ID.test(it.id)) err(ip,'id 必须是字母开头的字母、数字、下划线或连字符');
      if (issueIds.has(it.id)) err(ip,'id 重复');
      issueIds.add(it.id);
      for (const k of ['nav_label','question','verdict']) text(it,k,ip);
      if (it.roast !== undefined && typeof it.roast !== 'string') err(ip,'roast 需为字符串或省略');
      array(it.claims,`${ip}.claims`,true).forEach((c,j) => {
        const cp = `${ip}.claims[${j}]`;
        if (!record(c,cp)) return;
        for (const k of ['speaker','claim','reason']) text(c,k,cp);
        if (!SUPPORT.has(c.support)) err(cp,'未知支持度标签');
        citations(c,cp,c.support === '规范判断');
      });
      paragraphs(it.reasoning,`${ip}.reasoning`);
    });
    array(r.open_questions,`${p}.open_questions`).forEach((q,i) => {
      if (!string(q)) err(`${p}.open_questions[${i}]`,'需要非空字符串');
    });
    for (const id of sourceIds) if (!used.has(id)) warn(`${p}.sources.${id}`,'来源未被正文引用，确认不是堆积条目');
  });
  return { errors, warnings };
}
