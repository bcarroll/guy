// Record albums for the stereo. They live on the top shelf of the bookshelf (books never use that shelf).
//
// free: can be added from the Skill Machine now. premium: listed there but locked (a future pay-based unlock).
// track: key into TRACKS (audio.js). Only tracks that exist can play; premium albums get theirs when they are unlocked.

export const ALBUM_CATALOG = [
  { id: 'happy', title: 'Happy Time Parade', genre: "Kids' energetic songs", icon: '🎈', color: 0xf2a81d, accent: 0xe8452c, free: true, track: 'happy',
    desc: 'Bouncy, bright and fast: the stereo plays an energetic singalong.' },
  { id: 'classical', title: 'Hits from the Old Days', genre: 'Classical (Beethoven era) hits', icon: '🎻', color: 0x5b4636, accent: 0xd8c8a0, premium: true, track: 'classical',
    desc: 'Grand piano and strings from the age of Beethoven.' },
  { id: 'country', title: 'Sad Country', genre: 'Country Western', icon: '🤠', color: 0x6d4c2f, accent: 0xe0b060, premium: true, track: 'country',
    desc: 'Slow guitars and lonesome stories.' },
  { id: 'blues', title: 'Blues Collection', genre: 'Blues guitar songs', icon: '🎷', color: 0x1f3f7a, accent: 0x7fb4ff, premium: true, track: 'blues',
    desc: 'Twelve-bar blues with a lot of feeling.' },
  { id: 'lullaby', title: 'Out like a Lamb', genre: 'Lullabies', icon: '🌙', color: 0x7a6aa8, accent: 0xf0e8ff, premium: true, track: 'lullaby',
    desc: 'Soft songs for sleepy robots.' },
];
