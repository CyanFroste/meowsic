use crate::db::TrackRow;
use crate::streaming::Dependencies;
use crate::utils;
use crate::utils::UrlExt;
use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use serde_with::skip_serializing_none;
use std::fmt::Display;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, StandardTagKey, StandardVisualKey};
use symphonia::core::probe::Hint;
use symphonia::default::get_probe;
use tauri_plugin_http::reqwest::{Client as HttpClient, IntoUrl, Url};
use walkdir::WalkDir;

#[skip_serializing_none]
#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub hash: String,
    pub path: TrackPath,
    pub name: String,
    pub extension: String,
    pub duration: u64,
    pub source: String,
    pub cover: Option<PathBuf>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub date: Option<String>,
    pub genre: Option<String>,
    pub position: Option<u64>,
    pub rank: Option<u64>,
    pub rules: Option<String>,
}

pub const DEFAULT_SOURCE: &str = "file";

impl Track {
    pub async fn from_link(
        url: impl IntoUrl,
        covers_path: impl AsRef<Path>,
        http_client: &HttpClient,
        dependencies: &Dependencies,
    ) -> Result<Self> {
        let url = url.into_url()?;

        match url.source() {
            Some(source) if source == "youtube" => {
                let output = process::Command::new(&dependencies.yt_dlp)
                    .args(["-f", "bestaudio", "-j", url.as_str(), "--no-playlist"])
                    .output()?;

                let json: JsonValue = serde_json::from_slice(&output.stdout)?;
                let hash = utils::hash(url.as_str().as_bytes());

                let name = json["title"]
                    .as_str()
                    .map(|x| x.to_string())
                    .unwrap_or_else(|| url.to_string());

                let duration = json["duration"].as_u64().unwrap_or_default();
                let title = json["track"].as_str().map(|x| x.to_string());
                let artist = json["artist"].as_str().map(|x| x.to_string());
                let album = json["album"].as_str().map(|x| x.to_string());
                let date = json["release_date"].as_str().map(|x| x.to_string());

                // TODO: do urls need extension?
                let extension = json["ext"]
                    .as_str()
                    .map(|x| x.to_string())
                    .unwrap_or_default();

                let mut data = Self {
                    // this isn't the actual playable url
                    // have to fetch and cache it on track selection
                    path: TrackPath::Link(url),
                    hash: hash.to_string(),
                    source,
                    name,
                    extension,
                    duration,
                    title,
                    artist,
                    album,
                    date,
                    ..Self::default()
                };

                let mut thumbnail = json["thumbnail"].as_str();

                if let Some(thumbnails) = json["thumbnails"].as_array() {
                    let mut size = 0;

                    for item in thumbnails {
                        if let (Some(w), Some(h)) =
                            (item["width"].as_u64(), item["height"].as_u64())
                            && w == h
                            && w > size
                        {
                            thumbnail = item["url"].as_str();
                            size = w;
                        }
                    }
                }

                // download thumbnail
                if let Some(thumbnail) = thumbnail {
                    let res = http_client.get(thumbnail).send().await?;

                    let ext = res
                        .headers()
                        .get("content-type")
                        .and_then(|x| x.to_str().ok())
                        .and_then(|x| x.split('/').last())
                        .unwrap_or("jpg")
                        .to_string();

                    let bytes = res.bytes().await?;
                    let path = covers_path.as_ref().join(format!("{hash}.{ext}"));

                    fs::write(&path, &bytes)?;
                    data.cover = Some(path);
                }

                Ok(data)
            }

            _ => Err(anyhow!("Unsupported Link")),
        }
    }

    pub fn from_file(path: impl Into<PathBuf>, covers_path: impl AsRef<Path>) -> Result<Self> {
        // this is also mapped in the database
        let source = DEFAULT_SOURCE.to_string();

        let path: PathBuf = path.into();
        let file = fs::File::open(&path)?;

        let extension = path
            .extension()
            .and_then(|x| x.to_str())
            .map(|x| x.to_string())
            .context("missing file extension")?;

        let file_name = path
            .file_name()
            .and_then(|x| x.to_str())
            .map(|x| x.to_string())
            .context("missing file name")?;

        let name = file_name
            .trim_end_matches(&format!(".{extension}"))
            .to_string();

        // IDEAL: ideally this could have been a uuid
        let hash = utils::hash(file_name.as_bytes());

        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();
        hint.with_extension(&extension);

        let mut probed = get_probe().format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )?;

        let mut data = Self {
            name,
            source,
            extension,
            hash: hash.to_string(),
            path: TrackPath::File(path),
            ..Self::default()
        };

        if let Some(track) = probed.format.default_track() {
            if let Some((num_frames, sample_rate)) = track
                .codec_params
                .n_frames
                .zip(track.codec_params.sample_rate)
            {
                data.duration = num_frames / sample_rate as u64;
            }
        }

        if let Some(mut meta) = probed
            .metadata
            .get()
            .or_else(|| Some(probed.format.metadata()))
        {
            if let Some(rev) = meta.skip_to_latest() {
                for tag in rev.tags() {
                    if let Some(key) = tag.std_key {
                        use StandardTagKey::*;

                        match key {
                            TrackTitle => data.title = Some(tag.value.to_string()),
                            Artist => data.artist = Some(tag.value.to_string()),
                            Album => data.album = Some(tag.value.to_string()),
                            AlbumArtist => data.album_artist = Some(tag.value.to_string()),
                            Date => data.date = Some(tag.value.to_string()),
                            Genre => data.genre = Some(tag.value.to_string()),
                            _ => {}
                        }
                    }
                }

                let visuals = rev.visuals();
                let mut priority = [None, None];
                let mut others = Vec::with_capacity(visuals.len());

                for entry in visuals {
                    match entry.usage {
                        Some(StandardVisualKey::FrontCover) => priority[0] = Some(entry),
                        Some(StandardVisualKey::BackCover) => priority[1] = Some(entry),
                        _ => others.push(entry),
                    }
                }

                for entry in priority.into_iter().flatten().chain(others) {
                    if entry.data.is_empty() {
                        continue;
                    }

                    let (_, ext) = entry.media_type.split_once("/").unwrap_or(("image", "jpg"));
                    let path = covers_path.as_ref().join(format!("{hash}.{ext}"));

                    fs::write(&path, &entry.data)?;
                    data.cover = Some(path);
                    break;
                }
            }
        }

        Ok(data)
    }
}

#[derive(Debug, Clone)]
pub enum TrackPath {
    File(PathBuf),
    Link(Url),
}

impl Serialize for TrackPath {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for TrackPath {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(s.into())
    }
}

impl Default for TrackPath {
    fn default() -> Self {
        Self::File(PathBuf::new())
    }
}

impl Display for TrackPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::File(path) => write!(f, "{}", path.to_string_lossy()),
            Self::Link(url) => write!(f, "{}", url),
        }
    }
}

impl From<&str> for TrackPath {
    fn from(value: &str) -> Self {
        match Url::parse(value) {
            Ok(url) if url.has_host() => Self::Link(url),
            _ => Self::File(PathBuf::from(value)),
        }
    }
}

impl From<String> for TrackPath {
    fn from(value: String) -> Self {
        Self::from(value.as_str())
    }
}

pub async fn from_urls(
    urls: &[impl IntoUrl + Clone],
    covers_path: impl AsRef<Path>,
    http_client: &HttpClient,
    dependencies: &Dependencies,
) -> Result<(Vec<Track>, Vec<String>)> {
    let mut tracks = Vec::new();
    let mut errors = Vec::new();

    for possible_url in urls {
        match possible_url.clone().into_url() {
            Ok(url) => match Track::from_link(url, &covers_path, http_client, dependencies).await {
                Ok(track) => tracks.push(track),
                Err(err) => errors.push(format!("[ERR] {} : {err}", possible_url.as_str())),
            },
            Err(err) => errors.push(format!("[ERR] {} : {err}", possible_url.as_str())),
        }
    }

    Ok((tracks, errors))
}

pub fn from_dirs(
    dirs: &[impl AsRef<Path>],
    covers_path: impl AsRef<Path>,
) -> Result<(Vec<Track>, Vec<String>)> {
    const SUPPORTED: &[&str] = &["mp3", "m4a", "flac", "wav", "ogg", "opus", "aac", "aiff"];

    let mut tracks = Vec::new();
    let mut errors = Vec::new();

    for dir in dirs {
        for entry in WalkDir::new(dir)
            .into_iter()
            .filter_map(|x| x.ok())
            .filter(|x| x.file_type().is_file())
        {
            let path = entry.path();

            if !SUPPORTED.iter().any(|&x| {
                path.extension()
                    .and_then(|x| x.to_str())
                    .is_some_and(|ext| x.eq_ignore_ascii_case(ext))
            }) {
                continue;
            }

            match Track::from_file(path, &covers_path) {
                Ok(track) => tracks.push(track),
                // simple error format to show in the UI
                Err(err) => errors.push(format!("[ERR] {} : {err}", path.display())),
            }
        }
    }

    Ok((tracks, errors))
}

impl From<TrackRow> for Track {
    fn from(row: TrackRow) -> Self {
        Self {
            hash: row.hash,
            path: row.path.into(),
            name: row.name,
            extension: row.extension,
            duration: row.duration.try_into().unwrap_or_default(),
            source: row.source,
            cover: row.cover.map(PathBuf::from),
            title: row.title,
            artist: row.artist,
            album: row.album,
            album_artist: row.album_artist,
            date: row.date,
            genre: row.genre,
            rules: row.rules,
            position: row.position.and_then(|x| x.try_into().ok()),
            rank: row.rank.and_then(|x| x.try_into().ok()),
        }
    }
}

#[derive(sqlx::FromRow, Debug, Clone, Serialize)]
pub struct Album {
    pub name: String,
    pub cover: Option<String>,
}

#[derive(sqlx::FromRow, Debug, Clone, Serialize, Deserialize)]
pub struct Lyrics {
    pub plain: String,
    pub synced: String,
}
