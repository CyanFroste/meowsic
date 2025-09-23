use crate::db::TrackRow;
use crate::utils;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::fmt::Debug;
use std::fs;
use std::path::{Path, PathBuf};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, StandardTagKey, StandardVisualKey};
use symphonia::core::probe::Hint;
use symphonia::default::get_probe;
use walkdir::WalkDir;

#[skip_serializing_none]
#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub hash: String,
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub duration: u64,
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
    pub number: Option<u64>,
}

impl Track {
    pub fn new(path: impl Into<PathBuf>, covers_path: impl AsRef<Path>) -> Result<Self> {
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
            path,
            name,
            extension,
            hash: hash.to_string(),
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
                            TrackNumber => {
                                use symphonia::core::meta::Value::*;

                                data.number = match tag.value {
                                    SignedInt(n) => n.try_into().ok(),
                                    UnsignedInt(n) => Some(n),
                                    String(ref s) => s.parse().ok().or_else(|| {
                                        // sometimes this is a string like "1/2"
                                        s.split('/').next().and_then(|x| x.parse().ok())
                                    }),
                                    _ => None,
                                };
                            }
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

            match Track::new(path, &covers_path) {
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
            path: PathBuf::from(row.path),
            name: row.name,
            extension: row.extension,
            duration: row.duration.try_into().unwrap_or_default(),
            cover: row.cover.map(PathBuf::from),
            title: row.title,
            artist: row.artist,
            album: row.album,
            album_artist: row.album_artist,
            date: row.date,
            genre: row.genre,
            rules: row.rules,
            number: row.number.and_then(|x| x.try_into().ok()),
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
