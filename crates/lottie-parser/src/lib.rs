use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

#[derive(Serialize, Deserialize, Debug)]
struct LottieRoot {
    // version
    v: Option<serde_json::Value>,
    // frame rate
    fr: Option<f64>,
    // in-point (start frame)
    ip: Option<f64>,
    // out-point (end frame)
    op: Option<f64>,
    // width
    w: Option<f64>,
    // height
    h: Option<f64>,
    // layers
    layers: Option<Vec<serde_json::Value>>,
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AssetMetadata {
    pub width: u32,
    pub height: u32,
    pub frame_rate: f64,
    pub duration_seconds: f64,
    pub layer_count: u32,
    pub file_size_bytes: u32,
    content_hash: String,
}

#[wasm_bindgen]
impl AssetMetadata {
    #[wasm_bindgen(getter)]
    pub fn content_hash(&self) -> String {
        self.content_hash.clone()
    }

    /// Serialize to a JS object for easy consumption.
    pub fn to_js_object(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// Parse a Lottie JSON string and extract metadata.
/// Returns an AssetMetadata struct or throws a JS error.
#[wasm_bindgen]
pub fn parse_lottie(json_bytes: &[u8]) -> Result<AssetMetadata, JsValue> {
    // Compute hash before any parsing (ensures hash is of raw input)
    let mut hasher = Sha256::new();
    hasher.update(json_bytes);
    let hash_bytes = hasher.finalize();
    let content_hash = hex::encode(hash_bytes);

    let file_size_bytes = json_bytes.len() as u32;

    // Parse JSON
    let root: LottieRoot = serde_json::from_slice(json_bytes)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    // Validate required Lottie fields
    if root.v.is_none() {
        return Err(JsValue::from_str("Not a valid Lottie file: missing version field 'v'"));
    }
    let layers = root.layers.as_ref()
        .ok_or_else(|| JsValue::from_str("Not a valid Lottie file: missing 'layers' array"))?;

    let fr = root.fr.unwrap_or(24.0);
    let ip = root.ip.unwrap_or(0.0);
    let op = root.op.unwrap_or(0.0);

    // Duration = (out-point - in-point) / frame-rate
    let duration_seconds = if fr > 0.0 {
        (op - ip) / fr
    } else {
        0.0
    };

    let width = root.w.unwrap_or(0.0) as u32;
    let height = root.h.unwrap_or(0.0) as u32;
    let layer_count = layers.len() as u32;

    Ok(AssetMetadata {
        width,
        height,
        frame_rate: fr,
        duration_seconds: duration_seconds.max(0.0),
        layer_count,
        file_size_bytes,
        content_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_lottie() {
        let json = r#"{"v":"5.7.0","fr":24,"ip":0,"op":48,"w":100,"h":100,"layers":[]}"#;
        let result = parse_lottie(json.as_bytes()).unwrap();
        assert_eq!(result.width, 100);
        assert_eq!(result.height, 100);
        assert_eq!(result.frame_rate, 24.0);
        assert_eq!(result.layer_count, 0);
        assert!((result.duration_seconds - 2.0).abs() < 0.001);
        assert_eq!(result.content_hash.len(), 64);
    }

    #[test]
    fn test_parse_missing_version() {
        let json = r#"{"fr":24,"ip":0,"op":48,"w":100,"h":100,"layers":[]}"#;
        let result = parse_lottie(json.as_bytes());
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_missing_layers() {
        let json = r#"{"v":"5.7.0","fr":24,"ip":0,"op":48,"w":100,"h":100}"#;
        let result = parse_lottie(json.as_bytes());
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_invalid_json() {
        let result = parse_lottie(b"not json");
        assert!(result.is_err());
    }


}
