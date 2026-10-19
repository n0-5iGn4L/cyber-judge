#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderReport } from './render.mjs';
import { validateReports } from './validate.mjs';

const help = `用法：
  node build.mjs --input reports.json --check
  node build.mjs --input reports.json --out reports-dir [--slug name] [--overwrite]
需要 Node.js 18+。默认拒绝覆盖已有文件。`;

function main() {
  const args = process.argv.slice(2), opt = {};
  for (let i=0; i<args.length; i++) {
    const key = args[i];
    if (key === '--help' || key === '-h') { console.log(help); return; }
    if (['--check','--overwrite'].includes(key)) { opt[key.slice(2)] = true; continue; }
    if (!['--input','--out','--slug'].includes(key)) throw new Error(`未知参数：${key}`);
    if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`缺少参数值：${key}`);
    opt[key.slice(2)] = args[++i];
  }
  if (!opt.input || (!opt.check && !opt.out)) throw new Error(help);
  const reports = JSON.parse(fs.readFileSync(path.resolve(opt.input),'utf8').replace(/^\uFEFF/,''));
  const { errors, warnings } = validateReports(reports);
  warnings.forEach(w => console.warn('WARN ' + w));
  if (errors.length) throw new Error(errors.join('\n'));
  const selected = opt.slug ? reports.filter(r => r.slug === opt.slug) : reports;
  if (!selected.length) throw new Error(`没有匹配的 slug：${opt.slug}`);
  if (opt.check) { console.log(`校验通过：${selected.length} 份报告，${warnings.length} 条提示。`); return; }
  const dest = path.resolve(opt.out);
  // Validate and render all selected reports before writing any output.
  const files = selected.map(r => ({ file:path.join(dest,r.slug+'.html'), html:renderReport(r) }));
  for (const {file} of files) if (fs.existsSync(file) && !opt.overwrite) throw new Error(`文件已存在，更新时使用 --overwrite：${file}`);
  fs.mkdirSync(dest,{recursive:true});
  for (const {file,html} of files) {
    fs.writeFileSync(file,html,{encoding:'utf8',flag:opt.overwrite?'w':'wx'});
    console.log(`OK ${path.basename(file)} ${(Buffer.byteLength(html)/1024).toFixed(1)} KB`);
  }
}
try { main(); }
catch (error) { console.error('ERROR ' + error.message); process.exitCode=1; }
