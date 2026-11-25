from pathlib import Path
import hashlib
import json
import re
from datetime import datetime, timezone
from collections import Counter

ROOT = Path("/root/.agents/skills")
OUT = Path("/opt/free-ai/skill-registry/catalog.json")

OPEN_SELF_HOSTING = {
    "api-contract-review",
    "ci-failure-triage",
    "code-review",
    "codebase-onboarding",
    "database-migration-review",
    "dependency-health",
    "docs-maintenance",
    "pull-request-prep",
    "release-readiness",
    "research-with-sources",
    "security-review",
    "skill-authoring",
    "systematic-debugging",
    "test-driven-changes",
}

skills = []

for path in sorted(ROOT.rglob("SKILL.md")):
    content = path.read_text(errors="replace")
    relative = path.relative_to(ROOT).as_posix()

    match = re.search(r"(?ms)^---\s*\n(.*?)\n---", content)
    if not match:
        continue

    meta = match.group(1)
    name_match = re.search(r"(?m)^name:\s*['\"]?([^'\"\n]+)", meta)

    if not name_match:
        continue

    name = name_match.group(1).strip()

    desc_match = re.search(r"(?m)^description:\s*(.+)", meta)
    description = desc_match.group(1).strip().strip("\"'") if desc_match else ""

    parts = Path(relative).parts

    if parts[0] == "openai":
        provider = "openai"
        source = "OpenAI Skills Repository"
        variant = parts[2] if len(parts) > 2 else "unknown"
        skill_id = f"openai.{variant}.{name}"

    elif parts[0] == "anthropic":
        provider = "anthropic"
        source = "Anthropic Skills Repository"
        skill_id = f"anthropic.{name}"

    elif name in OPEN_SELF_HOSTING:
        provider = "community"
        source = "OpenSelfHosting/skills"
        skill_id = f"openselfhosting.{name}"

    elif name == "reverse-engineer-anything":
        provider = "community"
        source = "Existing local skill - original source unverified"
        skill_id = f"local.{name}"

    else:
        provider = "unknown"
        source = "Unverified"
        skill_id = f"unknown.{name}"

    skills.append({
        "skill_id": skill_id,
        "original_id": name,
        "provider": provider,
        "source": source,
        "source_path": str(path),
        "relative_path": relative,
        "description": description,
        "sha256": hashlib.sha256(content.encode()).hexdigest(),
        "line_count": len(content.splitlines()),
        "security_status": "pending_review",
        "license_status": "unverified",
        "runtime_compatibility": [],
        "model_compatibility": [],
        "version": "unknown"
    })

ids = [s["skill_id"] for s in skills]
if len(ids) != len(set(ids)):
    raise SystemExit("ERROR: Duplicate internal IDs detected. Catalog not written.")

catalog = {
    "catalog_version": 2,
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "root": str(ROOT),
    "total_skills": len(skills),
    "skills": skills
}

OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))

print("Catalog updated:", OUT)
print("Total skills:", len(skills))
print("\nSource classification:")

for provider, count in sorted(Counter(s["provider"] for s in skills).items()):
    print(f"{provider}: {count}")

print("\nUnverified sources:")
for s in skills:
    if s["provider"] == "unknown" or "unverified" in s["source"].lower():
        print(f"- {s['original_id']}: {s['source']}")
