"""Makes the iOS copies of Baloo 2 (OFL-1.1) with line metrics for Latin text.

Baloo 2 declares an ascent of 1078 and a descent of 524 (per 1000) to fit Devanagari. Its Latin
letters, digits and symbols only reach 711 up and 198 down. iOS keeps the declared descent below
the baseline and clips the top of the line when `lineHeight` is smaller than the declared height,
so tight display text lost the tops of its letters. These copies declare 950 / 250 instead.
Android keeps the original files: it lays the lines out without clipping.

Run from apps/mobile after changing the Baloo 2 package version:
    python3 -m venv .venv-fonts && .venv-fonts/bin/pip install fonttools==4.60.1
    .venv-fonts/bin/python scripts/fix-baloo-ios-metrics.py
"""

from pathlib import Path
import shutil
import subprocess

from fontTools.ttLib import TTFont

ASCENT = 950
DESCENT = 250
WEIGHTS = ["700Bold", "800ExtraBold"]

package = Path(
    subprocess.check_output(
        ["node", "-p", "require('path').dirname(require.resolve('@expo-google-fonts/baloo-2/package.json'))"],
        text=True,
    ).strip()
)
out = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "baloo-ios"
out.mkdir(parents=True, exist_ok=True)

for weight in WEIGHTS:
    font = TTFont(package / weight / f"Baloo2_{weight}.ttf")
    font["hhea"].ascent = ASCENT
    font["hhea"].descent = -DESCENT
    font["hhea"].lineGap = 0
    os2 = font["OS/2"]
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, -DESCENT, 0
    os2.usWinAscent, os2.usWinDescent = ASCENT, DESCENT
    font.save(out / f"Baloo2_{weight}.ttf")
    print(f"wrote {out / f'Baloo2_{weight}.ttf'}")

# The OFL travels with the fonts.
shutil.copy(package / "LICENSE_FONT", out / "OFL.txt")
