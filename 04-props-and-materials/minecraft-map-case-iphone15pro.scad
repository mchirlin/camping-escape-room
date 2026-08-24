// ============================================================
// Minecraft Map iPhone 15 Pro Case — TPU
// ============================================================
// Outer shape: the Minecraft filled_map.png texture extruded.
// Phone pocket: rotated to align with the map's tilt.
//
// TWEAK THIS: adjust phone_angle until the pocket fits nicely
// inside the map shape without poking through any edges.
// ============================================================

// === TWEAK THESE ===
phone_angle = 55;   // rotation of phone pocket (degrees, CW)
pixel = 16;         // mm per texture pixel (controls overall size)
// ===================

// --- Phone dimensions (iPhone 15 Pro) ---
phone_h = 146.6;
phone_w = 70.6;
phone_d = 8.25;

// --- Case parameters ---
clearance = 0.4;
bottom = 1.2;
lip = 1.5;          // front lip — wraps over screen edge to hold phone securely
case_d = phone_d + clearance + bottom + lip;  // total thickness includes lip

// Phone pocket dimensions
pocket_h = phone_h + clearance * 2;
pocket_w = phone_w + clearance * 2;
pocket_d = phone_d + clearance;
corner_r = 8.0;

// --- Map center in pixel coords ---
map_cx = 8;
map_cy = 7.5;

// --- 2D rounded rectangle ---
module rounded_rect_2d(w, h, r) {
    offset(r=r) offset(delta=-r)
        square([w, h], center=true);
}

// --- Map shape from filled_map.png alpha channel ---
module map_shape_2d() {
    pixels = [
        [9,2],[10,2],
        [8,3],[9,3],[10,3],[11,3],
        [6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],
        [5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5],
        [3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
        [2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],
        [1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
        [3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],
        [4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],
        [5,12],[6,12],[7,12],[8,12],[9,12],
        [6,13],[7,13]
    ];
    
    for (p = pixels) {
        translate([(p[0] - map_cx) * pixel, -(p[1] - map_cy) * pixel])
            square(pixel, center=true);
    }
}

// --- Main case ---
module case_body() {
    difference() {
        // Solid map shape
        linear_extrude(height=case_d)
            map_shape_2d();
        
        // Phone pocket — rotated to match map tilt
        // Only goes up to the lip height (leaves material on front face)
        translate([0, 0, bottom])
            linear_extrude(height=pocket_d)
                rotate([0, 0, -phone_angle])
                    rounded_rect_2d(pocket_w, pocket_h, corner_r);
        
        // Screen opening (front face) — smaller than pocket, creates the retaining lip
        translate([0, 0, bottom + pocket_d - 0.1])
            linear_extrude(height=lip + 1)
                rotate([0, 0, -phone_angle])
                    rounded_rect_2d(pocket_w - lip*2, pocket_h - lip*2, corner_r - lip);
        
        // Camera module cutout (back face, top-right of phone when face-down)
        // iPhone 15 Pro: ~38x36mm rounded square, offset from top-right corner
        // (camera is top-left on the phone's back, which mirrors to the right when face-down)
        rotate([0, 0, -phone_angle])
            translate([pocket_w/2 - 43, pocket_h/2 - 42, -1])
                linear_extrude(height=bottom + 2)
                    offset(r=5) offset(delta=-5)
                        square([38, 38]);
    }
}

// --- Render ---
$fn = 32;
case_body();
