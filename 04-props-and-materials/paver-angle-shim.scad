// Paver Angle Shim for Wet Saw
// Creates 5.8 degree angle against fence for cutting circular wall wedges

// ============== PARAMETERS ==============

// Angle at the tip
shim_angle = 5.8;

// Height
shim_height = 3 * 25.4;  // 3 inches = 76.2 mm

// Hypotenuse length (the angled face that contacts paver)
hypotenuse = 10 * 25.4;  // 10 inches = 254 mm

// Calculate triangle dimensions from hypotenuse and angle
tri_length = hypotenuse * cos(shim_angle);  // Along fence
tri_width = hypotenuse * sin(shim_angle);   // Perpendicular to fence

// ============== MAIN SHAPE ==============

linear_extrude(height = shim_height) {
    polygon(points = [
        [0, 0],                  // Tip (against fence)
        [tri_length, 0],         // Back corner (against fence)
        [tri_length, tri_width]  // Front corner
    ]);
}

// ============== INFO ==============
echo("=== Fence Angle Shim ===");
echo(str("Angle: ", shim_angle, " degrees"));
echo(str("Hypotenuse: ", hypotenuse, " mm (", hypotenuse/25.4, " inches)"));
echo(str("Height: ", shim_height, " mm (", shim_height/25.4, " inches)"));
echo(str("Length along fence: ", tri_length, " mm (", tri_length/25.4, " inches)"));
echo(str("Width at thick end: ", tri_width, " mm (", tri_width/25.4, " inches)"));
