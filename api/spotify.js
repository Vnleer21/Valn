const axios = require('axios');
const YTMusic = require('ytmusic-api');
const ytdl = require('@distube/ytdl-core');

const clientID = "23538f02c7b14389b3219063e493c851";
const clientSecret = "5a59a1768fc8440d84f175a9bdea42dc";
let accessToken = "";
let ytmusic = new YTMusic();

// Spotify functions
const Spotify = {
  async getAccessToken() {
    if (accessToken) return accessToken;

    const response = await axios.post('https://accounts.spotify.com/api/token', null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientID}:${clientSecret}`).toString('base64')
      },
      params: { grant_type: 'client_credentials' }
    });

    accessToken = response.data.access_token;
    return accessToken;
  },

  async search(term) {
    const token = await this.getAccessToken();
    const response = await axios.get(`https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(term)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tracks = response.data.tracks.items;
    return tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists[0].name,
      album: t.album.name,
      url: `https://open.spotify.com/track/${t.id}`
    }));
  }
};

// Initialize YTMusic
async function initializeYTMusic() {
  await ytmusic.initialize();
}

// Get YouTube Music URL for Spotify track
async function getYouTubeMusicLink(spotifyID) {
  if (!spotifyID) throw new Error('You need to provide a Spotify Track!');
  const ID = spotifyID.replace('spotify:track:', '').replace('https://open.spotify.com/track/', '').split('?')[0];
  const token = await Spotify.getAccessToken();
  const response = await axios.get(`https://api.spotify.com/v1/tracks/${ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const track = response.data;
  const content = await ytmusic.searchSongs(`${track.name} ${track.artists.map(artist => artist.name).join(' ')}`);
  const filteredContent = content.filter(song => song?.artist?.name === track.artists[0].name);

  return filteredContent.length ? filteredContent[0].videoId : null; // Return only the videoId
}

// Download YouTube audio and convert to Base64
async function getYouTubeAudioBase64(videoId) {
  const audioUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const audioStream = ytdl(audioUrl, { quality: 'highestaudio' });

  const chunks = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return buffer.toString('base64'); // Convert to Base64
}

// Main endpoint
exports.config = {
  name: 'spotify',
  author: 'Biru',
  description: 'Searches and retrieves a Spotify song and optionally converts it to a YouTube Music link with download options.',
  category: 'music',
  usage: ['/spotify?song=Hello']
};

exports.initialize = async function ({ req, res }) {
  try {
    if (!ytmusic.initialized) await initializeYTMusic();

    const searchQuery = req.query.song;
    if (!searchQuery) {
      return res.status(400).json({ error: "No search keyword provided." });
    }

    const searchResults = await Spotify.search(searchQuery);
    if (!searchResults.length) {
      return res.status(404).json({ error: "No results found for the given keyword." });
    }

    const track = searchResults[0];
    const videoId = await getYouTubeMusicLink(track.id);

    if (videoId) {
      const audioBase64 = await getYouTubeAudioBase64(videoId);
      return res.json({
        message: `Track found: "${track.name}" by ${track.artist}.`,
        track: track.name,
        artist: track.artist,
        spotify_url: track.url,
        music_url: `https://music.youtube.com/watch?v=${videoId}`,
        author: 'Biru',
        audio_base64: audioBase64
      });
    } else {
      return res.status(404).json({ error: "No YouTube Music equivalent found." });
    }
  } catch (error) {
    console.error("Error retrieving track:", error.message || error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
};
