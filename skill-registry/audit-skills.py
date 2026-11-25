from pathlib import Path
from collections import Counter
from urllib.parse import urlparse
import hashlib
import json
import re
import os
from datetime import datetime, timezone

ROOT = Path("/root/.agents/skills")
OUT = Path("/opt/free-ai/skill-registry/audits")
OUT.mkdir(parents=True, exist_ok=True)

PATTERNS = {
    "prompt_injection": [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"disregard\s+(all\s+)?previous\s+instructions",
        r"reveal\s+(the\s+)?system\s+prompt",
        r"exfiltrat\w*\s+(secrets|credentials|tokens)",
        r"override\s+(the\s+)?system\s+instructions",
    ],
    "destructive_operations": [
        r"\brm\s+-rf\b",
        r"\bmkfs(\.\w+)?\b",
        r"\bdd\s+if=",
        r"\bshred\b",
        r"\bDROP\s+DATABASE\b",
        r"\bDROP\s+TABLE\b",
        r"\bformat\s+[A-Z]:",
    ],
    "shell_execution": [
        r"\bos\.system\s*\(",
        r"\bsubprocess\.(run|Popen|call|check_output)\s*\(",
        r"\bchild_process\b",
        r"\bexecSync\s*\(",
        r"\bspawnSync\s*\(",
        r"\beval\s*\(",
        r"\bexec\s*\(",
    ],
    "network_access": [
        r"\bcurl\b",
        r"\bwget\b",
        r"\brequests\.(get|post|put|delete)\s*\(",
        r"\burllib\.request\b",
        r"\bfetch\s*\(",
        r"\bhttps?://",
        r"\bsocket\.",
    ],
    "credential_access": [
        r"\bos\.environ\b",
        r"\bprocess\.env\b",
        r"\.env\b",
        r"\bAPI_KEY\b",
        r"\bSECRET_KEY\b",
        r"\bACCESS_TOKEN\b",
        r"\bPRIVATE_KEY\b",
        r"\bcredentials\b",
    ],
    "permission_changes": [
        r"\bchmod\b",
        r"\bchown\b",
        r"\bsudo\b",
        r"\bsetcap\b",
    ],
    "obfuscation": [
        r"\bbase64\s+(-d|--decode)\b",
        r"\batob\s*\(",
        r"\bBuffer\.from\s*\([^)]*base64",
        r"\bmarshal\.loads\s*\(",
    ],
}

COMPILED = {
    category: [re.compile(p, re.I) for p in patterns]
    for category, patterns in PATTERNS.items()
}

TEXT_EXTENSIONS = {
    ".md", ".txt", ".py", ".js", ".ts", ".sh", ".bash",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".html",
    ".css", ".sql", ".ps1", ".bat", ".cmd", ".cfg",
    ".ini", ".conf", ".dockerfile"
}

MAX_FILE_SIZE = 2 * 1024 * 1024

def sha256_file(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def scan_skill(skill_file):
    skill_dir = skill_file.parent
    findings = []
    files = []
    urls = set()
    symlinks = []
    licenses = []

    for current, dirs, filenames in os.walk(skill_dir, followlinks=False):
        current_path = Path(current)

        for dirname in list(dirs):
            p = current_path / dirname
            if p.is_symlink():
                symlinks.append(str(p.relative_to(skill_dir)))
                dirs.remove(dirname)

        for filename in filenames:
            path = current_path / filename
            rel = str(path.relative_to(skill_dir))

            if path.is_symlink():
                symlinks.append(rel)
                continue

            try:
                size = path.stat().st_size
                digest = sha256_file(path)
            except OSError:
                continue

            files.append({
                "path": rel,
                "size": size,
                "sha256": digest
            })

            if filename.lower() in {
                "license", "licence", "license.md",
                "licence.md", "copying"
            }:
                licenses.append(rel)

            if size > MAX_FILE_SIZE:
                continue

            if path.suffix.lower() not in TEXT_EXTENSIONS and filename.lower() not in {
                "dockerfile", "makefile"
            }:
                continue

            try:
                content = path.read_text(errors="replace")
            except OSError:
                continue

            for category, regexes in COMPILED.items():
                for regex in regexes:
                    for match in regex.finditer(content):
                        line = content.count("\n", 0, match.start()) + 1
                        findings.append({
                            "category": category,
                            "file": rel,
                            "line": line,
                            "indicator": regex.pattern
                        })

            for raw_url in re.findall(r"https?://[^\s\"'<>`)]+", content):
                try:
                    host = urlparse(raw_url).hostname
                    if host:
                        urls.add(host.lower())
                except ValueError:
                    pass

    categories = Counter(x["category"] for x in findings)

    high_categories = {
        "prompt_injection",
        "destructive_operations",
        "obfuscation"
    }

    if any(x["category"] in high_categories for x in findings):
        risk = "high_review_required"
    elif findings:
        risk = "manual_review_required"
    else:
        risk = "no_static_indicators_found"

    return {
        "skill_name": skill_file.parent.name,
        "skill_path": str(skill_dir),
        "skill_sha256": sha256_file(skill_file),
        "file_count": len(files),
        "files": files,
        "findings_count": len(findings),
        "findings_by_category": dict(categories),
        "findings": findings,
        "external_hosts": sorted(urls),
        "symlinks": symlinks,
        "license_files": licenses,
        "static_scan_result": risk,
        "security_approval": "not_approved"
    }

skill_files = sorted(ROOT.rglob("SKILL.md"))
results = [scan_skill(p) for p in skill_files]

summary = Counter(x["static_scan_result"] for x in results)

report = {
    "audit_version": 1,
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "scan_mode": "static_only_no_execution",
    "skills_scanned": len(results),
    "summary": dict(summary),
    "results": results
}

json_path = OUT / "security-audit.json"
json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))

md_path = OUT / "security-audit.md"

lines = [
    "# Free AI - Skill Security Audit",
    "",
    f"Generated: {report['generated_at']}",
    "",
    "**Mode:** Static analysis only. No skill scripts were executed.",
    "",
    f"**Skills scanned:** {len(results)}",
    "",
    "## Summary",
    ""
]

for status, count in sorted(summary.items()):
    lines.append(f"- {status}: {count}")

lines += ["", "## Skill Findings", ""]

for item in results:
    lines.append(f"### {item['skill_name']}")
    lines.append(f"- Result: `{item['static_scan_result']}`")
    lines.append(f"- Files: {item['file_count']}")
    lines.append(f"- Indicators: {item['findings_count']}")
    lines.append(f"- External hosts: {', '.join(item['external_hosts']) or 'None detected'}")
    lines.append(f"- License files: {', '.join(item['license_files']) or 'Not found'}")

    for finding in item["findings"]:
        lines.append(
            f"- `{finding['category']}` — "
            f"{finding['file']}:{finding['line']}"
        )

    lines.append("")

md_path.write_text("\n".join(lines))

print("========== SECURITY AUDIT ==========")
print("Skills scanned:", len(results))

for status, count in sorted(summary.items()):
    print(f"{status}: {count}")

print("\nJSON:", json_path)
print("Markdown:", md_path)
print("\nNo scripts were executed.")
