import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const METADATA_PATH = path.resolve(process.cwd(), "docs/upstream/PASS_CLI_SOURCE_METADATA.json");
const DEFAULT_CHANGELOG_URL =
  "https://raw.githubusercontent.com/protonpass/pass-cli/main/CHANGELOG.md";

function parseArgs(argv) {
  const args = { reportPath: null, syncMetadata: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--report") {
      args.reportPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (argv[i] === "--sync-metadata") {
      args.syncMetadata = true;
    }
  }
  return args;
}

function toTagsApiUrl(repoUrl) {
  const match = String(repoUrl)
    .trim()
    .match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (!match) {
    throw new Error(`Could not derive GitHub tags API URL from upstream_repo: ${repoUrl}`);
  }

  return `https://api.github.com/repos/${match[1]}/${match[2]}/tags?per_page=100`;
}

function normalizeSemverTag(tagName) {
  const tag = String(tagName ?? "").trim();
  const match = tag.match(/^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (!match) {
    throw new Error(`Unable to parse semver from release tag_name: ${tag || "<empty>"}`);
  }
  return match[1];
}

function parseSemver(version) {
  const match = String(version).match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareSemver(a, b) {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) {
    return 0;
  }

  if (parsedA.major !== parsedB.major) return parsedA.major - parsedB.major;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor - parsedB.minor;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch - parsedB.patch;
  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (!parsedA.prerelease && !parsedB.prerelease) return 0;
  return parsedA.prerelease.localeCompare(parsedB.prerelease);
}

function findLatestSemverTag(tags) {
  let best = null;
  for (const tag of tags) {
    const normalized = normalizeSemverTag(tag?.name);
    if (!best || compareSemver(normalized, best.version) > 0) {
      best = {
        version: normalized,
        tagName: String(tag.name),
        tagApiUrl: String(tag.commit?.url ?? "").trim() || null,
        tagCommitSha: String(tag.commit?.sha ?? "").trim() || null,
      };
    }
  }

  if (!best) {
    throw new Error("Could not find a semver tag in GitHub tags API payload.");
  }
  return best;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getPublishedDateFromChangelog(changelogUrl, version) {
  const response = await globalThis.fetch(changelogUrl, {
    headers: { "User-Agent": "proton-pass-community-mcp-upstream-watch" },
  });
  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  const match = text.match(
    new RegExp(`^##\\s+${escapeRegex(version)}\\s+\\((\\d{4}-\\d{2}-\\d{2})\\)`, "m"),
  );
  return match?.[1] ?? null;
}

async function getLatestVersionFromGitHubTags(apiUrl) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "proton-pass-community-mcp-upstream-watch",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await globalThis.fetch(apiUrl, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tags (${response.status} ${response.statusText})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Tags API payload was empty.");
  }

  return findLatestSemverTag(payload);
}

function buildSummary(report) {
  return [
    "## Pass CLI Upstream Watch",
    "",
    `- Checked at (UTC): ${report.checked_at_utc}`,
    `- Source: \`${report.source.latest_known_version_source}\``,
    `- Tracked latest version: \`${report.tracked.latest_known_version}\``,
    `- Observed latest version: \`${report.observed.latest_known_version}\``,
    `- Observed release date: \`${report.observed.latest_known_version_published_date ?? "unknown"}\``,
    `- Status: **${report.status}**`,
    "",
    "> This check reports upstream release changes. It does not determine behavioral drift.",
  ].join("\n");
}

async function main() {
  const { reportPath, syncMetadata } = parseArgs(process.argv.slice(2));

  const rawMetadata = await readFile(METADATA_PATH, "utf8");
  const metadata = JSON.parse(rawMetadata);

  const tagsApiUrl = String(metadata.latest_known_version_source || "").includes("/tags")
    ? metadata.latest_known_version_source
    : toTagsApiUrl(metadata.upstream_repo);
  const changelogUrl = String(
    metadata.latest_known_version_changelog_source || DEFAULT_CHANGELOG_URL,
  );
  const {
    version: latestVersion,
    tagName: latestTagName,
    tagApiUrl: latestTagApiUrl,
    tagCommitSha: latestTagCommitSha,
  } = await getLatestVersionFromGitHubTags(tagsApiUrl);
  const latestVersionPublishedDate = await getPublishedDateFromChangelog(
    changelogUrl,
    latestVersion,
  );

  const changedFields = [];
  if (latestVersion !== metadata.latest_known_version) {
    changedFields.push("latest_known_version");
  }
  if (
    latestVersion === metadata.latest_known_version &&
    latestVersionPublishedDate &&
    latestVersionPublishedDate !== metadata.latest_known_version_published_date
  ) {
    changedFields.push("latest_known_version_published_date");
  }

  const checkedAtUtc = new Date().toISOString();
  let metadataSynced = false;
  if (syncMetadata && changedFields.length > 0) {
    metadata.latest_known_version = latestVersion;
    if (latestVersionPublishedDate) {
      metadata.latest_known_version_published_date = latestVersionPublishedDate;
    }
    metadata.latest_known_version_source = tagsApiUrl;
    metadata.latest_known_version_changelog_source = changelogUrl;
    metadata.last_checked_utc = checkedAtUtc;
    delete metadata.upstream_repo_head_sha;
    await writeFile(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    metadataSynced = true;
  }

  const report = {
    status: changedFields.length > 0 ? "UPSTREAM_RELEASE_CHANGED" : "UNCHANGED",
    checked_at_utc: checkedAtUtc,
    changed_fields: changedFields,
    source: {
      latest_known_version_source: tagsApiUrl,
      latest_known_version_changelog_source: changelogUrl,
    },
    tracked: {
      latest_known_version: metadata.latest_known_version,
      latest_known_version_published_date: metadata.latest_known_version_published_date,
    },
    observed: {
      latest_known_version: latestVersion,
      latest_known_version_published_date: latestVersionPublishedDate,
      latest_tag_name: latestTagName,
      latest_tag_commit_sha: latestTagCommitSha,
      latest_tag_api_url: latestTagApiUrl,
    },
    metadata_synced: metadataSynced,
    note: "This report is an upstream release check only, not a drift classification.",
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

  if (changedFields.length > 0 && !syncMetadata) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
