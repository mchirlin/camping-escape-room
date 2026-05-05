// stick (double-wide) — Minecraft Item Shape 3D Model
// Based on stick.png but widened to 5 pixels across for RFID cavity clearance
//
// Open in OpenSCAD → F5 preview → F6 render → F7 export STL

// ============================================================
// PARAMETERS
// ============================================================

GRID_SIZE_IN    = 3.0;           // crafting table slot size
PIXELS          = 13;            // grid divisions (shape-fitted)
PIXEL_MM        = (GRID_SIZE_IN * 25.4) / PIXELS;  // mm per pixel (~5.86mm)

DEPTH_IN        = 0.5;          // extrusion depth in inches
DEPTH_MM        = DEPTH_IN * 25.4;

// NFC tag — small rectangular RFID sensor (10mm × 20mm)
// Rotated 45° to align with the stick's diagonal axis.
// 4-pixel-wide stick (~23.4mm perpendicular to grid).
// Perpendicular to diagonal axis: 4 * 5.86 * sin(45°) ≈ 16.6mm
// Cavity rotated 45° needs ~10.6mm width → leaves ~3mm wall per side.
TAG_WIDTH       = 10;           // mm (short side)
TAG_LENGTH      = 20;           // mm (long side)
TAG_THICKNESS   = 1.0;         // mm
TAG_CLEARANCE   = 0.1;         // mm extra around tag

cavity_w = TAG_WIDTH + TAG_CLEARANCE * 2;
cavity_l = TAG_LENGTH + TAG_CLEARANCE * 2;
cavity_h = TAG_THICKNESS + TAG_CLEARANCE;

echo(str("Pixel size: ", PIXEL_MM, "mm"));
echo(str("Footprint: ", PIXELS * PIXEL_MM, "mm = ", GRID_SIZE_IN, " in"));
echo(str("Depth: ", DEPTH_MM, "mm = ", DEPTH_IN, " in"));
echo(str("Tag cavity: ", cavity_w, "mm × ", cavity_l, "mm × ", cavity_h, "mm deep (rotated 45°)"));
echo(str("PAUSE AT: ", DEPTH_MM / 2 + cavity_h / 2, "mm to insert tag"));

module tag_cavity() {
    // True centroid of the 4-wide stick shape
    cx = 6.27 * PIXEL_MM;
    cy = 6.73 * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2])
        rotate([0, 0, -45])
            translate([-cavity_w / 2, -cavity_l / 2, 0])
                cube([cavity_w, cavity_l, cavity_h + 0.1]);
}

module tag_shelf() {
    cx = 6.27 * PIXEL_MM;
    cy = 6.73 * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2 - 1.0])
        rotate([0, 0, -45])
            translate([-(cavity_w + 4) / 2, -(cavity_l + 4) / 2, 0])
                cube([cavity_w + 4, cavity_l + 4, 1.0]);
}

// ============================================================
// PIXEL MAP — 4-pixel-wide stick (1 pixel added to one side of original 3-wide)
// Original stick runs from (0,11) to (12,0) at 3px wide.
// This version adds 1 pixel on one side of the original band.
// ============================================================

item_pixels = [
    // Bottom-left end
    [0.0,10.0], [0.0,11.0], [0.0,12.0],
    [1.0,9.0], [1.0,10.0], [1.0,11.0], [1.0,12.0],

    // Middle sections: original 3 wide + 1 extra = 4 wide
    [2.0,8.0], [2.0,9.0], [2.0,10.0], [2.0,11.0],
    [3.0,7.0], [3.0,8.0], [3.0,9.0], [3.0,10.0],
    [4.0,6.0], [4.0,7.0], [4.0,8.0], [4.0,9.0],
    [5.0,5.0], [5.0,6.0], [5.0,7.0], [5.0,8.0],
    [6.0,4.0], [6.0,5.0], [6.0,6.0], [6.0,7.0],
    [7.0,3.0], [7.0,4.0], [7.0,5.0], [7.0,6.0],
    [8.0,2.0], [8.0,3.0], [8.0,4.0], [8.0,5.0],
    [9.0,1.0], [9.0,2.0], [9.0,3.0], [9.0,4.0],
    [10.0,0.0], [10.0,1.0], [10.0,2.0], [10.0,3.0],

    // Top-right end
    [11.0,0.0], [11.0,1.0], [11.0,2.0],
    [12.0,0.0], [12.0,1.0]
];

// ============================================================
// MODULES
// ============================================================

module pixel_block(col, row) {
    translate([col * PIXEL_MM, (PIXELS - 1 - row) * PIXEL_MM, 0])
        cube([PIXEL_MM, PIXEL_MM, DEPTH_MM]);
}

module item_shape() {
    for (i = [0 : len(item_pixels) - 1])
        pixel_block(item_pixels[i][0], item_pixels[i][1]);
}

module item_final() {
    difference() {
        union() {
            item_shape();
            intersection() {
                item_shape();
                tag_shelf();
            }
        }
        tag_cavity();
    }
}

item_final();

// Cross-section view (uncomment to see tag cavity):
// difference() {
//     item_final();
//     translate([6.5 * PIXEL_MM, -50, -1])
//         cube([100, 200, 100]);
// }
