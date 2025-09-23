use anyhow::{Context, Result};
use std::env::consts::{ARCH, OS};
use std::path::Path;
use std::{fs, io};
use tauri_plugin_http::reqwest::Url;
use zip::ZipArchive;

// use std::hash::{DefaultHasher, Hash, Hasher};

// pub fn hash<T: Hash>(value: &T) -> String {
//     let mut hasher = DefaultHasher::new();
//     value.hash(&mut hasher);
//     hasher.finish().to_string()
// }

pub fn hash(value: &[u8]) -> String {
    blake3::hash(value).to_string()
}

pub fn extract_zip_archive(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<()> {
    let file = fs::File::open(src)?;
    let mut archive = ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let dst = dst
            .as_ref()
            .join(file.enclosed_name().context("missing file name")?);

        if file.is_file() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent)?;
            }

            let mut out = fs::File::create(dst)?;
            io::copy(&mut file, &mut out)?;
        }
    }

    Ok(())
}

pub struct Platform(String);

impl Platform {
    pub fn current() -> Option<Self> {
        let os = match OS {
            "windows" => "win",
            "linux" => "linux",
            // "macos" => "mac",
            _ => return None,
        };

        let bits = match ARCH {
            "x86_64" => "64",
            "aarch64" => "arm64",
            _ => return None,
        };

        Some(Self(format!("{os}{bits}")))
    }

    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }

    pub fn executable_extension(&self) -> Option<&str> {
        if self.0.starts_with("win") {
            Some("exe")
        } else {
            None
        }
    }

    pub fn normalize_executable_name(&self, name: &str) -> String {
        if let Some(ext) = self.executable_extension() {
            format!("{name}.{ext}")
        } else {
            name.to_string()
        }
    }
}

pub trait UrlExt {
    fn source(&self) -> Option<String>;
}

impl UrlExt for Url {
    fn source(&self) -> Option<String> {
        match self.host_str() {
            Some("www.youtube.com" | "youtube.com") => Some("youtube".to_string()),
            _ => None,
        }
    }
}
