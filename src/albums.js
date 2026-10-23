// Record albums for the stereo. They live on the top shelf of the bookshelf (books never use that shelf).
//
// free: can be added from the Catalogue now. premium: listed there but locked (a future pay-based unlock).
// track: the first track (key into TRACKS in audio.js); tracks: every track on the record, in play order. Only tracks that exist can play;
// premium albums get theirs when they are unlocked.

export const ALBUM_CATALOG = [
  { id: 'happy', title: 'Happy Time Parade', genre: "Kids' energetic songs", icon: '🎈', color: 0xf2a81d, accent: 0xe8452c, free: true, track: 'happy', tracks: ['happy', 'happy2', 'happy3', 'happy4'],
    desc: 'Bouncy, bright and fast: the stereo plays an energetic singalong.' },
  { id: 'rock', title: 'Garage Thunder', genre: 'Rock', icon: '🎸', color: 0x8a1c1c, accent: 0xffc83a, free: true, track: 'rock', tracks: ['rock', 'rock2', 'rock3', 'rock4'],
    desc: 'Loud power chords and a driving beat.' },
  { id: 'hiphop', title: 'Rooftop Beats', genre: 'Hip-Hop', icon: '🎤', color: 0x2c2f6b, accent: 0xff7a1a, free: true, track: 'hiphop', tracks: ['hiphop', 'hiphop2', 'hiphop3', 'hiphop4'],
    desc: 'A slow head-nod beat with a deep bass and a bell hook.' },
  { id: 'twostep', title: 'Dusty Road Two-Step', genre: 'Country (upbeat)', icon: '🪕', color: 0xa0652a, accent: 0xfff0c0, free: true, track: 'twostep', tracks: ['twostep', 'twostep2', 'twostep3', 'twostep4'],
    desc: 'A train-beat shuffle with a sawing fiddle.' },
  { id: 'pop', title: 'Neon Sugar', genre: 'Pop', icon: '✨', color: 0xc2358f, accent: 0x6ff3ff, free: true, track: 'pop', tracks: ['pop', 'pop2', 'pop3', 'pop4'],
    desc: 'Bright synths, claps and a hook you will hum all day.' },
  { id: 'jazz', title: 'Midnight Swing Club', genre: 'Jazz', icon: '🎺', color: 0x1d2b3a, accent: 0xe8c36a, free: true, track: 'jazz', tracks: ['jazz', 'jazz2', 'jazz3', 'jazz4'],
    desc: 'Walking bass, a swinging ride cymbal and a smoky horn.' },
  { id: 'slowblues', title: 'Rainy Day Blues', genre: 'Slow blues', icon: '🌧️', color: 0x233a5c, accent: 0xa7c7ff, free: true, track: 'slowblues', tracks: ['slowblues', 'slowblues2', 'slowblues3', 'slowblues4'],
    desc: 'A slow twelve-bar in A minor with organ and bending guitar.' },
  { id: 'party', title: 'Party Time Mixtape', genre: 'Party music', icon: '🪩', color: 0x5a1f9a, accent: 0xffe14d, free: true, track: 'party', tracks: ['party', 'party2', 'party3', 'party4'],
    desc: 'Four on the floor. Do not stand still.' },
  { id: 'classical', title: 'Hits from the Old Days', genre: 'Classical (Beethoven era) hits', icon: '🎻', color: 0x5b4636, accent: 0xd8c8a0, premium: true, track: 'classical', tracks: ['classical', 'classical2', 'classical3', 'classical4'],
    desc: 'Grand piano and strings from the age of Beethoven.' },
  { id: 'country', title: 'Sad Country', genre: 'Country Western', icon: '🤠', color: 0x6d4c2f, accent: 0xe0b060, premium: true, track: 'country', tracks: ['country', 'country2', 'country3', 'country4'],
    desc: 'Slow guitars and lonesome stories.' },
  { id: 'blues', title: 'Blues Collection', genre: 'Blues guitar songs', icon: '🎷', color: 0x1f3f7a, accent: 0x7fb4ff, premium: true, track: 'blues', tracks: ['blues', 'blues2', 'blues3', 'blues4'],
    desc: 'Twelve-bar blues with a lot of feeling.' },
  { id: 'lullaby', title: 'Out like a Lamb', genre: 'Lullabies', icon: '🌙', color: 0x7a6aa8, accent: 0xf0e8ff, premium: true, track: 'lullaby', tracks: ['lullaby', 'lullaby2', 'lullaby3', 'lullaby4'],
    desc: 'Soft songs for sleepy robots.' },
];
