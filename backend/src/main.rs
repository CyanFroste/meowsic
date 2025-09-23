// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod players;
mod tracks;
mod utils;

use anyhow::Result;
use db::Db;
use parking_lot::Mutex;
use players::{Player, ScrubPlayer};
use rodio::{OutputStream, Sink};
use serde::Serialize;
use std::sync::Arc;
use tauri::{Builder, Emitter, Manager};
use tokio::runtime::Handle as RuntimeHandle;
use tracks::Track;

#[tokio::main]
async fn main() -> Result<()> {
    // ! DO NOT DROP _stream (don't assign to just '_')
    let (_stream, handle) = OutputStream::try_default()?;
    let sink = Sink::try_new(&handle)?;
    let player = Arc::new(Mutex::new(Player::new(sink)?));

    // ! DO NOT DROP _stream (don't assign to just '_')
    let (_stream, handle) = OutputStream::try_default()?;
    let sink = Sink::try_new(&handle)?;
    let scrub_player = Arc::new(Mutex::new(ScrubPlayer::new(sink)?));

    let mut builder = Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if let Some(window) = app.get_webview_window("main") {
                _ = window.set_focus();
            }

            if let Some(path) = args.get(1) {
                let state = app.state::<AppState>();

                if let Ok(track) = Track::new(path, &state.db.covers_path) {
                    _ = app.emit("play-arbitrary-track", track);
                }
            }
        }));

        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let tauri::Config { product_name, .. } = app.config();

            let name = product_name.as_deref().unwrap_or(env!("CARGO_PKG_NAME"));
            let data_path = app.path().document_dir()?.join(name);

            let covers_path = data_path.join("covers");
            let db = Db::new(data_path.join(format!("{name}.db")), &covers_path);

            // could always do this from UI side but, oh well
            tokio::task::block_in_place(|| RuntimeHandle::current().block_on(db.init()))?;

            if let Some(path) = std::env::args().nth(1) {
                if let Ok(track) = Track::new(path, &covers_path) {
                    player.lock().arbitrary_tracks.push(track);
                }
            }

            app.manage(AppState {
                player,
                scrub_player,
                db,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::player_set_queue,
            commands::player_goto,
            commands::player_seek,
            commands::player_stop,
            commands::player_play,
            commands::player_pause,
            commands::player_set_current,
            commands::player_is_paused,
            commands::player_set_volume,
            commands::player_get_arbitrary_tracks,
            commands::scrub_player_start,
            commands::scrub_player_set_current,
            commands::scrub_player_seek,
            commands::scrub_player_stop,
            commands::scrub_player_play,
            commands::scrub_player_pause,
            commands::db_get_tracks,
            commands::db_get_track,
            commands::db_get_playlists,
            commands::db_add_playlist,
            commands::db_rename_playlist,
            commands::db_remove_playlist,
            commands::db_get_playlist_tracks,
            commands::db_add_playlist_tracks,
            commands::db_remove_playlist_tracks,
            commands::db_reorder_playlist_track,
            commands::db_get_emotions,
            commands::db_get_emotion_tracks,
            commands::db_rank_up_emotion_track,
            commands::db_get_albums,
            commands::db_get_artists,
            commands::db_get_lyrics,
            commands::db_set_lyrics,
            commands::db_set_rules,
            commands::db_scan_dirs,
            commands::db_get_dirs,
            commands::db_set_dirs,
            commands::db_backup,
            commands::db_restore,
            commands::db_reset,
        ])
        .run(tauri::generate_context!())?;

    Ok(())
}

struct AppState {
    player: Arc<Mutex<Player>>,
    scrub_player: Arc<Mutex<ScrubPlayer>>,
    db: Db,
}

#[derive(Debug, Clone, Serialize)]
struct Error {
    message: String,
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}
