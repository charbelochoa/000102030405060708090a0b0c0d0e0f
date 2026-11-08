import os
import subprocess
import sys
import venv
from pathlib import Path

root = Path(__file__).resolve().parent.parent
os.chdir(root)
folder = root / "build" / "python-tools"
python = folder / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if not python.exists():
    venv.EnvBuilder(with_pip=True).create(folder)
subprocess.run([str(python), "-m", "pip", "install", "-r", "tools/requirements.txt"], check=True)
if "--pack" in sys.argv:
    subprocess.run([str(python), "-m", "pip", "install", "pyinstaller==6.22.3"], check=True)
    subprocess.run([str(python), "-m", "PyInstaller", "--noconfirm", "--onedir", "--name",
                    "aeris-analysis", "--hidden-import", "_duckdb", "--collect-data", "docx",
                    "--distpath", "build/worker", "--workpath", "build/pyinstaller", "--specpath",
                    "build", "tools/analysis_worker.py"], check=True)
