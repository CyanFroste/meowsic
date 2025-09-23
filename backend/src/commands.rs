use crate::db::{Emotion, GetTracksFilters};
use crate::tracks::{Album, Lyrics, Track};
use crate::{AppState, Error};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn player_set_queue(state: State<AppState, '_>, queue: Vec<PathBuf>) -> Result<(), Error> {
    state.player.lock().set_queue(queue);

    Ok(())
}

#[tauri::command]
pub fn player_goto(state: State<AppState, '_>, index: usize) -> Result<(), Error> {
    state.player.lock().goto(index)?;

    Ok(())
}

#[tauri::command]
pub fn player_seek(state: State<AppState, '_>, elapsed: u64) -> Result<(), Error> {
    state.player.lock().seek(elapsed)?;

    Ok(())
}

#[tauri::command]
pub fn player_stop(state: State<AppState, '_>) -> Result<(), Error> {
    state.player.lock().stop();

    Ok(())
}

#[tauri::command]
pub fn player_play(state: State<AppState, '_>) -> Result<(), Error> {
    state.player.lock().play();

    Ok(())
}

#[tauri::command]
pub fn player_pause(state: State<AppState, '_>) -> Result<(), Error> {
    state.player.lock().pause();

    Ok(())
}

#[tauri::command]
pub fn player_set_current(state: State<AppState, '_>, index: usize) -> Result<(), Error> {
    state.player.lock().set_current(index)?;

    Ok(())
}

#[tauri::command]
pub fn player_is_paused(state: State<AppState, '_>) -> Result<bool, Error> {
    let res = state.player.lock().is_paused();

    Ok(res)
}

#[tauri::command]
pub fn player_set_volume(state: State<AppState, '_>, volume: f32) -> Result<(), Error> {
    state.player.lock().set_volume(volume);

    Ok(())
}

#[tauri::command]
pub fn player_get_arbitrary_tracks(state: State<AppState, '_>) -> Result<Vec<Track>, Error> {
    let res = state.player.lock().arbitrary_tracks.clone();

    Ok(res)
}

#[tauri::command]
pub fn scrub_player_start(state: State<AppState, '_>) -> Result<(), Error> {
    state.scrub_player.lock().start()?;

    Ok(())
}

#[tauri::command]
pub fn scrub_player_set_current(
    state: State<AppState, '_>,
    path: Option<PathBuf>,
) -> Result<(), Error> {
    state.scrub_player.lock().set_current(path);

    Ok(())
}

#[tauri::command]
pub fn scrub_player_seek(state: State<AppState, '_>, elapsed: u64) -> Result<(), Error> {
    state.scrub_player.lock().seek(elapsed)?;

    Ok(())
}

#[tauri::command]
pub fn scrub_player_stop(state: State<AppState, '_>) -> Result<(), Error> {
    state.scrub_player.lock().stop();

    Ok(())
}

#[tauri::command]
pub fn scrub_player_play(state: State<AppState, '_>) -> Result<(), Error> {
    state.scrub_player.lock().play();

    Ok(())
}

#[tauri::command]
pub fn scrub_player_pause(state: State<AppState, '_>) -> Result<(), Error> {
    state.scrub_player.lock().pause();

    Ok(())
}

#[tauri::command]
pub async fn db_get_tracks(
    state: State<AppState, '_>,
    filters: GetTracksFilters,
) -> Result<Vec<Track>, Error> {
    let res = state.db.get_tracks(&filters).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_get_track(
    state: State<AppState, '_>,
    hash: String,
) -> Result<Option<Track>, Error> {
    let res = state.db.get_track(&hash).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_get_playlists(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    let res = state.db.get_playlists().await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_add_playlist(state: State<AppState, '_>, name: String) -> Result<(), Error> {
    state.db.add_playlist(name).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_rename_playlist(
    state: State<AppState, '_>,
    name: String,
    new_name: String,
) -> Result<(), Error> {
    state.db.rename_playlist(name, new_name).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_remove_playlist(state: State<AppState, '_>, name: String) -> Result<(), Error> {
    state.db.remove_playlist(name).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_get_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
) -> Result<Vec<Track>, Error> {
    let res = state.db.get_playlist_tracks(name).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_add_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
    hashes: Vec<String>,
) -> Result<(), Error> {
    state.db.add_playlist_tracks(name, &hashes).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_remove_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
    hashes: Option<Vec<String>>,
) -> Result<(), Error> {
    state
        .db
        .remove_playlist_tracks(name, hashes.as_deref())
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn db_reorder_playlist_track(
    state: State<AppState, '_>,
    name: String,
    hash: String,
    src: i64,
    dst: i64,
) -> Result<(), Error> {
    state
        .db
        .reorder_playlist_track(name, hash, src, dst)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn db_get_emotions(state: State<AppState, '_>) -> Result<Vec<Emotion>, Error> {
    let res = state.db.get_emotions().await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_get_emotion_tracks(
    state: State<AppState, '_>,
    name: String,
) -> Result<Vec<Track>, Error> {
    let res = state.db.get_emotion_tracks(name).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_rank_up_emotion_track(
    state: State<AppState, '_>,
    name: String,
    hash: String,
) -> Result<(), Error> {
    state.db.rank_up_emotion_track(name, hash).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_get_albums(state: State<AppState, '_>) -> Result<Vec<Album>, Error> {
    let res = state.db.get_albums().await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_get_artists(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    let res = state.db.get_artists().await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_get_lyrics(
    state: State<AppState, '_>,
    hash: String,
) -> Result<Option<Lyrics>, Error> {
    let res = state.db.get_lyrics(&hash).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_set_lyrics(
    state: State<AppState, '_>,
    hash: String,
    lyrics: Option<Lyrics>,
) -> Result<(), Error> {
    state.db.set_lyrics(&hash, lyrics.as_ref()).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_set_rules(
    state: State<AppState, '_>,
    hash: String,
    rules: Option<String>,
) -> Result<(), Error> {
    state.db.set_rules(&hash, rules.as_ref()).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_scan_dirs(state: State<AppState, '_>) -> Result<String, Error> {
    let dirs = state.db.get_dirs().await?;
    let res = state.db.scan_dirs(&dirs).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_set_dirs(state: State<AppState, '_>, dirs: Vec<String>) -> Result<(), Error> {
    state.db.set_dirs(&dirs).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_get_dirs(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    let res = state.db.get_dirs().await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_backup(state: State<AppState, '_>, dir: PathBuf) -> Result<PathBuf, Error> {
    let res = state.db.backup(&dir).await?;

    Ok(res)
}

#[tauri::command]
pub async fn db_restore(state: State<AppState, '_>, path: PathBuf) -> Result<(), Error> {
    state.db.restore(&path).await?;

    Ok(())
}

#[tauri::command]
pub async fn db_reset(state: State<AppState, '_>) -> Result<(), Error> {
    state.db.reset().await?;

    Ok(())
}
