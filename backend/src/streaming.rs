use crate::db::Db;
use crate::tracks;
use crate::utils::{Platform, extract_zip_archive};
use anyhow::{Context, Result, anyhow};
use std::fs;
use std::path::PathBuf;
use tauri_plugin_http::reqwest::{Client as HttpClient, IntoUrl};

pub struct StreamingClient {
    db: Db,
    data_path: PathBuf,
    cache_path: PathBuf,
    http_client: HttpClient,
    platform: Option<Platform>,
    pub dependencies: Option<Dependencies>,
}

#[derive(Debug, Clone)]
pub struct Dependencies {
    pub ffmpeg: PathBuf,
    pub yt_dlp: PathBuf,
}

impl StreamingClient {
    pub fn new(
        db: Db,
        http_client: HttpClient,
        platform: Option<Platform>,
        data_path: impl Into<PathBuf>,
        cache_path: impl Into<PathBuf>,
    ) -> Self {
        let data_path = data_path.into();
        let cache_path = cache_path.into();

        Self {
            db,
            data_path,
            cache_path,
            http_client,
            platform,
            dependencies: None,
        }
    }

    pub async fn scan_urls(
        &self,
        urls: &[impl IntoUrl + Clone],
        wipe_sources: &[impl AsRef<str>],
    ) -> Result<String> {
        let dependencies = self.dependencies.as_ref().context("Missing Dependencies")?;

        let (tracks, errors) =
            tracks::from_urls(urls, &self.db.covers_path, &self.http_client, &dependencies).await?;

        let total = tracks.len() + errors.len();

        self.db.insert_tracks(tracks, wipe_sources).await?;

        // simple result format to show in the UI
        Ok(format!(
            "{}\n\nScanned {total} tracks with {} errors.",
            errors.join("\n"),
            errors.len(),
        ))
    }

    pub fn load_dependencies(&mut self) -> Result<()> {
        let platform = self.platform.as_ref().context("Invalid Platform")?;

        let ffmpeg_exe = platform.normalize_executable_name("ffmpeg");
        let yt_dlp_exe = platform.normalize_executable_name("yt-dlp");

        let dependencies = Dependencies {
            ffmpeg: self.data_path.join(ffmpeg_exe),
            yt_dlp: self.data_path.join(yt_dlp_exe),
        };

        if !dependencies.ffmpeg.exists() || !dependencies.yt_dlp.exists() {
            return Err(anyhow!("Dependencies are not Installed"));
        }

        self.dependencies = Some(dependencies);

        Ok(())
    }

    pub async fn install_dependencies(&mut self) -> Result<()> {
        let platform = self.platform.as_ref().context("Invalid Platform")?;

        let url = format!(
            "https://github.com/CyanFroste/meowsic-deps/releases/download/latest/ffmpeg-{}.zip",
            platform.as_str()
        );

        let res = self.http_client.get(&url).send().await?;

        if !res.status().is_success() {
            return Err(anyhow!("failed to download ffmpeg"));
        }

        let archive_path = self.cache_path.join("ffmpeg.zip");
        fs::write(&archive_path, res.bytes().await?)?;

        let extraction_path = self.cache_path.join("ffmpeg");
        extract_zip_archive(&archive_path, &extraction_path)?;

        let ffmpeg_exe = platform.normalize_executable_name("ffmpeg");
        let yt_dlp_exe = platform.normalize_executable_name("yt-dlp");

        let dependencies = Dependencies {
            ffmpeg: self.data_path.join(&ffmpeg_exe),
            yt_dlp: self.data_path.join(&yt_dlp_exe),
        };

        fs::copy(extraction_path.join(&ffmpeg_exe), &dependencies.ffmpeg)?;

        fs::remove_file(&archive_path)?;
        fs::remove_dir_all(&extraction_path)?;

        let url = format!(
            "https://github.com/CyanFroste/meowsic-deps/releases/download/latest/{}",
            platform.normalize_executable_name(&format!("yt-dlp-{}", platform.as_str())),
        );

        let res = self.http_client.get(&url).send().await?;

        if !res.status().is_success() {
            return Err(anyhow!("failed to download yt-dlp"));
        }

        fs::write(&dependencies.yt_dlp, res.bytes().await?)?;

        self.dependencies = Some(dependencies);

        Ok(())
    }

    // infallible since this feature is optional
    pub fn init(&mut self) {
        _ = fs::create_dir_all(&self.data_path);
        _ = fs::create_dir_all(&self.cache_path);
        _ = self.load_dependencies();
    }
}
