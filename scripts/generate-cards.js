const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const username = "agneja00";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN is not defined");
}

const outputDir = path.join(__dirname, "cards");
fs.ensureDirSync(outputDir);

const headers = {
  Authorization: `Bearer ${token}`,
};

const langColors = {
  TypeScript: "#2b7489",
  JavaScript: "#f1e05a",
  HTML: "#e34c26",
  SCSS: "#c6538c",
  CSS: "#563d7c",
  Dockerfile: "#384d54",
  Shell: "#89e051",
};

const gql = async (query, variables = {}) => {
  const res = await axios.post(
    "https://api.github.com/graphql",
    { query, variables },
    { headers }
  );
  return res.data.data;
};

async function fetchStats() {
  const data = await gql(
    `
    query($login: String!) {
      user(login: $login) {
        repositories(ownerAffiliations: OWNER, first: 100) {
          nodes {
            isArchived
            isFork
            stargazerCount
            languages(first: 50) {
              edges {
                size
                node { name }
              }
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          contributionCalendar {
            totalContributions
          }
        }
      }
    }
  `,
    { login: username }
  );

  const repos = data.user.repositories.nodes.filter(
    (r) => !r.isArchived && !r.isFork
  );

  const langs = {};
  let stars = 0;

  repos.forEach((r) => {
    stars += r.stargazerCount;
    r.languages.edges.forEach((l) => {
      langs[l.node.name] = (langs[l.node.name] || 0) + l.size;
    });
  });

  return {
    stars,
    commits: data.user.contributionsCollection.totalCommitContributions,
    prs: data.user.contributionsCollection.totalPullRequestContributions,
    issues: data.user.contributionsCollection.totalIssueContributions,
    contributed:
      data.user.contributionsCollection.contributionCalendar.totalContributions,
    langs,
  };
}

function makeStatsSVG(s) {
  return `
<svg width="500" height="240" viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#24244a"/>
      <stop offset="100%" stop-color="#15152a"/>
    </linearGradient>
  </defs>

  <rect width="500" height="240" rx="16" fill="url(#g)"/>
  <text x="30" y="38" fill="#ff79c6" font-size="22" font-family="Segoe UI" font-weight="bold">
    Agnieska's GitHub Stats
  </text>

  <g font-size="17" font-family="Segoe UI">
    <text x="25" y="80" fill="#8be9fd">⭐ Total Stars Earned: ${s.stars}</text>
    <text x="25" y="110" fill="#8be9fd">🕒 Total Commits: ${s.commits}</text>
    <text x="25" y="140" fill="#8be9fd">🔀 Total PRs: ${s.prs}</text>
    <text x="25" y="170" fill="#8be9fd">❗ Total Issues: ${s.issues}</text>
    <text x="25" y="200" fill="#8be9fd">📅 Contributed (last year): ${s.contributed}</text>
  </g>
</svg>`;
}

function makeLangsSVG(langs) {
  const entries = Object.entries(langs);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const rows = entries.sort((a, b) => b[1] - a[1]).slice(0, 6);

  const barWidth = 440;
  let offset = 0;

  const stacked = rows
    .map(([name, val]) => {
      const w = (val / total) * barWidth;
      const color = langColors[name] || "#888";
      const x = 30 + offset;
      offset += w;
      return `<rect x="${x}" y="60" width="${w}" height="14" fill="${color}"/>`;
    })
    .join("");

  const items = rows
    .map(([name, val], i) => {
      const perc = ((val / total) * 100).toFixed(2);
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const x = col === 0 ? 40 : 270;
      const y = 125 + row * 28;
      const color = langColors[name] || "#888";
      return `
        <circle cx="${x}" cy="${y - 5}" r="6" fill="${color}"/>
        <text x="${
          x + 14
        }" y="${y}" fill="#ffffff" font-size="15" font-family="Segoe UI">
          ${name} ${perc}%
        </text>
      `;
    })
    .join("");

  return `
<svg width="500" height="240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1b2f"/>
      <stop offset="100%" stop-color="#12121f"/>
    </linearGradient>
  </defs>

  <rect width="500" height="240" rx="16" fill="url(#bg)"/>
  <text x="30" y="38" fill="#ff79c6" font-size="22" font-family="Segoe UI" font-weight="bold">
    Most Used Languages
  </text>

  ${stacked}
  ${items}
</svg>`;
}

(async () => {
  const stats = await fetchStats();

  await fs.writeFile(
    path.join(outputDir, "github-stats.svg"),
    makeStatsSVG(stats)
  );

  await fs.writeFile(
    path.join(outputDir, "top-langs.svg"),
    makeLangsSVG(stats.langs)
  );
})();
