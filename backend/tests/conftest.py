import sys
from pathlib import Path

# Ensure 'backend' is on sys.path so 'import app' always resolves
# regardless of whether pytest is run from repo root, backend folder, or IDE
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
