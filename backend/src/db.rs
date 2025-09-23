use crate::tracks;
use crate::tracks::{Album, Lyrics, Track};
use crate::utils;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::{Value as JsonValue, json};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, QueryBuilder, Sqlite};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions as ZipFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Debug, Clone)]
pub struct Db {
    pub covers_path: PathBuf,
    pool: Pool<Sqlite>,
}

impl Db {
    pub fn new(path: impl AsRef<Path>, covers_path: impl Into<PathBuf>) -> Self {
        let covers_path = covers_path.into();

        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_lazy_with(options);

        Self { pool, covers_path }
    }

    pub async fn get_tracks(&self, filters: &GetTracksFilters) -> Result<Vec<Track>> {
        let mut qb = QueryBuilder::new(
            "SELECT t.*, r.rules FROM tracks AS t LEFT JOIN ruleset AS r ON r.track_hash = t.hash WHERE 1 = 1",
        );

        if let Some(album) = &filters.album {
            qb.push(" AND t.album = ").push_bind(album);
        }

        if let Some(artist) = &filters.artist {
            qb.push(" AND t.artist = ").push_bind(artist);
        }

        qb.push(" ORDER BY COALESCE(t.title, t.name) ASC");

        let entries: Vec<TrackRow> = qb.build_query_as().fetch_all(&self.pool).await?;
        let tracks = entries.into_iter().map(Track::from).collect();

        // let multiplier = 10; // TEST large dataset -> upto 376832 tracks at 12x
        // let mut tracks: Vec<Track> = tracks;
        // for i in 0..multiplier {
        //     tracks.extend(tracks.clone().into_iter().enumerate().map(|(k, mut t)| {
        //         t.hash = format!("{}-{i}-{k}", t.hash);
        //         t
        //     }));
        // }

        Ok(tracks)
    }

    pub async fn get_track(&self, hash: impl AsRef<str>) -> Result<Option<Track>> {
        let entry: Option<TrackRow> = sqlx::query_as(
            "SELECT t.*, r.rules FROM tracks AS t LEFT JOIN ruleset AS r ON r.track_hash = t.hash WHERE hash = $1",
        )
        .bind(hash.as_ref())
        .fetch_optional(&self.pool)
        .await?;

        let track = entry.map(Track::from);

        Ok(track)
    }

    pub async fn scan_dirs(&self, dirs: &[impl AsRef<Path>]) -> Result<String> {
        let (tracks, errors) = tracks::from_dirs(dirs, &self.covers_path)?;
        let total = tracks.len() + errors.len();

        if !tracks.is_empty() {
            let mut qb = QueryBuilder::new(
                "INSERT OR IGNORE INTO tracks 
                (hash, path, name, extension, duration, cover, title, artist, album, album_artist, date, genre, number) ",
            );

            qb.push_values(tracks.into_iter().take(32000), |mut b, track| {
                b.push_bind(track.hash)
                    .push_bind(track.path.to_string_lossy().to_string())
                    .push_bind(track.name)
                    .push_bind(track.extension)
                    .push_bind(track.duration as i64)
                    .push_bind(track.cover.map(|p| p.to_string_lossy().to_string()))
                    .push_bind(track.title)
                    .push_bind(track.artist)
                    .push_bind(track.album)
                    .push_bind(track.album_artist)
                    .push_bind(track.date)
                    .push_bind(track.genre)
                    .push_bind(track.number.map(|x| x as i64));
            });

            let mut tx = self.pool.begin().await?;

            sqlx::query("DELETE FROM tracks").execute(&mut *tx).await?;
            qb.build().execute(&mut *tx).await?;
            tx.commit().await?;
        }

        // simple result format to show in the UI
        Ok(format!(
            "{}\n\nScanned {total} tracks with {} errors.",
            errors.join("\n"),
            errors.len(),
        ))
    }

    pub async fn get_playlists(&self) -> Result<Vec<String>> {
        let names: Vec<String> = sqlx::query_scalar("SELECT name FROM playlists ORDER BY name ASC")
            .fetch_all(&self.pool)
            .await?;

        Ok(names)
    }

    // not using drop and insert because of cascading delete
    pub async fn add_playlist(&self, name: impl AsRef<str>) -> Result<()> {
        sqlx::query("INSERT INTO playlists (name) VALUES ($1)")
            .bind(name.as_ref())
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn rename_playlist(
        &self,
        name: impl AsRef<str>,
        new_name: impl AsRef<str>,
    ) -> Result<()> {
        sqlx::query("UPDATE playlists SET name = $1 WHERE name = $2")
            .bind(new_name.as_ref())
            .bind(name.as_ref())
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn remove_playlist(&self, name: impl AsRef<str>) -> Result<()> {
        sqlx::query("DELETE FROM playlists WHERE name = $1")
            .bind(name.as_ref())
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_playlist_tracks(&self, name: impl AsRef<str>) -> Result<Vec<Track>> {
        let entries: Vec<TrackRow> = sqlx::query_as(
            "
            SELECT t.*, pt.position, r.rules
            FROM tracks AS t
            JOIN playlist_tracks AS pt ON pt.track_hash = t.hash
            LEFT JOIN ruleset AS r ON r.track_hash = t.hash
            WHERE pt.playlist_name = $1
            ORDER BY pt.position ASC
            ",
        )
        .bind(name.as_ref())
        .fetch_all(&self.pool)
        .await?;

        let tracks = entries.into_iter().map(Track::from).collect();

        Ok(tracks)
    }

    pub async fn remove_playlist_tracks(
        &self,
        name: impl AsRef<str>,
        hashes: Option<&[impl AsRef<str>]>,
    ) -> Result<()> {
        if let Some(hashes) = hashes {
            if hashes.is_empty() {
                return Ok(());
            }

            let mut tx = self.pool.begin().await?;
            let name = name.as_ref();

            let mut qb: QueryBuilder<Sqlite> =
                QueryBuilder::new("DELETE FROM playlist_tracks WHERE playlist_name = ");

            qb.push_bind(name);
            qb.push(" AND track_hash IN (");
            let mut separated = qb.separated(", ");

            for hash in hashes.iter().take(32000) {
                separated.push_bind(hash.as_ref());
            }

            qb.push(")");
            qb.build().execute(&mut *tx).await?;

            sqlx::query(
                "
                WITH ordered AS (
                    SELECT track_hash, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
                    FROM playlist_tracks
                    WHERE playlist_name = $1
                )
                UPDATE playlist_tracks
                SET position = (
                    SELECT new_pos FROM ordered WHERE ordered.track_hash = playlist_tracks.track_hash
                )
                WHERE playlist_name = $1
                ",
            )
            .bind(name)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
        } else {
            sqlx::query("DELETE FROM playlist_tracks WHERE playlist_name = $1")
                .bind(name.as_ref())
                .execute(&self.pool)
                .await?;
        }

        Ok(())
    }

    pub async fn add_playlist_tracks(
        &self,
        name: impl AsRef<str>,
        hashes: &[impl AsRef<str>],
    ) -> Result<()> {
        if hashes.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await?;
        let name = name.as_ref();

        let max_pos: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlist_name = $1",
        )
        .bind(name)
        .fetch_one(&mut *tx)
        .await?;

        let mut max_pos = max_pos + 1;

        let existing: Vec<String> =
            sqlx::query_scalar("SELECT track_hash FROM playlist_tracks WHERE playlist_name = $1")
                .bind(name)
                .fetch_all(&mut *tx)
                .await?;

        let existing: HashSet<String> = existing.into_iter().collect();

        let filtered: Vec<&str> = hashes
            .iter()
            .map(|x| x.as_ref())
            .filter(|&x| !existing.contains(x))
            .collect();

        if filtered.is_empty() {
            tx.commit().await?;

            return Ok(());
        }

        let mut qb =
            QueryBuilder::new("INSERT INTO playlist_tracks (playlist_name, track_hash, position) ");

        qb.push_values(filtered.into_iter().take(32000), |mut b, hash| {
            b.push_bind(name).push_bind(hash).push_bind(max_pos);
            max_pos += 1;
        });

        qb.build().execute(&mut *tx).await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn reorder_playlist_track(
        &self,
        name: impl AsRef<str>,
        hash: impl AsRef<str>,
        src: i64,
        dst: i64,
    ) -> Result<()> {
        let name = name.as_ref();

        let query = if dst < src {
            sqlx::query(
                "
                UPDATE playlist_tracks 
                SET position = position + 1
                WHERE playlist_name = $1 AND position >= $2 AND position < $3
                ",
            )
            .bind(name)
            .bind(dst)
            .bind(src)
        } else if dst > src {
            sqlx::query(
                "
                UPDATE playlist_tracks
                SET position = position - 1
                WHERE playlist_name = $1 AND position > $2 AND position <= $3
                ",
            )
            .bind(name)
            .bind(src)
            .bind(dst)
        } else {
            return Ok(());
        };

        let mut tx = self.pool.begin().await?;

        query.execute(&mut *tx).await?;

        sqlx::query(
            "
            UPDATE playlist_tracks
            SET position = $1
            WHERE playlist_name = $2 AND track_hash = $3
            ",
        )
        .bind(dst)
        .bind(name)
        .bind(hash.as_ref())
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }

    pub async fn get_emotions(&self) -> Result<Vec<Emotion>> {
        let names: Vec<Emotion> = sqlx::query_as("SELECT * FROM emotions ORDER BY rowid ASC")
            .fetch_all(&self.pool)
            .await?;

        Ok(names)
    }

    // TODO: api to clear emotions
    // see also: restore()

    pub async fn get_emotion_tracks(&self, name: impl AsRef<str>) -> Result<Vec<Track>> {
        let entries: Vec<TrackRow> = sqlx::query_as(
            "
            SELECT t.*, et.rank, r.rules
            FROM tracks AS t
            JOIN emotion_tracks AS et ON et.track_hash = t.hash
            LEFT JOIN ruleset AS r ON r.track_hash = t.hash
            WHERE et.emotion_name = $1
            ORDER BY et.rank DESC
            ",
        )
        .bind(name.as_ref())
        .fetch_all(&self.pool)
        .await?;

        let tracks = entries.into_iter().map(Track::from).collect();

        Ok(tracks)
    }

    pub async fn rank_up_emotion_track(
        &self,
        name: impl AsRef<str>,
        hash: impl AsRef<str>,
    ) -> Result<()> {
        sqlx::query(
            "
            INSERT INTO emotion_tracks (emotion_name, track_hash, rank) VALUES ($1, $2, 1)
            ON CONFLICT(emotion_name, track_hash)
                DO UPDATE SET rank = rank + 1
            ",
        )
        .bind(name.as_ref())
        .bind(hash.as_ref())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_albums(&self) -> Result<Vec<Album>> {
        let albums: Vec<Album> = sqlx::query_as(
            "
            SELECT album AS name, MIN(cover) AS cover
            FROM tracks
            WHERE album IS NOT NULL
            GROUP BY album
            ORDER BY album ASC
            ",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(albums)
    }

    pub async fn get_artists(&self) -> Result<Vec<String>> {
        let artists: Vec<String> = sqlx::query_scalar(
            "SELECT artist FROM tracks WHERE artist IS NOT NULL GROUP BY artist ORDER BY artist ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(artists)
    }

    pub async fn get_lyrics(&self, hash: impl AsRef<str>) -> Result<Option<Lyrics>> {
        let lyrics: Option<Lyrics> =
            sqlx::query_as("SELECT plain, synced FROM lyrics WHERE track_hash = $1")
                .bind(hash.as_ref())
                .fetch_optional(&self.pool)
                .await?;

        Ok(lyrics)
    }

    pub async fn set_lyrics(&self, hash: impl AsRef<str>, lyrics: Option<&Lyrics>) -> Result<()> {
        // NOTE: keeping lyrics table as a one to many relationship with tracks
        // but treating it as a one to one relationship with tracks in application

        let mut tx = self.pool.begin().await?;

        sqlx::query("DELETE FROM lyrics WHERE track_hash = $1")
            .bind(hash.as_ref())
            .execute(&mut *tx)
            .await?;

        if let Some(lyrics) = lyrics {
            sqlx::query("INSERT INTO lyrics (track_hash, plain, synced) VALUES ($1, $2, $3)")
                .bind(hash.as_ref())
                .bind(&lyrics.plain)
                .bind(&lyrics.synced)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    pub async fn set_rules(
        &self,
        hash: impl AsRef<str>,
        rules: Option<impl AsRef<str>>,
    ) -> Result<()> {
        // NOTE: keeping ruleset table as a one to many relationship with tracks
        // but treating it as a one to one relationship with tracks in application

        let mut tx = self.pool.begin().await?;

        sqlx::query("DELETE FROM ruleset WHERE track_hash = $1")
            .bind(hash.as_ref())
            .execute(&mut *tx)
            .await?;

        if let Some(rules) = rules {
            sqlx::query("INSERT INTO ruleset (track_hash, rules) VALUES ($1, $2)")
                .bind(hash.as_ref())
                .bind(rules.as_ref())
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    pub async fn get_dirs(&self) -> Result<Vec<String>> {
        let paths: Vec<String> = sqlx::query_scalar("SELECT path FROM dirs ORDER BY path ASC")
            .fetch_all(&self.pool)
            .await?;

        Ok(paths)
    }

    pub async fn set_dirs(&self, paths: &[impl AsRef<str>]) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM dirs").execute(&mut *tx).await?;

        for path in paths {
            sqlx::query("INSERT INTO dirs (path) VALUES ($1)")
                .bind(path.as_ref())
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    pub async fn restore(&self, path: impl AsRef<Path>) -> Result<()> {
        let reader = fs::File::open(path)?;
        let mut zip = ZipArchive::new(reader)?;

        for i in 0..zip.len() {
            let file = zip.by_index(i)?;

            if file.name().starts_with("playlist") {
                let data: JsonValue = serde_json::from_reader(file)?;

                if let (Some(name), Some(list)) = (data["name"].as_str(), data["list"].as_array()) {
                    let playlist_name = format!("{name} (Restored)"); // TODO: time suffix
                    let mut map = HashMap::new();

                    for json in list {
                        if let (Some(file_name), Some(position)) =
                            (json["file_name"].as_str(), json["position"].as_i64())
                        {
                            let hash = utils::hash(file_name.as_bytes());
                            map.insert(hash, position);
                        }
                    }

                    if map.is_empty() {
                        continue;
                    }

                    // NOTE: doing one transaction per playlist
                    let mut tx = self.pool.begin().await?;

                    sqlx::query("INSERT OR IGNORE INTO playlists (name) VALUES ($1)")
                        .bind(&playlist_name)
                        .execute(&mut *tx)
                        .await?;

                    let mut qb = QueryBuilder::new(
                        "INSERT OR IGNORE INTO playlist_tracks (playlist_name, track_hash, position) ",
                    );

                    qb.push_values(map.iter().take(32000), |mut b, (hash, position)| {
                        b.push_bind(&playlist_name)
                            .push_bind(hash)
                            .push_bind(position);
                    });

                    qb.build().execute(&mut *tx).await?;
                    tx.commit().await?;
                }
            } else if file.name().starts_with("emotion") {
                let data: JsonValue = serde_json::from_reader(file)?;

                if let (Some(name), Some(list)) = (data["name"].as_str(), data["list"].as_array()) {
                    let mut map = HashMap::new();

                    for json in list {
                        if let (Some(file_name), Some(rank)) =
                            (json["file_name"].as_str(), json["rank"].as_i64())
                        {
                            let hash = utils::hash(file_name.as_bytes());
                            map.insert(hash, rank);
                        }
                    }

                    if map.is_empty() {
                        continue;
                    }

                    QueryBuilder::new(
                        "INSERT OR IGNORE INTO emotion_tracks (emotion_name, track_hash, rank) ",
                    )
                    .push_values(map.iter().take(32000), |mut b, (hash, rank)| {
                        b.push_bind(name).push_bind(hash).push_bind(rank);
                    })
                    .build()
                    .execute(&self.pool)
                    .await?;
                }
            } else if file.name().starts_with("tracks_extended") {
                let data: Vec<JsonValue> = serde_json::from_reader(file)?;

                let mut lyrics_map: HashMap<String, Lyrics> = HashMap::new();
                let mut rules_map = HashMap::new();

                for item in data {
                    match (
                        item["file_name"].as_str(),
                        serde_json::from_value(item["lyrics"].clone()),
                        item["rules"].as_str(),
                    ) {
                        (Some(file_name), Err(_), Some(rules)) => {
                            let hash = utils::hash(file_name.as_bytes());
                            rules_map.insert(hash, rules.to_string());
                        }
                        (Some(file_name), Ok(lyrics), None) => {
                            let hash = utils::hash(file_name.as_bytes());
                            lyrics_map.insert(hash, lyrics);
                        }
                        _ => {}
                    }
                }

                if !lyrics_map.is_empty() {
                    QueryBuilder::new("INSERT OR IGNORE INTO lyrics (track_hash, plain, synced) ")
                        .push_values(lyrics_map.iter().take(32000), |mut b, (hash, lyrics)| {
                            b.push_bind(hash)
                                .push_bind(&lyrics.plain)
                                .push_bind(&lyrics.synced);
                        })
                        .build()
                        .execute(&self.pool)
                        .await?;
                }

                if !rules_map.is_empty() {
                    QueryBuilder::new("INSERT OR IGNORE INTO ruleset (track_hash, rules) ")
                        .push_values(rules_map.iter().take(32000), |mut b, (hash, rules)| {
                            b.push_bind(hash).push_bind(rules);
                        })
                        .build()
                        .execute(&self.pool)
                        .await?;
                }
            }
        }

        Ok(())
    }

    pub async fn backup(&self, dir: impl AsRef<Path>) -> Result<PathBuf> {
        // TODO: ? access app name from config
        let path = dir.as_ref().join("meowsic_backup.zip");

        let file = fs::File::create(&path)?;
        let mut zip = ZipWriter::new(file);

        for (index, playlist) in self.get_playlists().await?.iter().enumerate() {
            let list: Vec<(String, String, i64)> = sqlx::query_as(
                "
                SELECT t.name, t.extension, pt.position
                FROM tracks AS t
                JOIN playlist_tracks AS pt ON pt.track_hash = t.hash
                WHERE pt.playlist_name = $1                
                ",
            )
            .bind(playlist)
            .fetch_all(&self.pool)
            .await?;

            if list.is_empty() {
                continue;
            }

            let data = json!({
                "name": playlist,
                "list": list.into_iter().map(|(name, extension, position)| json!({
                    "file_name": format!("{name}.{extension}"),
                    "position": position
                })).collect::<Vec<_>>(),
            });

            zip.start_file(format!("playlist_{index}.json"), ZipFileOptions::default())?;
            zip.write_all(serde_json::to_string(&data)?.as_bytes())?;
        }

        for emotion in self.get_emotions().await? {
            let name = emotion.name;

            let list: Vec<(String, String, i64)> = sqlx::query_as(
                "
                SELECT t.name, t.extension, et.rank
                FROM tracks AS t
                JOIN emotion_tracks AS et ON et.track_hash = t.hash
                WHERE et.emotion_name = $1                
                ",
            )
            .bind(&name)
            .fetch_all(&self.pool)
            .await?;

            if list.is_empty() {
                continue;
            }

            let data = json!({
                "name": name,
                "list": list.into_iter().map(|(name, extension, rank)| json!({
                    "file_name": format!("{name}.{extension}"),
                    "rank": rank
                })).collect::<Vec<_>>(),
            });

            zip.start_file(format!("emotion_{name}.json"), ZipFileOptions::default())?;
            zip.write_all(serde_json::to_string(&data)?.as_bytes())?;
        }

        let list: Vec<TrackExtendedRow> = sqlx::query_as(
            "
            SELECT
                t.name AS name,
                t.extension AS extension,
                l.plain AS plain_lyrics,
                l.synced AS synced_lyrics,
                r.rules AS rules
            FROM tracks AS t
            LEFT JOIN lyrics AS l ON l.track_hash = t.hash
            LEFT JOIN ruleset AS r ON r.track_hash = t.hash
            WHERE 
                (l.id IS NOT NULL) OR (r.id IS NOT NULL AND r.rules <> '')
            ",
        )
        .fetch_all(&self.pool)
        .await?;

        if !list.is_empty() {
            let data = list.into_iter().map(|item| {
                json!({
                    "file_name": format!("{}.{}", item.name, item.extension),
                    "rules": item.rules.filter(|x| !x.trim().is_empty()),
                    "lyrics": (item.plain_lyrics.is_some() || item.synced_lyrics.is_some()).then(|| {
                        Lyrics {
                            plain: item.plain_lyrics.unwrap_or_default(),
                            synced: item.synced_lyrics.unwrap_or_default()
                        }
                    }),
                })
            }).collect::<Vec<_>>();

            zip.start_file("tracks_extended.json", ZipFileOptions::default())?;
            zip.write_all(serde_json::to_string(&data)?.as_bytes())?;
        }

        zip.finish()?;

        Ok(path)
    }

    pub async fn reset(&self) -> Result<()> {
        _ = fs::remove_dir_all(&self.covers_path);

        sqlx::query(include_str!("sql/uninit.sql"))
            .execute(&self.pool)
            .await?;

        self.init().await?;

        Ok(())
    }

    pub async fn init(&self) -> Result<()> {
        fs::create_dir_all(&self.covers_path)?;

        sqlx::query(include_str!("sql/init.sql"))
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}

#[derive(sqlx::FromRow)]
pub struct TrackRow {
    pub hash: String,
    pub path: String,
    pub name: String,
    pub extension: String,
    pub duration: i64,
    pub cover: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub date: Option<String>,
    pub genre: Option<String>,
    pub rules: Option<String>,
    pub number: Option<i64>,
    #[sqlx(default)]
    pub position: Option<i64>,
    #[sqlx(default)]
    pub rank: Option<i64>,
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct TrackExtendedRow {
    pub name: String,
    pub extension: String,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
    pub rules: Option<String>,
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct Emotion {
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Deserialize)]
pub struct GetTracksFilters {
    pub album: Option<String>,
    pub artist: Option<String>,
}
