"""Load only Magic Compass's own Windows-encrypted Ticketmaster credential.

Environment variables (including Actions secrets) take precedence. Never log
subprocess output, which can contain the key or sensitive paths.
"""
import os
from pathlib import Path
import subprocess
import shutil


def load_ticketmaster_key(root, environ=None, platform=None, run=None):
    environ = os.environ if environ is None else environ
    if environ.get('TICKETMASTER_API_KEY', '').strip():
        return 'environment'
    key_file = Path(root) / '.local' / 'ticketmaster-key.xml'
    if (os.name if platform is None else platform) != 'nt' or not key_file.is_file():
        return 'absent'
    command = ("$ErrorActionPreference='Stop'; "
               "$stored=Import-Clixml -LiteralPath $env:MAGIC_COMPASS_TICKETMASTER_KEY_FILE; "
               "if ($stored -isnot [System.Security.SecureString]) { exit 1 }; "
               "[System.Net.NetworkCredential]::new('', $stored).Password")
    try:
        result = (run or subprocess.run)(
            [shutil.which('pwsh') or 'powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
            env={**environ, 'MAGIC_COMPASS_TICKETMASTER_KEY_FILE': str(key_file)},
            capture_output=True, text=True, timeout=20, check=False,
            creationflags=0x08000000,  # CREATE_NO_WINDOW
        )
        value = result.stdout.strip()
        if result.returncode != 0 or not value or len(value) > 300 or any(c.isspace() for c in value):
            raise ValueError('Invalid saved credential')
    except Exception:
        raise RuntimeError('Saved Ticketmaster key could not be unlocked. Run scripts/connect-ticketmaster.ps1 again under your Windows account.') from None
    environ['TICKETMASTER_API_KEY'] = value
    return 'encrypted_local'
