import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const METADATA_PATH = path.resolve(process.cwd(), "docs/upstream/PASS_CLI_SOURCE_METADATA.json");

function parseArgs(argv) {
  const args = { reportPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--report") {
      args.reportPath = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return args;
}

function getHeadSha(repoUrl) {
  const output = execFileSync("git", ["ls-remote", repoUrl, "HEAD"], { encoding: "utf8" }).trim();
  const sha = output.split(/\s+/)[0];
  if (!sha || !/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error(`Unable to parse HEAD SHA from: ${output || "<empty>"}`);
  }
  return sha;
}

async function getLatestVersionFromChangelog(changelogUrl) {
  const response = await globalThis.fetch(changelogUrl, {
    headers: { "User-Agent": "proton-pass-community-mcp-upstream-watch" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch changelog (${response.status} ${response.statusText})`);
  }

  const text = await response.text();
  const match = text.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)\s+\((\d{4}-\d{2}-\d{2})\)/m);
  if (!match) {
    throw new Error("Could not parse latest version heading from changelog.");
  }

  return {
    latestVersion: match[1],
    latestVersionPublishedDate: match[2],
  };
}

function buildSummary(report) {
  return [
    "## Pass CLI Upstream Watch",
    "",
    `- Checked at (UTC): ${report.checked_at_utc}`,
    `- Tracked HEAD SHA: \`${report.tracked.upstream_repo_head_sha}\``,
    `- Observed HEAD SHA: \`${report.observed.upstream_repo_head_sha}\``,
    `- Tracked latest version: \`${report.tracked.latest_known_version}\``,
    `- Observed latest version: \`${report.observed.latest_known_version}\``,
    `- Status: **${report.status}**`,
    "",
    "> This check only reports upstream reference changes. It does not determine behavioral drift.",
  ].join("\n");
}

async function main() {
  const { reportPath } = parseArgs(process.argv.slice(2));

  const rawMetadata = await readFile(METADATA_PATH, "utf8");
  const metadata = JSON.parse(rawMetadata);

  const observedHeadSha = getHeadSha(metadata.upstream_repo);
  const { latestVersion, latestVersionPublishedDate } = await getLatestVersionFromChangelog(
    metadata.latest_known_version_source,
  );

  const changedFields = [];
  if (observedHeadSha !== metadata.upstream_repo_head_sha) {
    changedFields.push("upstream_repo_head_sha");
  }
  if (latestVersion !== metadata.latest_known_version) {
    changedFields.push("latest_known_version");
  }

  const report = {
    status: changedFields.length > 0 ? "UPSTREAM_CHANGED" : "UNCHANGED",
    checked_at_utc: new Date().toISOString(),
    changed_fields: changedFields,
    tracked: {
      upstream_repo_head_sha: metadata.upstream_repo_head_sha,
      latest_known_version: metadata.latest_known_version,
    },
    observed: {
      upstream_repo_head_sha: observedHeadSha,
      latest_known_version: latestVersion,
      latest_known_version_published_date: latestVersionPublishedDate,
    },
    note: "This report is an upstream reference check only, not a drift classification.",
  };

  if (reportPath) {
    await writeFile(
      path.resolve(process.cwd(), reportPath),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }

  const summary = buildSummary(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, { flag: "a" });
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (changedFields.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
