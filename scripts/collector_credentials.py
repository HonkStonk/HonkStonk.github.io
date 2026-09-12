"""Load only Magic Compass's own Windows-encrypted API credentials.

Environment variables (including Actions secrets) take precedence. Never log
subprocess output, which can contain the key or sensitive paths.
"""
import os
from pathlib import Path
import subprocess
import shutil


def _load_key(root, provider, environ=None, platform=None, run=None):
    environ = os.environ if environ is None else environ
    variable = provider.upper() + '_API_KEY'
    if environ.get(variable, '').strip():
        return 'environment'
    key_file = Path(root) / '.local' / (provider.lower() + '-key.xml')
    if (os.name if platform is None else platform) != 'nt' or not key_file.is_file():
        return 'absent'
    command = ("$ErrorActionPreference='Stop'; "
               "$stored=Import-Clixml -LiteralPath $env:MAGIC_COMPASS_API_KEY_FILE; "
               "if ($stored -isnot [System.Security.SecureString]) { exit 1 }; "
               "[System.Net.NetworkCredential]::new('', $stored).Password")
    try:
        result = (run or subprocess.run)(
            [shutil.which('pwsh') or 'powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
            env={**environ, 'MAGIC_COMPASS_API_KEY_FILE': str(key_file)},
            capture_output=True, text=True, timeout=20, check=False,
            creationflags=0x08000000,  # CREATE_NO_WINDOW
        )
        value = result.stdout.strip()
        if result.returncode != 0 or not value or len(value) > 300 or any(c.isspace() for c in value):
            raise ValueError('Invalid saved credential')
    except Exception:
        raise RuntimeError(f'Saved {provider.title()} key could not be unlocked. Run scripts/connect-{provider.lower()}.ps1 again under your Windows account.') from None
    environ[variable] = value
    return 'encrypted_local'


def load_ticketmaster_key(root, environ=None, platform=None, run=None):
    return _load_key(root, 'ticketmaster', environ, platform, run)


def load_tickster_key(root, environ=None, platform=None, run=None):
    return _load_key(root, 'tickster', environ, platform, run)
