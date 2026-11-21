import { readFileSync } from 'node:fs';

function versionOf(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof data?.version !== 'string' || !data.version.trim()) {
    throw new Error(`${file}: version must be a non-empty string`);
  }
  return data;
}

try {
  const [flag, tag, ...rest] = process.argv.slice(2);
  if ((flag !== undefined && (flag !== '--tag' || !tag)) || rest.length) throw new Error('usage: check-version.mjs [--tag v<version>]');
  const { version } = versionOf('theme.json');
  const pkg = versionOf('package.json');
  const lock = versionOf('package-lock.json');
  for (const [file, value] of [['package.json', pkg.version], ['package-lock.json', lock.version]]) {
    if (value !== version) throw new Error(`${file}: version ${value} does not match theme.json (${version})`);
  }
  if (lock.packages?.[''] && lock.packages[''].version !== version) {
    throw new Error(`package-lock.json: packages[""].version does not match theme.json (${version})`);
  }
  if (tag !== undefined && tag !== `v${version}`) throw new Error(`tag ${tag} does not match theme.json (v${version})`);
  console.log(`Versions match: ${version}${tag ? ` (${tag})` : ''}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
