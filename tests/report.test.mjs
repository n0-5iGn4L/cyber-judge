import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateReports } from '../cyber-judge/scripts/validate.mjs';
import { renderReport } from '../cyber-judge/scripts/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const samples = JSON.parse(fs.readFileSync(path.join(ROOT,'examples/reports.example.json'),'utf8'));
const copy = () => structuredClone(samples);
const check = r => validateReports(r).errors;

test('both branches render every issue with dynamic navigation and valid citation targets', () => {
  assert.deepEqual(check(samples),[]);
  for (const sample of samples) {
    const html = renderReport(sample);
    assert.equal((html.match(/<section class="issue"/g)||[]).length, sample.issues.length);
    const end = String(sample.issues.length+1).padStart(2,'0');
    assert.ok(html.includes(`data-nav="conclusion"><span class="n">${end}</span>`));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size,'duplicate HTML ids');
    for (const [,target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target),target);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html));
    assert.ok(!/<(?:script|img)[^>]+src=["']https?:/i.test(html));
  }
});

test('12 independent display items are retained without four-issue limits', () => {
  const r = copy()[0];
  r.issues = Array.from({length:12},(_,i)=>({...structuredClone(r.issues[i%r.issues.length]),id:'issue'+i,nav_label:'模拟论点'+(i+1)}));
  assert.deepEqual(check([r]),[]);
  const html=renderReport(r);
  assert.equal((html.match(/<section class="issue"/g)||[]).length,12);
  assert.ok(html.includes('data-nav="conclusion"><span class="n">13</span>'));
  assert.ok(html.includes('data-nav="sources"><span class="n">14</span>'));
});

test('public issues, optional sections and complete verdict qualifiers survive rendering', () => {
  const r = copy()[1];
  r.actors=[];
  r.open_questions=[];
  for(const it of r.issues) delete it.roast;
  r.issues[0].verdict='第一句是明确判断。第二句包含决定适用范围的重要条件，必须在分享卡中保留。';
  assert.deepEqual(check([r]),[]);
  const html=renderReport(r);
  assert.ok(html.includes('公共议题报告'));
  assert.ok(!html.includes(' · 事件争议报告'));
  assert.ok(!html.includes('<h3 class="sub-label">时间线</h3>'));
  assert.ok(!html.includes('<h3 class="sub-label">各方角色</h3>'));
  assert.ok(!html.includes('<blockquote class="roast">'));
  assert.equal(html.split(r.issues[0].verdict).length-1,2);
});

test('untrusted text is escaped and unsafe URLs, file names and IDs are rejected', () => {
  const r = copy()[0];
  r.title='</title><script>alert("title")</script>';
  r.issues[0].verdict='<img src=x onerror=alert(1)>';
  const html=renderReport(r);
  assert.ok(!html.includes(r.title));
  assert.ok(!html.includes(r.issues[0].verdict));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  for (const slug of ['../escape','CON','nul','com1','a/b','a\\b']) {
    const r=copy()[0];r.slug=slug;assert.ok(check([r]).length,slug);
  }
  for (const url of ['javascript:alert(1)','file:///c:/private','https://user:secret@example.org']) {
    const r=copy()[0];r.sources[0].url=url;assert.ok(check([r]).length,url);
  }
  r.issues[0].id='x" onclick="bad';assert.ok(check([r]).length);
});

test('malformed structures, absent conclusions, invalid dates and missing references fail cleanly', () => {
  for (const v of [null,{},[],[null],[1]]) assert.ok(check(v).length);
  for(const [key,value] of [['sources',{}],['issues',[null]],['timeline',null],['actors',[null]],['conclusion',[]],['open_questions',{}],['as_of','2026-02-30']]) {
    const r=copy()[0];r[key]=value;assert.ok(check([r]).length,key);
  }
  const r=copy()[0];r.issues[0].claims[0].source_ids=['MISSING'];assert.ok(check([r]).length);
  const s=copy()[0];s.sources.push(s.sources[0]);assert.ok(check([s]).length);
});

test('CLI runs from another directory, checks without writes, rejects overwrite and malformed input', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cyber-judge-test-'));
  const run=(...args)=>spawnSync(process.execPath,[path.join(ROOT,'cyber-judge/scripts/build.mjs'),...args],{cwd:tmp,encoding:'utf8',windowsHide:true});
  try {
    fs.writeFileSync(path.join(tmp,'input.json'),JSON.stringify(samples));
    assert.equal(run('--input','input.json','--check').status,0);
    assert.ok(!fs.existsSync(path.join(tmp,'result')));
    assert.equal(run('--input','input.json','--out','result').status,0);
    const target=path.join(tmp,'result/event-demo.html');
    const before=fs.readFileSync(target,'utf8');
    assert.notEqual(run('--input','input.json','--out','result').status,0);
    assert.equal(fs.readFileSync(target,'utf8'),before);
    assert.equal(run('--input','input.json','--out','result','--overwrite','--slug','event-demo').status,0);
    assert.notEqual(run('--input','input.json','--check','--slug','absent').status,0);
    const invalid=copy();invalid[1].slug='../escaped';
    fs.writeFileSync(path.join(tmp,'bad.json'),JSON.stringify(invalid));
    assert.notEqual(run('--input','bad.json','--out','bad-output').status,0);
    assert.ok(!fs.existsSync(path.join(tmp,'bad-output')));
    assert.notEqual(run('--input','input.json','--unknown').status,0);
  } finally {
    const resolved=path.resolve(tmp);
    assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('cyber-judge-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
