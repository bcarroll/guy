// What a robot says as it starts something, in "chatty" mode only (tts.js: by default they speak only in an interaction or to each other).
// One short line per activity, a couple of variants each. NO_BARK lists the activities that never say anything (chores, recoveries,
// the ones that already speak, and walking about). A new activity needs a line here or an entry in NO_BARK: T.sweepVoice checks.
export const BARKS = {
  piano: ['Time for some piano.', 'Let me play a little.'], sitpiano: ['Piano time.', 'I will sit and play.'], plink: ['Just a few notes.'],
  jam: ['Let me play along.'], jampiano: ['Playing along on the piano.'], jamsit: ['Joining in on the keys.'], jamguitar: ['Guitar, along with the music.'], jamdrums: ['Drums, in time with the music.'],
  dance: ['Let us dance!', 'This music wants dancing.'], dancemoves: ['Watch these moves.'], ballroom: ['A waltz, perhaps.'],
  lamp: ['Let me see about the lamp.'], mood: ['Setting the mood.'], plant: ['The plant needs some care.'], dust: ['A bit of dusting.'], dusttop: ['The top of that window needs dusting.'],
  read: ['I will read for a while.', 'Time for a book.'], ball: ['Who wants to play ball?'], dribble: ['Dribbling.'], toss: ['Catch!'],
  guitar: ['Guitar time.'], riff: ['I have a riff in mind.'], sitguitar: ['I will sit with the guitar.'],
  stretch: ['Time to stretch.'], wave: ['Hello!'], sit: ['I will sit for a bit.'], slouch: ['Just resting.'],
  bang: ['Banging the drums.'], drums: ['Drums!'], drumsolo: ['Solo time.'],
  scribble: ['A quick sketch.'], paint: ['Let me paint.'], mixpaint: ['Mixing some colours.'], portrait: ['A portrait, I think.'],
  peek: ['A quick look through the telescope.'], stargaze: ['Stargazing.'], darkstargaze: ['Lights off, for the stars.'], scopecare: ['The telescope needs looking after.'],
  rearrange: ['This could be arranged better.'], stereoon: ['Some music.'], stereooff: ['That is enough music.'],
  tidytools: ['Tidying the tools.'], build: ['I am building something.'],
  yardsit: ['Some fresh air.', 'Time to sit in the sun.'], birdbath: ['Let me see the bird bath.'], skyswitch: ['Let me change the sky.'], mow: ['The lawn needs mowing.'],
  yardpoke: ['A kick about, perhaps.'], goalshot: ['Shots at the goal.'], soccertoss: ['A little ball handling.'], hoopshoot: ['Let me shoot some hoops.'], hoopdribble: ['Dribbling.'],
  visit: ['Let me have a look in there.'], learn: ['Off to the workstation.'],
};
export const NO_BARK = ['wander', 'books', 'putback', 'putguitar', 'dropball', 'lighton', 'putcanvas', 'hangpaint', 'leave', 'stuck', 'rwait',
  'takeorder', 'cook', 'serve', 'takepay',                     // the restaurant jobs already talk to the customers
  'buildbot', 'bandjam', 'bandplay', 'orderbuild',             // GUY and GAL's own talk (gal.js)
  'stock', 'galread', 'findguy', 'invitedance'];
const last = {};
export function barkFor(name) { const l = BARKS[name]; return l ? l[Math.floor(Math.random() * l.length)] : null; }
// gate: a robot says at most one remark every `gap` ms
export function barkReady(who, now, gap = 25000) { return !(last[who] && now - last[who] < gap); }
export const barkSpoke = (who, now) => { last[who] = now; };          // (only a remark that was really said starts the wait)
export const resetBarks = () => { for (const k of Object.keys(last)) delete last[k]; };
