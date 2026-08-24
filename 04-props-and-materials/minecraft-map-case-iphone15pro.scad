// ============================================================
// Minecraft Map iPhone 15 Pro Case — TPU
// ============================================================
// Outer shape: derived from Minecraft's map_background.png texture.
// Rectangular map with pixelated ragged edges.
// Phone sits straight (no rotation) inside the map border.
// ============================================================

// === TWEAK THESE ===
border_h = 16;      // mm of map border on top and bottom
border_w = 30;      // mm of map border on left and right — wider to look less rectangular
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

// --- Map texture grid (stretched to rectangle) ---
map_cols = 64;
map_rows = 64;
map_cx = map_cols / 2;
map_cy = map_rows / 2;

// Compute pixel scale per axis so border looks right around the phone
pixel_x = (pocket_w + border_w * 2) / map_cols;
pixel_y = (pocket_h + border_h * 2) / map_rows;

// --- 2D rounded rectangle ---
module rounded_rect_2d(w, h, r) {
    offset(r=r) offset(delta=-r)
        square([w, h], center=true);
}

// --- Map shape from map_background.png alpha channel ---
// Each span is [row, start_col, end_col] representing a solid horizontal run.
module map_shape_2d() {
    spans = [
        // Row 0 (top edge — ragged)
        [0,0,1],[0,17,19],[0,22,27],[0,29,32],[0,37,48],[0,61,63],
        // Row 1
        [1,0,10],[1,13,20],[1,22,33],[1,35,63],
        // Rows 2–61 (solid body with edge nibbles)
        [2,0,63],
        [3,0,62],
        [4,1,63],
        [5,1,63],
        [6,0,63],
        [7,0,63],
        [8,0,63],
        [9,0,62],
        [10,0,62],
        [11,1,62],
        [12,1,63],
        [13,1,63],
        [14,1,63],
        [15,1,63],
        [16,2,63],
        [17,1,63],
        [18,1,63],
        [19,1,63],
        [20,1,62],
        [21,1,62],
        [22,1,62],
        [23,1,62],
        [24,0,63],
        [25,0,63],
        [26,0,63],
        [27,0,63],
        [28,1,63],
        [29,1,63],
        [30,1,63],
        [31,1,63],
        [32,1,63],
        [33,1,62],
        [34,1,62],
        [35,1,63],
        [36,1,63],
        [37,1,63],
        [38,0,63],
        [39,0,62],
        [40,0,62],
        [41,1,63],
        [42,2,63],
        [43,1,63],
        [44,0,63],
        [45,0,63],
        [46,0,63],
        [47,0,63],
        [48,0,63],
        [49,0,63],
        [50,0,63],
        [51,0,62],
        [52,0,62],
        [53,0,62],
        [54,0,62],
        [55,0,62],
        [56,1,62],
        [57,1,63],
        [58,0,63],
        [59,0,63],
        [60,0,63],
        [61,0,63],
        // Row 62 (bottom edge — ragged)
        [62,1,5],[62,9,18],[62,21,25],[62,28,63],
        // Row 63 (bottom edge — ragged)
        [63,11,16],[63,28,36],[63,38,40],[63,42,54],[63,59,61]
    ];
    
    for (s = spans) {
        row = s[0];
        col_start = s[1];
        col_end = s[2];
        span_w = (col_end - col_start + 1) * pixel_x;
        span_cx = ((col_start + col_end) / 2 - map_cx + 0.5) * pixel_x;
        span_cy = -(row - map_cy + 0.5) * pixel_y;
        translate([span_cx, span_cy])
            square([span_w, pixel_y], center=true);
    }
}

// --- Main case ---
module case_body() {
    difference() {
        // Solid map shape
        linear_extrude(height=case_d)
            map_shape_2d();
        
        // Screen bezel parameters
        screen_bezel_top = 3;      // same 3mm lip all around
        screen_bezel_bot = 3;      // 3mm lip at bottom
        screen_bezel_side = 3;     // 3mm side retention lip
        
        // Phone pocket — centered, shifted up so visible screen appears centered
        pocket_shift_y = (screen_bezel_top - lip) / 2;
        translate([0, pocket_shift_y, bottom])
            linear_extrude(height=pocket_d)
                rounded_rect_2d(pocket_w, pocket_h, corner_r);
        
        // Screen opening (front face) — masks status bar at top only
        screen_open_w = pocket_w - screen_bezel_side * 2;
        screen_open_h = pocket_h - screen_bezel_top - screen_bezel_bot;
        screen_offset_y = (screen_bezel_bot - screen_bezel_top) / 2;
        
        translate([0, pocket_shift_y + screen_offset_y, bottom + pocket_d - 0.1])
            linear_extrude(height=lip + 1)
                rounded_rect_2d(screen_open_w, screen_open_h, corner_r - lip);
        
        // Camera module cutout (back face, top-right of phone when face-down)
        // Sized to fit both iPhone 15 Pro (~38mm) and 16 Pro (~42mm)
        translate([pocket_w/2 - 47, pocket_shift_y + pocket_h/2 - 46, -1])
            linear_extrude(height=bottom + 2)
                offset(r=5) offset(delta=-5)
                    square([42, 42]);
        
        // --- Side button hollows ---
        // Upper half of phone sides, half the case depth — generous clearance.
        // Works for both 15 Pro and 16 Pro button layouts.
        hollow_len = pocket_h * 0.55;
        hollow_z0  = case_d / 4;
        hollow_z1  = case_d / 2;
        wall_cut   = bottom + 2;
        
        // Left side hollow (volume + action/camera control)
        translate([-pocket_w/2 - 1, pocket_shift_y - 5, hollow_z0])
            cube([wall_cut, hollow_len, hollow_z1]);
        
        // Right side hollow (power button)
        translate([pocket_w/2 - (wall_cut - 1), pocket_shift_y - 5, hollow_z0])
            cube([wall_cut, hollow_len, hollow_z1]);
    }
}

// --- Render ---
$fn = 32;
case_body();
