// string — Minecraft Item Shape 3D Model
// Auto-generated from minecraft/textures/item/string.png
//
// Open in OpenSCAD → F5 preview → F6 render → F7 export STL

// ============================================================
// PARAMETERS
// ============================================================

GRID_SIZE_IN    = 3.0;           // crafting table slot size
PIXELS          = 14;              // grid divisions (shape-fitted)
PIXEL_MM        = (GRID_SIZE_IN * 25.4) / PIXELS;  // mm per pixel

DEPTH_IN        = 0.5;          // extrusion depth in inches
DEPTH_MM        = DEPTH_IN * 25.4;

// NFC tag (NTAG215 25mm coin)
TAG_DIAMETER    = 26;           // mm — slightly oversized for easy drop-in
TAG_THICKNESS   = 1.2;         // mm
TAG_CLEARANCE   = 0.4;         // mm extra around tag

cavity_d = TAG_DIAMETER + TAG_CLEARANCE * 2;
cavity_h = TAG_THICKNESS + TAG_CLEARANCE;

echo(str("Tag cavity: ", cavity_d, "mm dia × ", cavity_h, "mm deep"));
echo(str("PAUSE AT: ", DEPTH_MM / 2 + cavity_h / 2, "mm to insert tag"));

module tag_cavity() {
    cx = (6.5 + 0.5) * PIXEL_MM;
    cy = (PIXELS - 1 - 6.5 + 0.5) * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2])
        cylinder(d = cavity_d, h = cavity_h + 0.1, $fn = 48);
}

module tag_shelf() {
    cx = (6.5 + 0.5) * PIXEL_MM;
    cy = (PIXELS - 1 - 6.5 + 0.5) * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2 - 1.0])
        cylinder(d = cavity_d + 4, h = 1.0, $fn = 48);
}

echo(str("Pixel size: ", PIXEL_MM, "mm"));
echo(str("Footprint: ", PIXELS * PIXEL_MM, "mm = ", GRID_SIZE_IN, " in"));
echo(str("Depth: ", DEPTH_MM, "mm = ", DEPTH_IN, " in"));

// ============================================================
// PIXEL MAP — 75 opaque pixels
// ============================================================

item_pixels = [
    [0.5,6.0], [0.5,7.0], [0.5,8.0], [1.5,5.0], [1.5,6.0], [1.5,8.0], [1.5,9.0], [2.5,4.0],
    [2.5,5.0], [2.5,9.0], [2.5,10.0], [3.5,7.0], [3.5,8.0], [3.5,9.0], [3.5,10.0], [4.5,6.0],
    [4.5,7.0], [4.5,8.0], [4.5,9.0], [4.5,10.0], [4.5,11.0], [5.5,6.0], [5.5,7.0], [5.5,9.0],
    [5.5,10.0], [5.5,11.0], [6.5,6.0], [6.5,7.0], [6.5,10.0], [6.5,11.0], [6.5,12.0], [7.5,1.0],
    [7.5,2.0], [7.5,3.0], [7.5,6.0], [7.5,7.0], [7.5,10.0], [7.5,11.0], [7.5,12.0], [7.5,13.0],
    [8.5,0.0], [8.5,1.0], [8.5,3.0], [8.5,4.0], [8.5,7.0], [8.5,8.0], [8.5,10.0], [8.5,11.0],
    [8.5,12.0], [8.5,13.0], [9.5,1.0], [9.5,2.0], [9.5,3.0], [9.5,4.0], [9.5,7.0], [9.5,8.0],
    [9.5,9.0], [9.5,10.0], [9.5,12.0], [9.5,13.0], [10.5,4.0], [10.5,5.0], [10.5,8.0], [10.5,9.0],
    [10.5,11.0], [10.5,12.0], [11.5,5.0], [11.5,6.0], [11.5,10.0], [11.5,11.0], [12.5,6.0], [12.5,7.0],
    [12.5,8.0], [12.5,9.0], [12.5,10.0]
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
//     translate([8 * PIXEL_MM + 50, 0, 0])
//         cube([100, 200, 100]);
// }
