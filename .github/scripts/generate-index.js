const fs = require("fs");
const path = require("path");

const LANGS = [
  { code: "fr", flag: "🇫🇷", label: "Français", dir: "docs/fr" },
  { code: "en", flag: "🇬🇧", label: "English", dir: "docs/en" },
];

const CATEGORY_ORDER = [
  "fintech",
  "paiements",
  "payments",
  "banque",
  "banking",
  "bases-de-donnees",
  "databases",
  "securite",
  "security",
  "systemes-distribues",
  "distributed-systems",
  "reseaux",
  "networking",
  "programmation",
  "programming",
  "cloud",
  "systemes-exploitation",
  "operating-systems",
  "intelligence-artificielle",
  "artificial-intelligence",
  "economie",
  "economics",
  "architecture-systemes",
  "system-design",
  "fondations",
  "foundations",
];

function extractTitle(filepath) {
  const content = fs.readFileSync(filepath, "utf8");
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractStatus(filepath) {
  const content = fs.readFileSync(filepath, "utf8");
  const match = content.match(/^status:\s*(\w+)/m);
  return match ? match[1].trim() : "published";
}

function buildIndex() {
  const index = {};
  for (const lang of LANGS) {
    index[lang.code] = {};
    if (!fs.existsSync(lang.dir)) continue;
    const categories = fs
      .readdirSync(lang.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const category of categories) {
      const dir = path.join(lang.dir, category);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filepath = path.join(dir, file);
        const title = extractTitle(filepath);
        const status = extractStatus(filepath);
        if (status === "draft" || !title) continue;
        if (!index[lang.code][category]) index[lang.code][category] = [];
        index[lang.code][category].push({ title, filepath });
      }
    }
  }
  return index;
}

function sortCategories(categories) {
  return categories.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function renderIndex(index) {
  let output = "\n";
  for (const lang of LANGS) {
    const categories = Object.keys(index[lang.code] || {});
    output += `### ${lang.flag} ${lang.label}\n\n`;
    if (categories.length === 0) {
      output += "*Aucun article publié pour l'instant.*\n\n";
      continue;
    }
    for (const category of sortCategories(categories)) {
      const articles = index[lang.code][category];
      if (!articles || articles.length === 0) continue;
      output += `**${category}**\n\n`;
      for (const article of articles) {
        output += `- [${article.title}](${article.filepath})\n`;
      }
      output += "\n";
    }
  }
  return output;
}

function updateReadme(indexContent) {
  const readme = fs.readFileSync("README.md", "utf8");
  const startMarker = "<!-- INDEX_START -->";
  const endMarker = "<!-- INDEX_END -->";
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (start === -1 || end === -1) {
    console.error(
      "Marqueurs INDEX_START / INDEX_END introuvables dans README.md",
    );
    process.exit(1);
  }
  const updated =
    readme.slice(0, start + startMarker.length) +
    "\n" +
    indexContent +
    readme.slice(end);
  fs.writeFileSync("README.md", updated);
  console.log("README.md mis à jour");
}

const index = buildIndex();
const content = renderIndex(index);
updateReadme(content);
