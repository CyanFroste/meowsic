use crate::tracks::Track;
use anyhow::{Result, anyhow};
use rodio::{Decoder, Player as ExternalPlayer};
use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::Duration;

// ? TODO: send position to frontend

pub struct Player {
    player: ExternalPlayer,
    current: usize,
    pub queue: Vec<PathBuf>,
    pub arbitrary_tracks: Vec<Track>,
}

impl Player {
    pub fn new(player: ExternalPlayer) -> Result<Self> {
        player.pause();

        Ok(Self {
            player,
            current: 0,
            queue: vec![],
            arbitrary_tracks: vec![],
        })
    }

    pub fn goto(&mut self, index: usize) -> Result<()> {
        self.set_current(index)?;
        self.stop();

        self.player.load(&self.queue[self.current])
    }

    pub fn seek(&self, elapsed: u64) -> Result<()> {
        self.player
            .try_seek(Duration::from_secs(elapsed))
            .map_err(|err| anyhow!("{err}"))
    }

    pub fn stop(&self) {
        self.player.stop();
    }

    pub fn play(&self) {
        self.player.play();
    }

    pub fn pause(&self) {
        self.player.pause();
    }

    pub fn set_queue(&mut self, queue: Vec<PathBuf>) {
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
        self.player.is_paused()
    }

    pub fn set_volume(&self, volume: f32) {
        self.player.set_volume(volume);
    }

    // pub fn set_speed(&self, speed: f32) {
    //     self.sink.set_speed(speed);
    // }
}

pub struct ScrubPlayer {
    player: ExternalPlayer,
    current: Option<PathBuf>,
}

impl ScrubPlayer {
    pub fn new(player: ExternalPlayer) -> Result<Self> {
        player.pause();

        Ok(Self {
            player,
            current: None,
        })
    }

    pub fn start(&mut self) -> Result<()> {
        self.stop();

        if let Some(path) = &self.current {
            self.player.load(path)
        } else {
            Err(anyhow!("No track selected"))
        }
    }

    pub fn seek(&self, elapsed: u64) -> Result<()> {
        self.player
            .try_seek(Duration::from_secs(elapsed))
            .map_err(|err| anyhow!("{err}"))
    }

    pub fn set_current(&mut self, path: Option<PathBuf>) {
        self.current = path;
    }

    pub fn stop(&self) {
        self.player.stop();
    }

    pub fn play(&self) {
        self.player.play();
    }

    pub fn pause(&self) {
        self.player.pause();
    }
}

trait PlayerExt {
    fn load(&self, path: impl AsRef<Path>) -> Result<()>;
}

impl PlayerExt for ExternalPlayer {
    fn load(&self, path: impl AsRef<Path>) -> Result<()> {
        let file = File::open(path)?;
        let source = Decoder::try_from(file)?;

        self.append(source);

        Ok(())
    }
}
