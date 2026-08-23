#!/usr/bin/env python3
"""
Generate a printable flowchart for the Minecraft escape room.

Edit the FLOW list below, then run:
    python generate_flowchart.py

Output: flowchart.svg (open in browser and print)
"""

from dataclasses import dataclass
from typing import Optional
import subprocess
import os

# =============================================================================
# EDIT THIS SECTION - The game flow
# =============================================================================

@dataclass
class Step:
    """A single step in the game flow."""
    name: str                           # Short name for the step
    type: str                           # "craft", "location", "action", "item", "start", "end"
    details: Optional[str] = None       # Items found, requirements, etc.
    craft_recipe: Optional[str] = None  # Recipe if it's a craft step

# THE FLOW - Edit this list to change the flowchart!
FLOW = [
    Step("START", "start", "Kids receive Explorer's Journal"),
    
    Step("Find Oak Planks", "item", "4 Oak Planks + Sticks near campsite"),
    Step("CRAFT: Crafting Table", "craft", "Unlocks Explorer Tent", "4 Oak Planks"),
    
    Step("Explorer Tent", "location", "Loot: 4 Iron, Redstone, Coal, Sticks"),
    Step("CRAFT: Compass", "craft", "Get Direction Card #1", "4 Iron + 1 Redstone"),
    
    Step("Follow Waypoints", "location", "Find: 3 Cobblestone, 2 String, Sticks"),
    Step("CRAFT: Stone Pickaxe", "craft", "Unlocks Old Mine", "3 Cobblestone + 2 Sticks"),
    
    Step("Old Mine", "location", "Find: 8 Paper, String, 2 Copper"),
    Step("CRAFT: Map", "craft", "Reveals locations on iPad!", "8 Paper + Compass"),
    
    Step("Villager (1st)", "location", "Get Fishing Pole recipe"),
    Step("CRAFT: Fishing Pole", "craft", None, "3 Sticks + 2 String"),
    
    Step("Stream - Fish!", "location", "Catch: 3 Diamonds! Map shows Sand"),
    Step("CRAFT: Diamond Pickaxe", "craft", "Unlocks Ancient Quarry", "3 Diamonds + 2 Sticks"),
    
    Step("Ancient Quarry", "location", "Find: Emerald, Amethyst, 2 Iron"),
    Step("Villager (Trade)", "location", "Trade Emerald → Torch & Sword recipes"),
    
    Step("CRAFT: Torch", "craft", "Unlocks Dark Cave", "1 Coal + 1 Stick"),
    Step("CRAFT: Iron Sword", "craft", "For defeating Creeper", "2 Iron + 1 Stick"),
    
    Step("Dark Cave", "location", "Find: Spyglass recipe"),
    Step("CRAFT: Spyglass", "craft", None, "1 Amethyst + 2 Copper"),
    
    Step("Tall Hill", "action", "Use Spyglass to spot Creeper"),
    Step("Defeat Creeper!", "action", "Map shows Gunpowder. Get TNT recipe."),
    
    Step("Collect Items", "item", "4 Sand (stream) + 5 Gunpowder (creeper area)"),
    Step("CRAFT: TNT", "craft", None, "5 Gunpowder + 4 Sand"),
    
    Step("BOOM!", "action", "Blow open the treasure chest"),
    Step("TREASURE!", "end", "Dragon Egg + Treats for everyone!"),
]

# =============================================================================
# SVG GENERATION - Shouldn't need to edit below here
# =============================================================================

# Colors for different step types
COLORS = {
    "craft": ("#4CAF50", "#2E7D32", "white"),      # Green
    "location": ("#2196F3", "#1565C0", "white"),   # Blue
    "action": ("#9C27B0", "#6A1B9A", "white"),     # Purple
    "item": ("#FF9800", "#EF6C00", "white"),       # Orange
    "start": ("#607D8B", "#455A64", "white"),      # Gray
    "end": ("#FFD700", "#B8860B", "black"),        # Gold
}

# Icons for step types
ICONS = {
    "craft": "⚒️",
    "location": "📍",
    "action": "⚡",
    "item": "📦",
    "start": "🎮",
    "end": "🏆",
}

def generate_svg(flow: list[Step], filename: str = "flowchart.svg"):
    """Generate an SVG flowchart from the flow list."""
    
    # Layout settings
    box_width = 280
    box_height = 70
    box_spacing = 20
    margin = 40
    arrow_size = 8
    
    # Calculate dimensions
    total_height = margin * 2 + len(flow) * (box_height + box_spacing) - box_spacing
    total_width = margin * 2 + box_width
    
    # Start SVG
    svg_parts = [
        f'<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{total_height}" viewBox="0 0 {total_width} {total_height}">',
        f'<style>',
        f'  .title {{ font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; }}',
        f'  .details {{ font-family: Arial, sans-serif; font-size: 11px; }}',
        f'  .recipe {{ font-family: monospace; font-size: 10px; fill: #666; }}',
        f'</style>',
        f'<rect width="100%" height="100%" fill="white"/>',
    ]
    
    # Draw each step
    for i, step in enumerate(flow):
        x = margin
        y = margin + i * (box_height + box_spacing)
        
        fill, stroke, text_color = COLORS.get(step.type, COLORS["action"])
        icon = ICONS.get(step.type, "")
        
        # Box with rounded corners
        svg_parts.append(
            f'<rect x="{x}" y="{y}" width="{box_width}" height="{box_height}" '
            f'rx="8" ry="8" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
        )
        
        # Step name
        svg_parts.append(
            f'<text x="{x + 10}" y="{y + 22}" fill="{text_color}" class="title">'
            f'{icon} {step.name}</text>'
        )
        
        # Details (if any)
        if step.details:
            # Truncate long details
            details = step.details if len(step.details) < 45 else step.details[:42] + "..."
            svg_parts.append(
                f'<text x="{x + 10}" y="{y + 40}" fill="{text_color}" class="details">'
                f'{details}</text>'
            )
        
        # Recipe (if craft)
        if step.craft_recipe:
            svg_parts.append(
                f'<text x="{x + 10}" y="{y + 55}" class="recipe">'
                f'Recipe: {step.craft_recipe}</text>'
            )
        
        # Arrow to next step (except for last)
        if i < len(flow) - 1:
            arrow_x = x + box_width / 2
            arrow_y1 = y + box_height
            arrow_y2 = y + box_height + box_spacing
            
            # Line
            svg_parts.append(
                f'<line x1="{arrow_x}" y1="{arrow_y1}" x2="{arrow_x}" y2="{arrow_y2}" '
                f'stroke="#333" stroke-width="2"/>'
            )
            # Arrowhead
            svg_parts.append(
                f'<polygon points="{arrow_x},{arrow_y2} '
                f'{arrow_x - arrow_size},{arrow_y2 - arrow_size} '
                f'{arrow_x + arrow_size},{arrow_y2 - arrow_size}" fill="#333"/>'
            )
    
    # Close SVG
    svg_parts.append('</svg>')
    
    # Write file
    svg_content = '\n'.join(svg_parts)
    with open(filename, 'w') as f:
        f.write(svg_content)
    
    print(f"✅ Generated {filename}")
    print(f"   {len(flow)} steps, {sum(1 for s in flow if s.type == 'craft')} crafts")
    print(f"\n   Open in browser and print, or use:")
    print(f"   - macOS: open {filename}")
    print(f"   - Convert to PDF: inkscape {filename} --export-pdf=flowchart.pdf")
    
    return filename


def generate_cheatsheet(flow: list[Step], filename: str = "cheatsheet.svg"):
    """Generate a compact one-page cheat sheet."""
    
    # Settings
    margin = 30
    col_width = 350
    row_height = 24
    header_height = 40
    
    # Separate crafts from other steps
    crafts = [s for s in flow if s.type == "craft"]
    locations = [s for s in flow if s.type == "location"]
    
    # Calculate dimensions
    max_rows = max(len(crafts), len(locations))
    total_height = margin * 2 + header_height + max_rows * row_height + 100
    total_width = margin * 3 + col_width * 2
    
    svg_parts = [
        f'<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{total_height}">',
        f'<style>',
        f'  .header {{ font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; }}',
        f'  .subheader {{ font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #333; }}',
        f'  .item {{ font-family: Arial, sans-serif; font-size: 12px; }}',
        f'  .recipe {{ font-family: monospace; font-size: 11px; fill: #666; }}',
        f'  .checkbox {{ font-family: Arial, sans-serif; font-size: 14px; }}',
        f'</style>',
        f'<rect width="100%" height="100%" fill="white"/>',
        
        # Title
        f'<text x="{total_width/2}" y="{margin + 10}" text-anchor="middle" class="header">'
        f'🎮 Minecraft Escape Room - Game Master Cheat Sheet</text>',
    ]
    
    # Left column: Flow summary
    col1_x = margin
    col1_y = margin + header_height
    
    svg_parts.append(f'<text x="{col1_x}" y="{col1_y}" class="subheader">📋 FLOW (check as completed)</text>')
    
    for i, step in enumerate(flow):
        y = col1_y + 20 + i * row_height
        icon = ICONS.get(step.type, "")
        
        # Checkbox
        svg_parts.append(f'<rect x="{col1_x}" y="{y - 12}" width="14" height="14" fill="none" stroke="#333" stroke-width="1"/>')
        
        # Step name (bold if craft)
        weight = "bold" if step.type == "craft" else "normal"
        color = "#4CAF50" if step.type == "craft" else "#333"
        svg_parts.append(
            f'<text x="{col1_x + 20}" y="{y}" class="item" fill="{color}" font-weight="{weight}">'
            f'{i}. {icon} {step.name}</text>'
        )
    
    # Right column: Crafts with recipes
    col2_x = margin + col_width + margin
    col2_y = margin + header_height
    
    svg_parts.append(f'<text x="{col2_x}" y="{col2_y}" class="subheader">⚒️ CRAFTS ({len(crafts)} total)</text>')
    
    for i, craft in enumerate(crafts):
        y = col2_y + 20 + i * (row_height + 8)
        
        svg_parts.append(f'<rect x="{col2_x}" y="{y - 12}" width="14" height="14" fill="none" stroke="#4CAF50" stroke-width="2"/>')
        svg_parts.append(f'<text x="{col2_x + 20}" y="{y}" class="item" font-weight="bold">{craft.name.replace("CRAFT: ", "")}</text>')
        
        if craft.craft_recipe:
            svg_parts.append(f'<text x="{col2_x + 20}" y="{y + 14}" class="recipe">{craft.craft_recipe}</text>')
    
    # Map reveals section
    map_y = col2_y + 20 + len(crafts) * (row_height + 8) + 30
    svg_parts.append(f'<text x="{col2_x}" y="{map_y}" class="subheader">📍 MAP REVEALS</text>')
    svg_parts.append(f'<text x="{col2_x}" y="{map_y + 20}" class="item">• After Map craft: Stream, Cave, Quarry, Villager</text>')
    svg_parts.append(f'<text x="{col2_x}" y="{map_y + 40}" class="item">• After Fishing: 4 Sand locations</text>')
    svg_parts.append(f'<text x="{col2_x}" y="{map_y + 60}" class="item">• After Creeper: 5 Gunpowder locations</text>')
    
    svg_parts.append('</svg>')
    
    svg_content = '\n'.join(svg_parts)
    with open(filename, 'w') as f:
        f.write(svg_content)
    
    print(f"✅ Generated {filename}")
    return filename


if __name__ == "__main__":
    # Generate both files
    generate_svg(FLOW, "flowchart.svg")
    print()
    generate_cheatsheet(FLOW, "cheatsheet.svg")
    
    print("\n" + "="*50)
    print("To print:")
    print("  1. Open flowchart.svg or cheatsheet.svg in browser")
    print("  2. File → Print (or Cmd+P)")
    print("="*50)
