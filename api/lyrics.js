const axios = require('axios');
const cheerio = require('cheerio');

exports.config = {
    name: 'lyrics',
    version: '1.0.0',
    author: 'Biru',
    description: 'Get song lyrics from Google or Musixmatch.',
    category: 'music',
    usage: ['/lyrics?song=romanized%20oddloop%20frederic'],
    cooldown: 5
};

exports.initialize = async function ({ req, res }) {
    try {
        
        const songTitle = req.query.song;
        if (!songTitle) {
            return res.status(400).json({ error: "Please provide a song name to get lyrics." });
        }

        const headers = { 
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' 
};
        let lyrics = null;
        let artist = null;

        
        try {
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(songTitle.replace(' ', '+'))}+lyrics`;
            const googleResponse = await axios.get(googleUrl, { headers });
            const $ = cheerio.load(googleResponse.data);
            const data = $('div[data-lyricid]');

            if (data.length > 0) {
                const content = data.html().replace('</span></div><div.*?>', '\n</span>');
                const parse = cheerio.load(content);
                lyrics = parse('span[jsname]').text();
                artist = $('div.auw0zb').text() || 'Unknown';
            }
        } catch (googleError) {
            console.log("Google lyrics fetch failed, trying Musixmatch...");
        }

        
        if (!lyrics) {
            try {
                const musixmatchUrl = `https://www.musixmatch.com/search/${encodeURIComponent(songTitle.replace(' ', '+'))}`;
                const musixmatchResponse = await axios.get(musixmatchUrl, { headers });
                const mxmMatch = musixmatchResponse.data.match(/<a class="title" href="(.*?)"/);

                if (mxmMatch) {
                    const mxmUrl = `https://www.musixmatch.com${mxmMatch[1]}`;
                    const mxmResponse = await axios.get(mxmUrl, { headers });
                    lyrics = cheerio.load(mxmResponse.data)('.lyrics__content__ok').text();
                    artist = cheerio.load(mxmResponse.data)('.mxm-track-title__artist-link').text() || 'Unknown';
                }
            } catch (musixmatchError) {
                console.log("Musixmatch lyrics fetch failed:", musixmatchError);
            }
        }

        
        if (lyrics) {
            return res.json({
                title: songTitle,
                artist: artist,
                lyrics: lyrics
            });
        } else {
            return res.status(404).json({ error: "No lyrics found for the given song title." });
        }

    } catch (error) {
        console.error('Error fetching lyrics:', error);
        res.status(500).json({ error: 'Failed to fetch lyrics.' });
    }
};
