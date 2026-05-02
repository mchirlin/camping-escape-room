// Minecraft Block & Item Models — Hollow Shell with NFC Tag Cavity
// Open in OpenSCAD → adjust parameters → F5 preview → F6 render → F7 export STL
//
// Two models: block() = full cube, item() = half-height slab
// Use # before tag_cavity() to see it highlighted through the walls

// ============================================================
// PARAMETERS
// ============================================================

BLOCK_SIZE_IN   = 2;        // side length in inches
ITEM_HEIGHT_IN  = 1;        // item slab height in inches

WALL_THICKNESS  = 2.5;      // mm — shell wall thickness (all sides)

// NFC tag (NTAG215 25mm coin)
TAG_DIAMETER    = 26;       // mm — slightly oversized for easy drop-in
TAG_THICKNESS   = 1.2;      // mm
TAG_CLEARANCE   = 0.4;      // mm extra around the tag

// Tag placement
TAG_CENTERED    = true;     // true = middle (any orientation), false = near bottom

// Spherical magnets at corners (self-aligning polarity)
MAGNET_ENABLED  = true;     // set false to skip magnets
MAGNET_DIAMETER = 5;        // mm — 5mm ball bearing magnets
MAGNET_INSET    = 0.5;      // mm — how far inside the corner the center sits
MAGNET_CLEARANCE= 0.3;      // mm — extra room for drop-in

// Corner rounding (0 for sharp)
CORNER_RADIUS   = 1.0;      // mm

// ============================================================
// COMPUTED
// ============================================================

IN_TO_MM = 25.4;
block_size = BLOCK_SIZE_IN * IN_TO_MM;
item_height = ITEM_HEIGHT_IN * IN_TO_MM;

cavity_d = TAG_DIAMETER + TAG_CLEARANCE * 2;
cavity_h = TAG_THICKNESS + TAG_CLEARANCE;
w = WALL_THICKNESS;

echo(str("=== Block: ", block_size, "mm (", BLOCK_SIZE_IN, "\")"));
echo(str("=== Item: ", item_height, "mm (", ITEM_HEIGHT_IN, "\")"));
echo(str("=== Wall: ", w, "mm"));
echo(str("=== Tag placement: ", TAG_CENTERED ? "CENTERED" : "BOTTOM"));

if (!TAG_CENTERED) {
    echo(str("=== PAUSE AT: ", w + cavity_h, "mm to insert tag"));
} else {
    echo(str("=== PAUSE BLOCK AT: ", block_size/2 + cavity_h/2, "mm"));
    echo(str("=== PAUSE ITEM AT: ", item_height/2 + cavity_h/2, "mm"));
}

// ============================================================
// MODULES
// ============================================================

module rounded_cube(size, r) {
    if (r > 0) {
        minkowski() {
            cube([size[0]-2*r, size[1]-2*r, size[2]-2*r], center=true);
            sphere(r=r, $fn=20);
        }
    } else {
        cube(size, center=true);
    }
}

module shell(outer_size, wall) {
    // Hollow box: solid walls on all 6 sides
    difference() {
        rounded_cube(outer_size, CORNER_RADIUS);
        cube([outer_size[0]-2*wall, outer_size[1]-2*wall, outer_size[2]-2*wall], center=true);
    }
}

module tag_shelf(model_height) {
    // Disc platform at center height to hold the tag,
    // connected to the walls by 4 diagonal ribs (45°) for clean printing
    shelf_h = cavity_h + 1.0;
    rib_w = 2.5;
    diag = (block_size - 2*w) * sqrt(2);
    
    // The disc
    cylinder(d=cavity_d + 4, h=shelf_h, center=true, $fn=48);
    
    // 4 ribs at 45° angles (corner to corner)
    for (angle = [45, 135, 225, 315]) {
        rotate([0, 0, angle])
            cube([diag, rib_w, shelf_h], center=true);
    }
}

module tag_pocket(model_height) {
    // The actual cavity the tag drops into
    cylinder(d=cavity_d, h=cavity_h, center=true, $fn=48);
}

module magnet_cavities(sx, sy, sz) {
    // Spherical cavities at all 8 corners
    if (MAGNET_ENABLED) {
        mag_r = (MAGNET_DIAMETER + MAGNET_CLEARANCE * 2) / 2;
        inset = MAGNET_DIAMETER/2 + MAGNET_INSET;
        for (x = [-1, 1])
            for (y = [-1, 1])
                for (z = [-1, 1])
                    translate([x*(sx/2-inset), y*(sy/2-inset), z*(sz/2-inset)])
                        sphere(r=mag_r, $fn=24);
    }
}

module block() {
    translate([0, 0, block_size/2]) {
        difference() {
            union() {
                shell([block_size, block_size, block_size], w);
                if (TAG_CENTERED) {
                    tag_shelf(block_size);
                }
            }
            if (TAG_CENTERED) {
                tag_pocket(block_size);
            } else {
                translate([0, 0, w + cavity_h/2 - block_size/2])
                    tag_pocket(block_size);
            }
            magnet_cavities(block_size, block_size, block_size);
        }
    }
}

module item() {
    translate([0, 0, item_height/2]) {
        difference() {
            union() {
                shell([block_size, block_size, item_height], w);
                if (TAG_CENTERED) {
                    tag_shelf(item_height);
                }
            }
            if (TAG_CENTERED) {
                tag_pocket(item_height);
            } else {
                translate([0, 0, w + cavity_h/2 - item_height/2])
                    tag_pocket(item_height);
            }
            magnet_cavities(block_size, block_size, item_height);
        }
    }
}

// ============================================================
// RENDER — uncomment one, then F6 → F7
// ============================================================

// block();
// item();

// Cross-section view (uncomment to see inside):

difference() {
     item();
     translate([block_size/2, 0, 0])
         cube([block_size, block_size*2, block_size*2], center=true);
 }
