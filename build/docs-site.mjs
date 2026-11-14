import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chooseDocsReleases } from './lib/docsReleases.mjs';

const SITE_BASE = '/FoundryVTT-Nimble/';
const BETA_BASE = `${SITE_BASE}beta/`;

function setOutputs(outputs) {
	const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
	for (const line of lines) console.log(line);
	if (process.env.GITHUB_OUTPUT)
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

function choose() {
	const args = ['release', 'list', '--limit', '1000', '--json', 'tagName,isPrerelease,isDraft'];
	const releases = JSON.parse(execFileSync('gh', args, { encoding: 'utf-8' }));
	const { stable, beta, ignored } = chooseDocsReleases(releases);

	for (const { tag, reason } of ignored) console.log(`Ignored ${tag}: ${reason}`);
	if (!stable) throw new Error('No Stable Release found; the site needs one.');
	console.log(
		beta ? `Beta Docs: ${beta}` : 'No Beta Release is newer than the newest Stable Release.',
	);

	const builds = [{ channel: 'stable', tag: stable }];
	if (beta) builds.push({ channel: 'beta', tag: beta });
	setOutputs({ stable, beta: beta ?? '', builds: JSON.stringify(builds) });
}

// With no Beta Docs, /beta/ and every page under it go to the same page in the Stable Docs.
function writeBetaRedirect(siteDir) {
	const betaDir = path.join(siteDir, 'beta');
	fs.mkdirSync(betaDir, { recursive: true });
	fs.writeFileSync(
		path.join(betaDir, 'index.html'),
		`<!doctype html>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${SITE_BASE}">
<title>Nimble FoundryVTT</title>
<script>location.replace('${SITE_BASE}' + location.search + location.hash);</script>
<a href="${SITE_BASE}">Go to the docs</a>
`,
	);

	const notFound = path.join(siteDir, '404.html');
	const html = fs.readFileSync(notFound, 'utf-8');
	const script = `<script>(function () { var p = location.pathname; if (p.indexOf('${BETA_BASE}') === 0) location.replace('${SITE_BASE}' + p.slice(${BETA_BASE.length}) + location.search + location.hash); })();</script>`;
	if (!html.includes('<head>')) throw new Error(`${notFound} has no <head>.`);
	fs.writeFileSync(notFound, html.replace('<head>', `<head>${script}`));
}

const [command, arg] = process.argv.slice(2);
if (command === 'choose') choose();
else if (command === 'beta-redirect' && arg) writeBetaRedirect(arg);
else {
	console.error('Usage: node build/docs-site.mjs choose | beta-redirect <site dir>');
	process.exit(1);
}
