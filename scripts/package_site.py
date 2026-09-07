"""Stage only public app files for GitHub Pages; never package credentials or source tooling."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '.local' / 'site'
PUBLIC = ('index.html', 'style.css', 'concerts.css', 'script.js', 'concerts-core.js',
          'concerts.js', 'concerts.json', 'manifest.json', 'sw.js', 'beer-bottle.png', 'sg-guitar.jpg')


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # Remove the retired icon only from our generated staging directory.
    (OUTPUT / 'guitar.svg').unlink(missing_ok=True)
    # Refuse unexpected files instead of accidentally publishing a reused directory.
    for file in OUTPUT.rglob('*'):
        if file.is_file() and file.relative_to(OUTPUT).as_posix() not in (*PUBLIC, 'licenses/lucide.txt', '.nojekyll'):
            raise RuntimeError('Unexpected file in site staging directory')
    for name in PUBLIC:
        shutil.copy2(ROOT / name, OUTPUT / name)
    (OUTPUT / 'licenses').mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'licenses/lucide.txt', OUTPUT / 'licenses/lucide.txt')
    (OUTPUT / '.nojekyll').touch()
    print('Public app staged in .local/site')


if __name__ == '__main__':
    main()
