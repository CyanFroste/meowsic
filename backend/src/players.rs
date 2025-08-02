use crate::streaming::{Dependencies, StreamingClient};
use crate::tracks::{Track, TrackPath};
use anyhow::{Context, Result, anyhow};
use rodio::{Decoder, Sink};
use std::collections::{HashMap, VecDeque};
use std::fs::File;
use std::io::{BufReader, Cursor};
use std::path::{Path, PathBuf};
use std::process;
use std::sync::Arc;
use std::time::Duration;
use tauri_plugin_http::reqwest::Url;
use tokio::sync::RwLock;

// ? TODO: send position to frontend

pub struct Player {
    sink: Sink,
    current: usize,
    pub queue: Vec<TrackPath>,
    pub arbitrary_tracks: Vec<Track>,
    streaming_client: Arc<RwLock<StreamingClient>>,
    cache: Cache,
}

impl Player {
    pub fn new(sink: Sink, streaming_client: Arc<RwLock<StreamingClient>>) -> Result<Self> {
        sink.pause();

        Ok(Self {
            sink,
            current: 0,
            queue: vec![],
            arbitrary_tracks: vec![],
            streaming_client,
            cache: Cache::new(200 * 1024 * 1024), // 200mb; TODO: make configurable
        })
    }

    pub async fn goto(&mut self, index: usize) -> Result<()> {
        self.set_current(index)?;
        self.stop();

        match &self.queue[self.current] {
            TrackPath::File(path) => self.sink.load_file(path),
            TrackPath::Link(url) => {
                let lock = self.streaming_client.read().await;
                let dependencies = lock
                    .dependencies
                    .as_ref()
                    .context("Missing Dependencies to load Track from URL")?;

                self.sink.load_url(url, dependencies, &mut self.cache)
            }
        }
    }

    pub fn seek(&self, elapsed: u64) -> Result<()> {
        self.sink
            .try_seek(Duration::from_secs(elapsed))
            .map_err(|err| anyhow!("{err}"))
    }

    pub fn stop(&self) {
        self.sink.stop();
    }

    pub fn play(&self) {
        self.sink.play();
    }

    pub fn pause(&self) {
        self.sink.pause();
    }

    pub fn set_queue(&mut self, queue: Vec<TrackPath>) {
        self.queue = queue;
    }

    pub fn set_current(&mut self, index: usize) -> Result<()> {
        // ? 0 is allowed as a valid default index
        // ? so bounds check can be > queue length
        if index > self.queue.len() {
            Err(anyhow!("Index out of bounds"))
        } else if index == self.current {
            Ok(())
        } else {
            self.current = index;
            Ok(())
        }
    }

    pub fn is_paused(&self) -> bool {
        self.sink.is_paused()
    }

    pub fn set_volume(&self, volume: f32) {
        self.sink.set_volume(volume);
    }

    // pub fn set_speed(&self, speed: f32) {
    //     self.sink.set_speed(speed);
    // }
}

pub struct ScrubPlayer {
    sink: Sink,
    current: Option<PathBuf>,
}

impl ScrubPlayer {
    pub fn new(sink: Sink) -> Result<Self> {
        sink.pause();

        Ok(Self {
            sink,
            current: None,
        })
    }

    pub fn start(&mut self) -> Result<()> {
        self.stop();

        if let Some(path) = &self.current {
            self.sink.load_file(path)
        } else {
            Err(anyhow!("No track selected"))
        }
    }

    pub fn seek(&self, elapsed: u64) -> Result<()> {
        self.sink
            .try_seek(Duration::from_secs(elapsed))
            .map_err(|err| anyhow!("{err}"))
    }

    pub fn set_current(&mut self, path: Option<PathBuf>) {
        self.current = path;
    }

    pub fn stop(&self) {
        self.sink.stop();
    }

    pub fn play(&self) {
        self.sink.play();
    }

    pub fn pause(&self) {
        self.sink.pause();
    }
}

trait SinkExt {
    fn load_file(&self, path: impl AsRef<Path>) -> Result<()>;
    fn load_url(&self, url: &Url, dependencies: &Dependencies, cache: &mut Cache) -> Result<()>;
}

impl SinkExt for Sink {
    fn load_file(&self, path: impl AsRef<Path>) -> Result<()> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let source = Decoder::new(reader)?;

        self.append(source);

        Ok(())
    }

    fn load_url(&self, url: &Url, dependencies: &Dependencies, cache: &mut Cache) -> Result<()> {
        match url.host_str() {
            Some("www.youtube.com" | "youtube.com") => {
                let buf = if let Some(cached) = cache.get(url.as_str()) {
                    cached.clone()
                } else {
                    // TODO: timeout
                    let output = process::Command::new(&dependencies.yt_dlp)
                        .args(["-f", "bestaudio", "-g", url.as_str()])
                        .output()?;

                    let direct_url = String::from_utf8(output.stdout)?.trim().to_string();

                    #[rustfmt::skip]
                    let output = process::Command::new(&dependencies.ffmpeg)
                        .args([
                            "-reconnect", "1", 
                            "-reconnect_streamed", "1", 
                            "-reconnect_delay_max", "5", 
                            "-i", &direct_url,
                            "-vn", // no video
                            "-f", "wav", // rodio-friendly
                            "-acodec", "pcm_s16le", // fast PCM encoding
                            "-ac", "2",
                            "-ar", "44100",
                            "-loglevel", "quiet",
                            "pipe:1",
                        ])
                        .output()?;

                    cache.insert(url.to_string(), output.stdout.clone());
                    output.stdout
                };

                let cursor = Cursor::new(buf);
                let reader = BufReader::new(cursor);
                let source = Decoder::new(reader)?;

                self.append(source);

                Ok(())
            }

            _ => Err(anyhow!("Unsupported URL")),
        }
    }
}

struct Cache {
    map: HashMap<String, Vec<u8>>,
    order: VecDeque<String>,
    max_size: usize,
    current_size: usize,
}

impl Cache {
    fn new(max_size: usize) -> Self {
        Self {
            map: HashMap::new(),
            order: VecDeque::new(),
            max_size,
            current_size: 0,
        }
    }

    fn insert(&mut self, key: String, data: Vec<u8>) {
        // remove existing entry if inserting again
        if let Some(old) = self.map.remove(&key) {
            self.current_size -= old.len();
            self.order.retain(|k| k != &key);
        }

        // evict old entries if over size limit
        while self.current_size + data.len() > self.max_size {
            if let Some(old_key) = self.order.pop_front() {
                if let Some(old_data) = self.map.remove(&old_key) {
                    self.current_size -= old_data.len();
                }
            } else {
                break;
            }
        }

        self.current_size += data.len();
        self.order.push_back(key.clone());
        self.map.insert(key, data);
    }

    fn get(&self, key: &str) -> Option<&Vec<u8>> {
        self.map.get(key)
    }
}
