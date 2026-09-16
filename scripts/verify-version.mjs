import { readFileSync } from 'node:fs';

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const lockVersion = packageLock.packages?.['']?.version ?? packageLock.version;

if (!semverPattern.test(packageJson.version)) {
  throw new Error(`package.json의 version이 유효한 Semantic Version 형식이 아닙니다: ${packageJson.version}`);
}

if (packageJson.version !== packageLock.version || packageJson.version !== lockVersion) {
  throw new Error(
    `버전 불일치: package.json=${packageJson.version}, package-lock.json=${packageLock.version}, root package=${lockVersion}`,
  );
}

console.log(`서비스 버전 검증 완료: v${packageJson.version}`);
