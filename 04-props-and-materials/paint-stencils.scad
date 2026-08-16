// Paint Stencils for Minecraft Block Pixel Details
// Print flat, use as masks for painting pixel variations on block faces.
//
// 1 pixel = 1.75" = 44.45mm

// ============================================================
// PARAMETERS
// ============================================================

PIXEL_MM        = 1.75 * 25.4;   // 44.45mm
STENCIL_THICK   = 2.0;           // mm — rigid enough to handle at this size
BORDER          = 5.0;           // mm — border around cutouts for rigidity

echo(str("Pixel size: ", PIXEL_MM, "mm (1.75\")"));

// ============================================================
// 1-PIXEL STENCIL — single square cutout, lay over surface and paint
// ============================================================
module stencil_1px() {
    frame = PIXEL_MM + 2 * BORDER;
    difference() {
        cube([frame, frame, STENCIL_THICK], center=true);
        cube([PIXEL_MM, PIXEL_MM, STENCIL_THICK + 1], center=true);
    }
}

// ============================================================
// 2-PIXEL STENCIL — 2×1 rectangular cutout
// ============================================================
module stencil_2px() {
    frame_x = 2 * PIXEL_MM + 2 * BORDER;
    frame_y = PIXEL_MM + 2 * BORDER;
    difference() {
        cube([frame_x, frame_y, STENCIL_THICK], center=true);
        cube([2 * PIXEL_MM, PIXEL_MM, STENCIL_THICK + 1], center=true);
    }
}

// ============================================================
// 1-PIXEL TRACE BLOCK — solid square you trace around with a pencil/marker
// ============================================================
module trace_1px() {
    cube([PIXEL_MM, PIXEL_MM, STENCIL_THICK], center=true);
}

// ============================================================
// RENDER — all three spaced apart
// ============================================================

translate([0, 0, STENCIL_THICK/2])
    stencil_1px();

translate([0, PIXEL_MM + 2*BORDER + 10, STENCIL_THICK/2])
    stencil_2px();

translate([0, 2*(PIXEL_MM + 2*BORDER + 10), STENCIL_THICK/2])
    trace_1px();
