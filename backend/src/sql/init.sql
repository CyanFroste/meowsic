CREATE TABLE IF NOT EXISTS dirs (                
    path    TEXT    PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS tracks (                
    hash            TEXT        PRIMARY KEY,
    source          TEXT        NOT NULL,
    path            TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    extension       TEXT        NOT NULL,
    duration        INTEGER     NOT NULL,
    cover           TEXT,
    title           TEXT,
    artist          TEXT,
    album           TEXT,
    album_artist    TEXT,
    date            TEXT,
    genre           TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
    name    TEXT    PRIMARY KEY                
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_name   TEXT        NOT NULL,
    track_hash      TEXT        NOT NULL,
    position        INTEGER     NOT NULL,

    PRIMARY KEY (playlist_name, track_hash),
    FOREIGN KEY (playlist_name) REFERENCES playlists(name)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS emotions (
    name    TEXT    PRIMARY KEY,
    icon    TEXT    NOT NULL,
    color   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS emotion_tracks (
    emotion_name        TEXT        NOT NULL,
    track_hash          TEXT        NOT NULL,
    rank                INTEGER     NOT NULL,

    PRIMARY KEY (emotion_name, track_hash),
    FOREIGN KEY (emotion_name) REFERENCES emotions(name)
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT OR IGNORE INTO emotions 
    (name, color, icon) 
VALUES 
    ('Happy',  '#ffd700', 'happy.png'),
    ('Sad',  '#6b5b95', 'sad.png'),
    ('Love', '#ff6b6b', 'love.png'),
    ('Angry', '#d93025', 'angry.png'),
    ('Serene', '#a8d8b9', 'serene.png'),    
    ('Neutral', '#fff1e6', 'neutral.png');

CREATE TABLE IF NOT EXISTS lyrics (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    track_hash      TEXT        NOT NULL,
    plain           TEXT        NOT NULL,
    synced          TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS ruleset (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    track_hash      TEXT        NOT NULL,
    rules           TEXT        NOT NULL
);
