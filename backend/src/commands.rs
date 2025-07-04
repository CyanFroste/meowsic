use crate::db::{Emotion, GetTracksFilters};
use crate::tracks::{Album, Track, find_artist_image};
use crate::{AppState, Error};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn player_set_queue(state: State<AppState, '_>, queue: Vec<PathBuf>) -> Result<(), Error> {
    Ok(state.player.lock().set_queue(queue))
}

#[tauri::command]
pub fn player_goto(state: State<AppState, '_>, index: usize) -> Result<(), Error> {
    Ok(state.player.lock().goto(index)?)
}

#[tauri::command]
pub fn player_seek(state: State<AppState, '_>, elapsed: u64) -> Result<(), Error> {
    Ok(state.player.lock().seek(elapsed)?)
}

#[tauri::command]
pub fn player_stop(state: State<AppState, '_>) -> Result<(), Error> {
    Ok(state.player.lock().stop())
}

#[tauri::command]
pub fn player_play(state: State<AppState, '_>) -> Result<(), Error> {
    Ok(state.player.lock().play())
}

#[tauri::command]
pub fn player_pause(state: State<AppState, '_>) -> Result<(), Error> {
    Ok(state.player.lock().pause())
}

#[tauri::command]
pub fn player_set_current(state: State<AppState, '_>, index: usize) -> Result<(), Error> {
    Ok(state.player.lock().set_current(index)?)
}

#[tauri::command]
pub fn player_is_paused(state: State<AppState, '_>) -> Result<bool, Error> {
    Ok(state.player.lock().is_paused())
}

#[tauri::command]
pub fn player_set_volume(state: State<AppState, '_>, volume: f32) -> Result<(), Error> {
    Ok(state.player.lock().set_volume(volume))
}

#[tauri::command]
pub fn player_get_arbitrary_tracks(state: State<AppState, '_>) -> Result<Vec<Track>, Error> {
    Ok(state.player.lock().arbitrary_tracks.clone())
}

#[tauri::command]
pub async fn db_get_tracks(
    state: State<AppState, '_>,
    filters: GetTracksFilters,
) -> Result<Vec<Track>, Error> {
    Ok(state.db.get_tracks(&filters).await?)
}

#[tauri::command]
pub async fn db_get_playlists(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    Ok(state.db.get_playlists().await?)
}

#[tauri::command]
pub async fn db_add_playlist(state: State<AppState, '_>, name: String) -> Result<(), Error> {
    Ok(state.db.add_playlist(name).await?)
}

#[tauri::command]
pub async fn db_rename_playlist(
    state: State<AppState, '_>,
    name: String,
    new_name: String,
) -> Result<(), Error> {
    Ok(state.db.rename_playlist(name, new_name).await?)
}

#[tauri::command]
pub async fn db_remove_playlist(state: State<AppState, '_>, name: String) -> Result<(), Error> {
    Ok(state.db.remove_playlist(name).await?)
}

#[tauri::command]
pub async fn db_get_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
) -> Result<Vec<Track>, Error> {
    Ok(state.db.get_playlist_tracks(name).await?)
}

#[tauri::command]
pub async fn db_add_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
    hashes: Vec<String>,
) -> Result<(), Error> {
    Ok(state.db.add_playlist_tracks(name, &hashes).await?)
}

#[tauri::command]
pub async fn db_remove_playlist_tracks(
    state: State<AppState, '_>,
    name: String,
    hashes: Option<Vec<String>>,
) -> Result<(), Error> {
    Ok(state
        .db
        .remove_playlist_tracks(name, hashes.as_deref())
        .await?)
}

#[tauri::command]
pub async fn db_reorder_playlist_track(
    state: State<AppState, '_>,
    name: String,
    hash: String,
    src: i64,
    dst: i64,
) -> Result<(), Error> {
    Ok(state
        .db
        .reorder_playlist_track(name, hash, src, dst)
        .await?)
}

#[tauri::command]
pub async fn db_get_emotions(state: State<AppState, '_>) -> Result<Vec<Emotion>, Error> {
    Ok(state.db.get_emotions().await?)
}

#[tauri::command]
pub async fn db_get_emotion_tracks(
    state: State<AppState, '_>,
    name: String,
) -> Result<Vec<Track>, Error> {
    Ok(state.db.get_emotion_tracks(name).await?)
}

#[tauri::command]
pub async fn db_rank_up_emotion_track(
    state: State<AppState, '_>,
    name: String,
    hash: String,
) -> Result<(), Error> {
    Ok(state.db.rank_up_emotion_track(name, hash).await?)
}

#[tauri::command]
pub async fn db_get_albums(state: State<AppState, '_>) -> Result<Vec<Album>, Error> {
    Ok(state.db.get_albums().await?)
}

#[tauri::command]
pub async fn db_get_artists(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    Ok(state.db.get_artists().await?)
}

#[tauri::command]
pub async fn db_scan_dirs(state: State<AppState, '_>) -> Result<(), Error> {
    Ok(state.db.scan_dirs(&state.db.get_dirs().await?).await?)
}

#[tauri::command]
pub async fn db_set_dirs(state: State<AppState, '_>, dirs: Vec<String>) -> Result<(), Error> {
    Ok(state.db.set_dirs(&dirs).await?)
}

#[tauri::command]
pub async fn db_get_dirs(state: State<AppState, '_>) -> Result<Vec<String>, Error> {
    Ok(state.db.get_dirs().await?)
}

#[tauri::command]
pub async fn tracks_find_artist_image(
    state: State<AppState, '_>,
    name: String,
) -> Result<Option<String>, Error> {
    Ok(find_artist_image(&state.http_client, name).await?)
}
