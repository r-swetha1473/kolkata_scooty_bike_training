/**
 * Deploy/build metadata for /api/version and health diagnostics.
 * Render sets RENDER_GIT_COMMIT; Docker builds can inject GIT_COMMIT or build-info.json.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readBuildInfoFile() {
  const infoPath = path.join(__dirname, '..', 'build-info.json');
  if (!fs.existsSync(infoPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveGitCommit() {
  if (process.env.RENDER_GIT_COMMIT) {
    return process.env.RENDER_GIT_COMMIT;
  }
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT;
  }

  const fromFile = readBuildInfoFile();
  if (fromFile?.commit) {
    return fromFile.commit;
  }

  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function getBuildInfo() {
  const fromFile = readBuildInfoFile() || {};
  const commit = resolveGitCommit();

  return {
    commit: commit || null,
    commitShort: commit ? commit.slice(0, 7) : null,
    branch: process.env.RENDER_GIT_BRANCH || process.env.GIT_BRANCH || fromFile.branch || null,
    builtAt: fromFile.builtAt || null,
    nodeEnv: process.env.NODE_ENV || 'development',
    service: process.env.RENDER_SERVICE_NAME || null
  };
}

module.exports = { getBuildInfo, resolveGitCommit };
