#!/usr/bin/env python3
"""Download Minecraft inventory icons from the wiki and install as fog map markers.

Usage:
    python3 download_marker.py Oak_Planks wood
    python3 download_marker.py Crafting_Table crafting
    python3 download_marker.py Sand sand
    python3 download_marker.py TNT tnt

First arg: Wiki item name (as in the Invicon URL, use underscores for spaces)
Second arg: Marker filename (without .png)
"""

import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MARKERS_PUBLIC = os.path.join(SCRIPT_DIR, "public", "markers")
MARKERS_DIST = os.path.join(SCRIPT_DIR, "dist", "markers")
WIKI_URL = "https://minecraft.wiki/images/Invicon_{name}.png"


def download_marker(wiki_name, marker_name):
    url = WIKI_URL.format(name=wiki_name)
    for dest_dir in [MARKERS_PUBLIC, MARKERS_DIST]:
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, f"{marker_name}.png")
        result = subprocess.run(["curl", "-sL", url, "-o", dest], capture_output=True)
        if result.returncode == 0 and os.path.getsize(dest) > 100:
            print(f"  ✓ {dest}")
        else:
            print(f"  ✗ {dest} — download failed")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 download_marker.py <Wiki_Item_Name> <marker_name>")
        print()
        print("Examples:")
        print("  python3 download_marker.py Oak_Planks wood")
        print("  python3 download_marker.py Crafting_Table crafting")
        print("  python3 download_marker.py Sand sand")
        print("  python3 download_marker.py TNT tnt")
        print("  python3 download_marker.py Gunpowder gunpowder")
        print("  python3 download_marker.py Redstone_Dust redstone")
        sys.exit(1)

    wiki_name = sys.argv[1]
    marker_name = sys.argv[2]
    print(f"Downloading Invicon_{wiki_name}.png → {marker_name}.png")
    download_marker(wiki_name, marker_name)
    print("Done!")
