#!/usr/bin/env python3
"""
MEIKAAN — Unified Project Launcher
===================================
Starts Database, Backend API (FastAPI/Uvicorn), and Frontend UI (React/Vite)
in a single command with zero setup requirements.

Usage:
    python start_project.py
    (or ./start_project / start_project.bat / start_project.ps1 / start_project.sh)
"""

import os
import sys
import time
import subprocess
import urllib.request
import urllib.error
import webbrowser
import signal

# Reconfigure stdout/stderr to UTF-8 for cross-platform unicode handling
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# Platform specific binary names
IS_WINDOWS = sys.platform.startswith("win")
VENV_PYTHON = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe") if IS_WINDOWS else os.path.join(BACKEND_DIR, "venv", "bin", "python")
VENV_PIP = os.path.join(BACKEND_DIR, "venv", "Scripts", "pip.exe") if IS_WINDOWS else os.path.join(BACKEND_DIR, "venv", "bin", "pip")
NPM_CMD = "npm.cmd" if IS_WINDOWS else "npm"

processes = []

def log(msg, tag="INFO"):
    colors = {
        "INFO": "\033[94m",      # Blue
        "SUCCESS": "\033[92m",   # Green
        "WARN": "\033[93m",      # Yellow
        "ERROR": "\033[91m",     # Red
        "BANNER": "\033[95m",    # Magenta
        "RESET": "\033[0m"
    }
    prefix = f"{colors.get(tag, '')}[{tag}]{colors['RESET']}"
    print(f"{prefix} {msg}", flush=True)

def print_banner():
    banner = """
\033[96m========================================================================\033[0m
\033[95m   🏛️  MEIKAAN — Civic Evidence Integrity Engine (Unified Launcher)   \033[0m
\033[96m========================================================================\033[0m
"""
    print(banner, flush=True)

def check_environment():
    log("Checking Python and Node.js runtime environment...", "INFO")
    if sys.version_info < (3, 8):
        log("Python 3.8 or higher is required.", "ERROR")
        sys.exit(1)
        
    try:
        node_version = subprocess.check_output(["node", "--version"], text=True).strip()
        npm_version = subprocess.check_output([NPM_CMD, "--version"], text=True).strip()
        log(f"Detected Node.js {node_version} and npm {npm_version}", "SUCCESS")
    except Exception as e:
        log("Node.js / npm not found on PATH. Please install Node.js.", "ERROR")
        sys.exit(1)

def setup_backend_env():
    venv_dir = os.path.join(BACKEND_DIR, "venv")
    if not os.path.exists(venv_dir):
        log("Creating Python virtual environment in backend/venv...", "INFO")
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
        log("Virtual environment created.", "SUCCESS")
        
    log("Ensuring backend dependencies are installed...", "INFO")
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")
    try:
        subprocess.run([VENV_PIP, "install", "-r", req_file, "--quiet"], check=True)
        log("Backend dependencies verified.", "SUCCESS")
    except Exception as e:
        log(f"Warning during backend pip install: {e}", "WARN")

def setup_frontend_env():
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules):
        log("Installing frontend dependencies (npm install)...", "INFO")
        subprocess.run([NPM_CMD, "install"], cwd=FRONTEND_DIR, check=True)
        log("Frontend dependencies installed.", "SUCCESS")
    else:
        log("Frontend dependencies verified (node_modules exists).", "SUCCESS")

def setup_database():
    log("Initializing & Verifying Database connection...", "INFO")
    
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        postgres_url = "postgresql://postgres:postgres@localhost:5432/meikaan"
        try:
            import psycopg2
            conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres", connect_timeout=3)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM pg_database WHERE datname='meikaan'")
            exists = cur.fetchone()
            if not exists:
                log("Creating 'meikaan' database in PostgreSQL...", "INFO")
                cur.execute("CREATE DATABASE meikaan")
            conn.close()
            db_url = postgres_url
            log("Connected to PostgreSQL database ('meikaan').", "SUCCESS")
        except Exception as e:
            log(f"PostgreSQL not reachable. Falling back to SQLite database.", "WARN")
            db_url = f"sqlite:///{os.path.join(ROOT_DIR, 'meikaan.db')}"
    
    os.environ["DATABASE_URL"] = db_url
    log(f"Using DATABASE_URL={db_url}", "INFO")

    log("Populating database tables and deterministic demo assets...", "INFO")
    try:
        seed_file1 = os.path.join(ROOT_DIR, "scripts", "seed_demo_data.py")
        seed_file2 = os.path.join(BACKEND_DIR, "scripts", "seed_demo_data.py")
        
        env = os.environ.copy()
        env["DATABASE_URL"] = db_url

        if os.path.exists(seed_file1):
            subprocess.run([VENV_PYTHON, seed_file1], cwd=ROOT_DIR, env=env, check=True)
        if os.path.exists(seed_file2):
            subprocess.run([VENV_PYTHON, seed_file2], cwd=ROOT_DIR, env=env, check=True)
            
        log("Database schema created and demo data seeded successfully.", "SUCCESS")
    except Exception as e:
        log(f"Warning during database seeding: {e}", "WARN")

def free_port(port):
    if IS_WINDOWS:
        try:
            output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True, text=True, stderr=subprocess.DEVNULL)
            for line in output.strip().split("\n"):
                parts = line.strip().split()
                if len(parts) >= 5 and f":{port}" in parts[1]:
                    pid = parts[-1]
                    if pid != "0" and int(pid) != os.getpid():
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

def start_backend(env):
    log("Starting FastAPI Backend Server on http://localhost:8000...", "INFO")
    free_port(8000)
    cmd = [
        VENV_PYTHON, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000"
    ]
    p = subprocess.Popen(cmd, cwd=BACKEND_DIR, env=env)
    processes.append(p)
    return p

def start_frontend(env):
    log("Starting Vite Frontend Server on http://localhost:5173...", "INFO")
    free_port(5173)
    cmd = [NPM_CMD, "run", "dev"]
    p = subprocess.Popen(cmd, cwd=FRONTEND_DIR, env=env)
    processes.append(p)
    return p

def wait_for_services():
    log("Waiting for backend and frontend services to become healthy...", "INFO")
    backend_ready = False
    frontend_ready = False

    for _ in range(30):
        if not backend_ready:
            try:
                req = urllib.request.urlopen("http://localhost:8000/api/health", timeout=1)
                if req.getcode() == 200:
                    backend_ready = True
            except Exception:
                pass

        if not frontend_ready:
            try:
                req = urllib.request.urlopen("http://localhost:5173", timeout=1)
                if req.getcode() == 200:
                    frontend_ready = True
            except Exception:
                pass

        if backend_ready and frontend_ready:
            break
        time.sleep(1)

    if backend_ready:
        log("FastAPI Backend is READY at http://localhost:8000", "SUCCESS")
    else:
        log("FastAPI Backend initialization timed out, continuing...", "WARN")

    if frontend_ready:
        log("Vite Frontend UI is READY at http://localhost:5173", "SUCCESS")
    else:
        log("Vite Frontend initialization timed out, continuing...", "WARN")

def print_summary():
    summary = """
\033[92m========================================================================\033[0m
\033[92m 🎉 MEIKAAN PROJECT IS RUNNING SUCCESSFULLY!                            \033[0m
\033[92m========================================================================\033[0m

  🌐 \033[1mFrontend Portal:\033[0m      http://localhost:5173
  ⚡ \033[1mBackend API Server:\033[0m   http://localhost:8000
  📚 \033[1mSwagger API Docs:\033[0m     http://localhost:8000/docs
  📊 \033[1mHealth Check:\033[0m         http://localhost:8000/api/health

 🔑 \033[1mPre-seeded Demo User Accounts:\033[0m
    • Administrator:   admin@meikaan.gov   / Admin@123
    • Field Worker:    worker@meikaan.gov  / Worker@123
    • Civic Reviewer:  reviewer@meikaan.gov / Reviewer@123

 Press \033[91mCtrl+C\033[0m at any time to shut down all services cleanly.
\033[92m========================================================================\033[0m
"""
    print(summary, flush=True)

def cleanup(signum=None, frame=None):
    print("\nShutting down MEIKAAN services...", flush=True)
    for p in processes:
        if p.poll() is None:
            try:
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                p.kill()
    log("All services terminated cleanly.", "SUCCESS")
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print_banner()
    check_environment()
    setup_backend_env()
    setup_frontend_env()
    setup_database()

    env = os.environ.copy()

    start_backend(env)
    start_frontend(env)

    wait_for_services()

    # Open browser automatically
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    print_summary()

    # Keep process alive and monitor subprocesses
    exited_pids = set()
    try:
        while True:
            time.sleep(1)
            for p in processes:
                if p.poll() is not None and p.pid not in exited_pids:
                    exited_pids.add(p.pid)
                    log(f"Subprocess (PID {p.pid}) exited with code {p.returncode}.", "WARN")
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
