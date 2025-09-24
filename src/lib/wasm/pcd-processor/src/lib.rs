use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Uint8Array};
use std::collections::HashMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Set up panic hook for better error messages
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct Point3D {
    x: f32,
    y: f32,
    z: f32,
}

#[wasm_bindgen]
impl Point3D {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, z: f32) -> Point3D {
        Point3D { x, y, z }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.y
    }

    #[wasm_bindgen(getter)]
    pub fn z(&self) -> f32 {
        self.z
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct Color {
    r: u8,
    g: u8,
    b: u8,
}

#[wasm_bindgen]
impl Color {
    #[wasm_bindgen(constructor)]
    pub fn new(r: u8, g: u8, b: u8) -> Color {
        Color { r, g, b }
    }

    #[wasm_bindgen(getter)]
    pub fn r(&self) -> u8 {
        self.r
    }

    #[wasm_bindgen(getter)]
    pub fn g(&self) -> u8 {
        self.g
    }

    #[wasm_bindgen(getter)]
    pub fn b(&self) -> u8 {
        self.b
    }

    pub fn to_packed_float(&self) -> f32 {
        let rgb = (self.r as u32) << 16 | (self.g as u32) << 8 | (self.b as u32);
        f32::from_bits(rgb)
    }
}

#[wasm_bindgen]
pub struct PCDProcessor {
    points: Vec<Point3D>,
    original_points: Vec<Point3D>, // Store original positions for delta calculations
    colors: Vec<Color>,
    header_info: HashMap<String, String>,
    center_offset: Option<Point3D>, // Store the center offset for coordinate alignment
}

#[wasm_bindgen]
impl PCDProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PCDProcessor {
        PCDProcessor {
            points: Vec::new(),
            original_points: Vec::new(),
            colors: Vec::new(),
            header_info: HashMap::new(),
            center_offset: None,
        }
    }

    /// Parse a PCD file from binary data
    pub fn parse_pcd(&mut self, data: &Uint8Array) -> Result<(), JsValue> {
        let bytes: Vec<u8> = data.to_vec();
        
        // Find the start of binary data (after "DATA binary\n")
        let header_end = self.find_data_section(&bytes)?;
        let binary_data = &bytes[header_end..];
        
        // Parse header to get point count and field information
        let header_str = String::from_utf8_lossy(&bytes[..header_end]);
        self.parse_header(&header_str)?;
        
        // Parse binary point data
        self.parse_binary_data(binary_data)?;
        
        Ok(())
    }

    /// Apply delta updates in index_x_y_z format
    pub fn apply_delta_update(&mut self, delta_data: &Uint8Array) -> Result<Vec<usize>, JsValue> {
        let bytes: Vec<u8> = delta_data.to_vec();
        
        if bytes.len() % 16 != 0 {
            return Err(JsValue::from_str("Delta data length must be multiple of 16"));
        }
        
        let mut updated_indices = Vec::new();
        
        // Process each 16-byte chunk: [index(4)][x(4)][y(4)][z(4)]
        for chunk in bytes.chunks_exact(16) {
            let index = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]) as usize;
            let x = f32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]);
            let y = f32::from_le_bytes([chunk[8], chunk[9], chunk[10], chunk[11]]);
            let z = f32::from_le_bytes([chunk[12], chunk[13], chunk[14], chunk[15]]);
            
            if index < self.points.len() {
                self.points[index] = Point3D::new(x, y, z);
                updated_indices.push(index);
            }
        }
        
        Ok(updated_indices)
    }

    /// Get positions as Float32Array for Three.js
    pub fn get_positions(&self) -> Float32Array {
        let mut positions = Vec::with_capacity(self.points.len() * 3);
        for point in &self.points {
            positions.push(point.x);
            positions.push(point.y);
            positions.push(point.z);
        }
        Float32Array::from(&positions[..])
    }


    /// Get colors as Float32Array for Three.js (if available)
    pub fn get_colors(&self) -> Option<Float32Array> {
        if self.colors.is_empty() {
            return None;
        }
        
        let mut colors = Vec::with_capacity(self.colors.len() * 3);
        for color in &self.colors {
            colors.push(color.r as f32 / 255.0);
            colors.push(color.g as f32 / 255.0);
            colors.push(color.b as f32 / 255.0);
        }
        Some(Float32Array::from(&colors[..]))
    }

    /// Get number of points
    pub fn point_count(&self) -> usize {
        self.points.len()
    }
}

impl PCDProcessor {
    fn find_data_section(&self, bytes: &[u8]) -> Result<usize, JsValue> {
        let data_marker = b"DATA binary\n";
        
        for i in 0..bytes.len().saturating_sub(data_marker.len()) {
            if &bytes[i..i + data_marker.len()] == data_marker {
                return Ok(i + data_marker.len());
            }
        }
        
        Err(JsValue::from_str("Could not find binary data section"))
    }
    
    fn parse_header(&mut self, header: &str) -> Result<(), JsValue> {
        for line in header.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                self.header_info.insert(parts[0].to_string(), parts[1..].join(" "));
            }
        }
        Ok(())
    }
    
    fn parse_binary_data(&mut self, data: &[u8]) -> Result<(), JsValue> {
        // Assume XYRGB format (16 bytes per point: x, y, z, rgb as floats)
        if data.len() % 16 != 0 {
            return Err(JsValue::from_str("Binary data length not aligned to point size"));
        }
        
        let point_count = data.len() / 16;
        self.points.reserve(point_count);
        self.colors.reserve(point_count);
        
        // First pass: collect all points and calculate center
        let mut temp_points = Vec::with_capacity(point_count);
        let mut sum_x = 0.0;
        let mut sum_y = 0.0;
        let mut min_z = f32::INFINITY;
        
        for chunk in data.chunks_exact(16) {
            let x = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            let y = f32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]);
            let z = f32::from_le_bytes([chunk[8], chunk[9], chunk[10], chunk[11]]);
            let rgb_bits = u32::from_le_bytes([chunk[12], chunk[13], chunk[14], chunk[15]]);
            
            temp_points.push((x, y, z, rgb_bits));
            sum_x += x;
            sum_y += y;
            if z < min_z {
                min_z = z;
            }
        }
        
        // Calculate center offset (matches backend logic)
        let center_x = sum_x / point_count as f32;
        let center_y = sum_y / point_count as f32;
        let center_z = min_z;
        
        self.center_offset = Some(Point3D::new(center_x, center_y, center_z));
        
        // Store points using the backend's coordinate system directly
        for (x, y, z, rgb_bits) in temp_points {
            // Store points in their original backend coordinate system
            self.points.push(Point3D::new(x, y, z));
            self.original_points.push(Point3D::new(x, y, z));
            
            // Extract RGB from packed float
            let r = ((rgb_bits >> 16) & 0xFF) as u8;
            let g = ((rgb_bits >> 8) & 0xFF) as u8;
            let b = (rgb_bits & 0xFF) as u8;
            self.colors.push(Color::new(r, g, b));
        }
        
        Ok(())
    }
}