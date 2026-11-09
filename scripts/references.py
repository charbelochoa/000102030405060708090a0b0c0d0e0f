import concurrent.futures
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sources = json.loads((root / "docs/frameworks.json").read_text(encoding="utf-8-sig"))


def fetch(entry):
    repository = entry["repository"]
    name = repository.split("/")[-1]
    folder = root / "references" / "frameworks" / name / "source"
    folder.mkdir(parents=True, exist_ok=True)
    def git(*args):
        return subprocess.run(["git", "-C", str(folder), *args], check=True, capture_output=True, text=True).stdout.strip()
    if not (folder / ".git").exists():
        git("init")
        git("remote", "add", "origin", "https://github.com/" + repository + ".git")
    remote = git("remote", "get-url", "origin")
    if remote != "https://github.com/" + repository + ".git":
        raise ValueError(remote)
    if git("status", "--porcelain"):
        raise ValueError("Referencia modificada: " + repository)
    revision = entry["revision"]
    current = subprocess.run(["git", "-C", str(folder), "rev-parse", "--verify", "HEAD"], capture_output=True, text=True)
    small = {"crewAI": "lib/crewai/src/crewai", "agent-framework": "python/packages/core/agent_framework"}
    subtree = entry.get("path") or small.get(name)
    pinned = current.returncode == 0 and current.stdout.strip() == revision
    if not pinned:
        git("fetch", "--depth=1", "--filter=blob:none", "--no-tags", "origin", revision)
    if subtree and (not pinned or not (folder / subtree).is_dir()):
        git("sparse-checkout", "set", subtree)
    if not pinned:
        git("checkout", "--detach", revision)
    if subtree and not (folder / subtree).is_dir():
        raise ValueError("Ruta ausente: " + repository + "/" + subtree)
    if git("rev-parse", "HEAD") != revision:
        raise ValueError(repository)
    print(repository, revision, flush=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(fetch, sources))
