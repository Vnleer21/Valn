const axios = require('axios');
const cheerio = require("cheerio");
const YTMusic = require('ytmusic-api');
const https = require('https');

const clientID = "23538f02c7b14389b3219063e493c851";
const clientSecret = "5a59a1768fc8440d84f175a9bdea42dc";
let accessToken = "";
let ytmusic = new YTMusic();

// Spotify token generation and retrieval
const Spotify = {
  async getAccessToken() {
    if (accessToken) return accessToken;

    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', null, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${clientID}:${clientSecret}`).toString('base64')
        },
        params: { grant_type: 'client_credentials' }
      });

      accessToken = response.data.access_token;
      return accessToken;
    } catch (error) {
      console.error("Error obtaining Spotify access token:", error.message || error);
      throw new Error("Failed to obtain access token.");
    }
  },

  async search(term) {
    const token = await this.getAccessToken();
    try {
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
    } catch (error) {
      console.error("Spotify search error:", error.response?.data || error.message);
      throw new Error("Error retrieving track from Spotify.");
    }
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

  return filteredContent.length ? `https://music.youtube.com/watch?v=${filteredContent[0].videoId}` : null;
}

// Download the YouTube video URL and return audio as base64
async function GetOutputYt(url) {
  const options = {
    hostname: 'ytbsave.com',
    path: '/mates/en/analyze/ajax?retry=undefined&platform=youtube',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
  };

  const data = `url=${encodeURIComponent(url)}&ajax=1&lang=en`;
  options.headers['Content-Length'] = Buffer.byteLength(data);

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', async () => {
        try {
          const jsonData = JSON.parse(responseData);
          const $ = cheerio.load(jsonData.result);
          const downloadLink = $('a[data-ftype="mp4"][data-fquality="128"]').attr('href');
          const title = $('b #video_title').text().trim();

          const response = await axios.get(downloadLink, { responseType: 'arraybuffer' });
          const audioBase64 = Buffer.from(response.data, 'binary').toString('base64');

          resolve({ title, audioBase64 });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Main endpoint
exports.config = {
  name: 'music',
  author: 'Biru',
  description: 'Searches and retrieves a Spotify song and optionally converts it to a YouTube Music link with download options.',
  category: 'music',
  usage: ['/music?song=Hello']
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
    const ytMusicLink = await getYouTubeMusicLink(track.id);

    let downloadInfo = null;
    if (ytMusicLink) {
      downloadInfo = await GetOutputYt(ytMusicLink);
    }

    return res.json({
      message: `Track found: "${track.name}" by ${track.artist}.`,
      track: track.name,
      artist: track.artist,
      spotify_url: track.url,
      youtube_music_url: ytMusicLink || "No YouTube Music equivalent found.",
      download_title: downloadInfo ? downloadInfo.title : "No download title found",
      audio_base64: downloadInfo ? downloadInfo.audioBase64 : "No audio data available"
    });
  } catch (error) {
    console.error("Error retrieving track:", error.message || error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
};
