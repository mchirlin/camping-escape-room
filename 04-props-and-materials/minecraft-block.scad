// Minecraft Block — Hollow cube with NFC tag cavity at bottom
// Print upright. Bottom is solid with tag pocket (pause-at-layer to insert).
// Above the tag: a few solid layers seal it in, then hollow walls to the top.
//
// Open in OpenSCAD → F5 preview → F6 render → F7 export STL

// ============================================================
// PARAMETERS
// ============================================================

BLOCK_SIZE_IN   = 2.5;          // side length in inches
WALL_THICKNESS  = 2.5;          // mm — wall thickness (sides + top)
FLOOR_THICKNESS = 3.0;          // mm — solid bottom floor

// NFC tag (NTAG215 25mm coin) — same as item models
TAG_DIAMETER    = 26;           // mm — slightly oversized for easy drop-in
TAG_THICKNESS   = 1.2;          // mm
TAG_CLEARANCE   = 0.4;          // mm extra around the tag

// Corner rounding (0 for sharp)
CORNER_RADIUS   = 1.0;          // mm

// ============================================================
// COMPUTED
// ============================================================

IN_TO_MM = 25.4;
block_size = BLOCK_SIZE_IN * IN_TO_MM;
w = WALL_THICKNESS;
floor_h = FLOOR_THICKNESS;

cavity_d = TAG_DIAMETER + TAG_CLEARANCE * 2;
cavity_h = TAG_THICKNESS + TAG_CLEARANCE;

// The solid bottom section: floor + tag pocket + seal layers above tag
seal_layers = 2.0;  // mm of solid plastic above the tag to seal it in
solid_bottom = floor_h + cavity_h + seal_layers;

echo(str("Block: ", block_size, "mm (", BLOCK_SIZE_IN, "\")"));
echo(str("Tag cavity: ", cavity_d, "mm dia x ", cavity_h, "mm deep"));
echo(str("Solid bottom: ", solid_bottom, "mm (floor + tag + seal)"));
echo(str("PAUSE AT: ", floor_h + cavity_h, "mm to insert tag"));
echo(str("Hollow starts at: ", solid_bottom, "mm"));

// ============================================================
// MODEL
// ============================================================

module block() {
    difference() {
        // Outer cube
        translate([0, 0, block_size/2])
            cube([block_size, block_size, block_size], center=true);
        
        // Hollow interior — starts above the solid bottom, open up to the
        // underside of the top wall. Walls on all 4 sides.
        translate([0, 0, solid_bottom + (block_size - solid_bottom - w)/2])
            cube([block_size - 2*w, block_size - 2*w, block_size - solid_bottom - w], center=true);
        
        // Tag pocket — circular cavity in the solid floor area
        // Centered in XY, sits on top of the floor
        translate([0, 0, floor_h + cavity_h/2])
            cylinder(d=cavity_d, h=cavity_h + 0.1, center=true, $fn=48);
    }
}

block();

// Cross-section view (uncomment to see inside):
//difference() {
//     block();
//     translate([block_size/2, 0, 0])
//         cube([block_size, block_size*2, block_size*2], center=true);
// }
