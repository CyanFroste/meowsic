// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod players;
mod streaming;
mod tracks;
mod utils;

use anyhow::Result;
use db::Db;
use players::{Player, ScrubPlayer};
use rodio::{OutputStream, Sink};
use serde::Serialize;
use std::sync::Arc;
use streaming::StreamingClient;
use tauri::{Builder, Manager};
use tauri_plugin_http::reqwest::Client as HttpClient;
use tokio::runtime::Handle as RuntimeHandle;
use tokio::sync::{Mutex, RwLock};
use tracks::Track;

use crate::utils::Platform;

#[tokio::main]
async fn main() -> Result<()> {
    // ! DO NOT DROP _stream (don't assign to just '_')
    let (_stream, handle) = OutputStream::try_default()?;
    let player_sink = Sink::try_new(&handle)?;

    // ! DO NOT DROP _stream (don't assign to just '_')
    let (_stream, handle) = OutputStream::try_default()?;
    let scrub_player_sink = Sink::try_new(&handle)?;

    let mut builder = Builder::default();

    #[cfg(desktop)]
    {
        #[cfg(not(debug_assertions))]
        {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _| {
                if let Some(window) = app.get_webview_window("main") {
                    _ = window.set_focus();
                }

                if let Some(path) = args.get(1) {
                    let state = app.state::<AppState>();

                    if let Ok(track) = Track::from_file(path, &state.db.covers_path) {
                        _ = app.emit("play-arbitrary-track", track);
                    }
                }
            }));
        }

        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let tauri::Config {
                product_name,
                version,
                ..
            } = app.config();

            let name = product_name.as_deref().unwrap_or(env!("CARGO_PKG_NAME"));
            let version = version.as_deref().unwrap_or(env!("CARGO_PKG_VERSION"));
            let data_path = app.path().document_dir()?.join(name);

            let http_client = HttpClient::builder()
                .user_agent(format!("{name}/{version}"))
                .build()?;

            let covers_path = data_path.join("covers");
            let db = Db::new(data_path.join(format!("{name}.db")), &covers_path);

            let platform = Platform::current();
            let data_path = app.path().app_data_dir()?;
            let cache_path = app.path().app_cache_dir()?;

            let mut streaming_client = StreamingClient::new(
                db.clone(),
                http_client.clone(),
                platform,
                data_path,
                cache_path,
            );

            // could always do this from UI side but, oh well
            tokio::task::block_in_place(|| RuntimeHandle::current().block_on(db.init()))?;
            streaming_client.init();

            let streaming_client = Arc::new(RwLock::new(streaming_client));

            let player = Arc::new(Mutex::new(Player::new(
                player_sink,
                streaming_client.clone(),
            )?));

            let scrub_player = Arc::new(Mutex::new(ScrubPlayer::new(scrub_player_sink)?));

            if let Some(path) = std::env::args().nth(1) {
                if let Ok(track) = Track::from_file(path, &covers_path) {
                    tokio::task::block_in_place(|| {
                        RuntimeHandle::current().block_on(async {
                            player.lock().await.arbitrary_tracks.push(track);
                        })
                    });
                }
            }

            app.manage(AppState {
                db,
                player,
                scrub_player,
                streaming_client,
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
            commands::streaming_search,
            commands::streaming_get_tracks,
            commands::streaming_scan_urls,
            commands::streaming_load_dependencies,
            commands::streaming_install_dependencies,
            commands::streaming_get_dependencies,
        ])
        .run(tauri::generate_context!())?;

    Ok(())
}

struct AppState {
    db: Db,
    player: Arc<Mutex<Player>>,
    scrub_player: Arc<Mutex<ScrubPlayer>>,
    streaming_client: Arc<RwLock<StreamingClient>>,
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
