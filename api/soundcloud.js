const path = require('path');
const fs = require('fs');
const axios = require('axios');
const SoundCloud = require('soundcloud-scraper');
const apiKeyPath = path.join(__dirname, 'system', 'apikey.txt');

exports.config = {
    name: "soundcloud",
    description: "Search and Download Music From Sound Cloud.",
    category: "music",
    author: "Kenneth Panio",
    usage: ['/soundcloud?query=oddloop'],
};

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.6 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15"
];

exports.initialize = async function ({ req, res, color }) {
    const musicName = req.query.query || '';

    if (!musicName) {
        return res.status(400).json({ message: "Please provide the title of the music!" });
    }

    try {
        let apiKey = fs.existsSync(apiKeyPath) ? fs.readFileSync(apiKeyPath, 'utf8').trim() : await SoundCloud.keygen();
        if (!fs.existsSync(apiKeyPath)) {
            fs.mkdirSync(path.dirname(apiKeyPath), { recursive: true });
            fs.writeFileSync(apiKeyPath, apiKey);
        }

        const client = new SoundCloud.Client(apiKey);
        const searchResults = await client.search(musicName, 'track');

        if (!searchResults.length) {
            return res.status(404).json({ message: "Can't find the music you're looking for." });
        }

        const song = searchResults[0];
        const songInfo = await client.getSongInfo(song.url);
        const stream = await songInfo.downloadProgressive();

        const audioData = [];
        stream.on('data', chunk => audioData.push(chunk));

        stream.on('end', async () => {
            const audioBuffer = Buffer.concat(audioData);
            const audioBase64 = audioBuffer.toString('base64');

            let lyrics = "Lyrics not found";
            try {
                const lyricsResponse = await axios.get(atob(`aHR0cHM6Ly9seXJpc3QudmVyY2VsLmFwcC9hcGkv`) + encodeURIComponent(musicName), {
                    headers: { 'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)] }
                });
                lyrics = lyricsResponse.data.lyrics || "Lyrics not available";
            } catch (error) {
                console.log(color.red("Error fetching lyrics:" + error.message));
            }

            res.json({
                id: songInfo.id,
                title: songInfo.title,
                description: songInfo.description,
                duration: songInfo.duration,
                playCount: songInfo.playCount,
                commentsCount: songInfo.commentsCount,
                likes: songInfo.likes,
                genre: songInfo.genre,
                audio_url: song.url,
                thumbnail: songInfo.thumbnail,
                publishedAt: songInfo.publishedAt,
                embedURL: songInfo.embedURL,
                streams: songInfo.streams,
                trackURL: songInfo.trackURL,
                author: {
                    name: songInfo.author.name,
                    username: songInfo.author.username,
                    url: songInfo.author.url,
                    avatarURL: songInfo.author.avatarURL,
                    verified: songInfo.author.verified,
                    followers: songInfo.author.followers,
                    following: songInfo.author.following
                    
                },
                lyrics: lyrics,
                audio_b64: audioBase64
                
            });
        });

        stream.on('error', (error) => {
            console.error(color.red("Error downloading audio: " + error.message ));
            res.status(500).json({ message: "Error downloading audio." });
        });

    } catch (error) {
        if (error.message.includes('Invalid ClientID')) {
            const newKey = await SoundCloud.keygen();
            fs.writeFileSync(apiKeyPath, newKey);
            res.status(500).json({ message: 'New API key generated. Please retry the search!' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
};
