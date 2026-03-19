const express = require('express');
const { execSync } = require('child_process');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

function gitCommit(repoPath, dateStr, message) {
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: dateStr,
    GIT_COMMITTER_DATE: dateStr,
  };
  execSync(
    `git -C "${repoPath}" add pt.txt && git -C "${repoPath}" commit -m "${message}"`,
    { env, stdio: 'pipe' }
  );
}

function githubRequest(method, apiPath, token, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'contribution-painter/2.0',
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}


app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/gh/repos', async (req, res) => { // get user repos
  const token = req.headers['x-gh-token'];
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  try {
    const { status, body } = await githubRequest(
      'GET',
      '/user/repos?per_page=100&sort=updated&affiliation=owner',
      token
    );

    if (status !== 200) {
      return res.status(status).json({ message: body.message || 'GitHub error.' });
    }

    const repos = body.map((r) => ({
      full_name: r.full_name,
      private: r.private,
      default_branch: r.default_branch,
    }));

    res.json(repos);
  } catch (err) {
    console.error('[/gh/repos]', err.message);
    res.status(500).json({ message: 'Failed to fetch repos from GitHub.' });
  }
});

app.post('/generate', async (req, res) => {
  const { pixels, ghToken, ghRepo, ghBranch } = req.body;

  if (!pixels || !pixels.length) {
    return res.status(400).json({ message: 'No pixels provided.' });
  }

  const useGitHub = !!(ghToken && ghRepo);
  const artRepoPath = path.join(__dirname, 'art-repo');

  const branch = ghBranch || 'main';
  const remoteUrl = useGitHub ? `https://github.com/${ghRepo}.git` : null;
  const authHeader = useGitHub
    ? `Authorization: Basic ${Buffer.from(`x-token:${ghToken}`).toString('base64')}`
    : null;
  const gitAuth = useGitHub ? `-c http.extraHeader="${authHeader}"` : '';

  try {
  if (useGitHub) {
    if (!fs.existsSync(artRepoPath)) {
      console.log(`Cloning ${ghRepo}...`);
      execSync(`git ${gitAuth} clone --branch ${branch} "${remoteUrl}" "${artRepoPath}"`, { stdio: 'pipe' });
    } else {
      try {
        execSync(`git -C "${artRepoPath}" remote get-url origin`, { stdio: 'pipe' });
        try { execSync(`git -C "${artRepoPath}" ${gitAuth} pull --ff-only`, { stdio: 'pipe' }); } catch { /* non-fatal */ }
      } catch {
        console.log('art-repo has no remote, re-cloning...');
        fs.rmSync(artRepoPath, { recursive: true, force: true });
        execSync(`git ${gitAuth} clone --branch ${branch} "${remoteUrl}" "${artRepoPath}"`, { stdio: 'pipe' });
      }
    }
  } else {
    if (!fs.existsSync(artRepoPath)) {
      fs.mkdirSync(artRepoPath, { recursive: true });
      execSync(`git -C "${artRepoPath}" init`, { stdio: 'pipe' });
      execSync(`git -C "${artRepoPath}" config user.email "painter@local"`, { stdio: 'pipe' });
      execSync(`git -C "${artRepoPath}" config user.name "Painter"`, { stdio: 'pipe' });
      console.log('Created local art-repo.');
    }
  }

  // always make sure ths bullshit file exists 
  const ptPath = path.join(artRepoPath, 'pt.txt');
  if (!fs.existsSync(ptPath)) {
    fs.writeFileSync(ptPath, 'Art placeholder\n');
    execSync(`git -C "${artRepoPath}" add pt.txt && git -C "${artRepoPath}" commit -m "init"`, { stdio: 'pipe' });
  }

  const repoPath = artRepoPath;
  const now = moment();
  const oneYearAgo = now.clone().subtract(1, 'years');
  const startDate = oneYearAgo.clone().subtract(oneYearAgo.day(), 'days'); // .day() = 0 (Sun) - 6 (Sat)
  let totalCommits = 0;

  console.log(`Paint job: ${pixels.length} cells — ${useGitHub ? `pushing to ${ghRepo}` : 'local only'}`);

  for (const pixel of pixels) {
    const date = moment(startDate)
      .add(pixel.x, 'weeks')
      .add(pixel.y, 'days')
      .toISOString();
    const intensity = pixel.intensity || 1;

    for (let i = 0; i < intensity; i++) {
      fs.writeFileSync(ptPath, `${pixel.x},${pixel.y} · commit ${i} · ${date}\n`);
      try {
        gitCommit(repoPath, date, `art · ${pixel.x},${pixel.y} · ${i}`);
        totalCommits++;
      } catch { /* skip duplicates / nothing-to-commit */ }
    }
  }

  console.log(`Done — ${totalCommits} commits written.`);
  if (useGitHub) {
    console.log('Pushing...');
    try {
      execSync(
        `git -C "${artRepoPath}" ${gitAuth} push --force "${remoteUrl}" ${branch}`,
        { stdio: 'pipe' }
      );
      return res.json({ message: `Done! ${totalCommits} commits pushed to ${ghRepo}.` });
    } catch (err) {
      const detail = err.stderr ? err.stderr.toString().trim() : err.message;
      console.error('[push]', detail);
      return res.status(500).json({
        message: `Commits written but push failed:\n${detail}`,
      });
    }
  }

  res.json({
    message: `Done! ${totalCommits} commits written. Run 'git push origin main' in your art-repo folder.`,
  });

  } catch (err) {
    console.error('[/generate]', err.message);
    res.status(500).json({ message: err.message });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Contribution Painter  →  http://localhost:${PORT}\n`);
});
