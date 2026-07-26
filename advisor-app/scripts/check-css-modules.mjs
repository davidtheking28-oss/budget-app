import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

const SRC = resolve(process.cwd(), 'src');

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function classesIn(cssPath) {
  const css = readFileSync(cssPath, 'utf8');
  const names = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1]);
  return names;
}

const problems = [];

for (const file of walk(SRC).filter(f => /\.jsx?$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  for (const imp of src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.css)['"]/g)) {
    const [, binding, rel] = imp;
    const cssPath = resolve(dirname(file), rel);
    let available;
    try {
      available = classesIn(cssPath);
    } catch {
      problems.push(`${file}: cannot read ${rel}`);
      continue;
    }
    const used = new Set();
    for (const m of src.matchAll(new RegExp(`\\b${binding}\\.([A-Za-z_$][\\w$]*)`, 'g'))) used.add(m[1]);
    for (const m of src.matchAll(new RegExp(`\\b${binding}\\[['"]([^'"]+)['"]\\]`, 'g'))) used.add(m[1]);
    for (const name of used) {
      if (!available.has(name)) {
        problems.push(`${file.replace(SRC, 'src')}: ${binding}.${name} is not defined in ${rel}`);
      }
    }
  }
}

if (problems.length) {
  console.error('Undefined CSS module classes (these render unstyled):');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('css-modules: all referenced classes are defined');
