const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

exports.config = {
    name: 'downloader',
    author: 'Biru',
    description: 'Download from media URLs for platforms like Instagram, Facebook, TikTok, Twitter, and YouTube',
    category: 'tools',
    usage: ['/downloader?url=https://music.youtube.com/watch?v=smObR_8q5UQ'] // Update this link as needed
};

exports.initialize = async function ({ req, res }) {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({ error: "Please provide a media URL using ?url=your_url_here" });
    }

    try {
        // Detect platform and route accordingly
        let downloadInfo;

        if (url.includes("facebook.com") || url.includes("fb.watch")) {
            downloadInfo = await downloadFacebookVideo(url);
        } else if (url.includes("instagram.com")) {
            downloadInfo = await downloadInstagramVideo(url);
        } else if (url.includes("tiktok.com")) {
            downloadInfo = await downloadTikTokVideo(url);
        } else if (url.includes("twitter.com") || url.includes("x.com")) {
            downloadInfo = await downloadTwitterVideo(url);
        } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
            downloadInfo = await downloadYouTubeVideo(url);
        } else {
            return res.status(400).json({ error: "Unsupported URL platform." });
        }

        res.json(downloadInfo);
    } catch (error) {
        console.error("Error fetching video:", error);
        res.status(500).json({ error: "Failed to fetch video" });
    }
};

// Define platform-specific functions for downloading videos
async function downloadFacebookVideo(inputUrl) {
    const baseUrl = 'https://snapsave.app/action.php';
    const formData = new FormData();
    formData.append("url", inputUrl);

    const response = await axios.post(baseUrl, formData, {
        headers: {
            ...formData.getHeaders(),
            "Cookie": "_ga=GA1.1.253146091.1720025059; __gads=ID=ea78c10b57674a22:T=1720025060:RT=1720028639:S=ALNI_MYTI6y_R_9g5lFYwNJKzC3FZhONsQ; __gpi=UID=00000e71bfbb1126:T=1720025060:RT=1720028639:S=ALNI_MY5B9BAg8DFTtGMSiYi7MZ9_moj6g; __eoi=ID=29d84a00bfd16bbc:T=1720025060:RT=1720028639:S=AA-Afjaq6T3JBLGedYOS1BSKtXxu; FCNEC=%5B%5B%22AKsRol9sGHON-Qjnu8g9pXDQnjOc72SXe_4cCDOldAsnL2515xdRGPNPkse479cqgd1l7W4Y91d68TOrWAh5eQNw_6ntBaoBWLwBIkiVTceU0k-kGPMNk7llE2MGcfBZwDtJyCACzX4vNRv4IBlBeFgwvKJa8D2ckw%3D%3D%22%5D%5D",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
        }
    });
    
    const htmlContent = decodeResponse(response.data);
    const downloadLinks = extractDownloadLinks(htmlContent);
    return { platform: "Facebook", downloadLinks };
}

async function downloadInstagramVideo(inputUrl) {
    return await downloadWithGenericService(inputUrl, 'vidburner.com', '/wp-json/aio-dl/video-data/', 'instagram');
}

async function downloadTikTokVideo(inputUrl) {
    const formData = new FormData();
    formData.append("url", inputUrl);
    formData.append("lang", "en");
    formData.append("token", "eyMTcyMDA5MTMwNA==c");

    const response = await axios.post("https://snaptik.app/abc2.php", formData, {
        headers: formData.getHeaders()
    });

    const htmlContent = decodeResponse(response.data);
    return extractVideoDataFromHTML(htmlContent, "TikTok");
}

async function downloadTwitterVideo(inputUrl) {
    return await downloadWithGenericService(inputUrl, 'vidburner.com', '/wp-json/aio-dl/video-data/', 'twitter');
}

async function downloadYouTubeVideo(inputUrl) {
    const options = {
        method: "POST",
        url: "https://ytbsave.com/mates/en/analyze/ajax",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
        data: `url=${encodeURIComponent(inputUrl)}&ajax=1&lang=en`
    };

    const response = await axios(options);
    const $ = cheerio.load(response.data.result);
    return {
        platform: "YouTube",
        title: $("b #video_title").text().trim(),
        downloadLink: $("a[data-ftype='mp4'][data-fquality='128']").attr("href")
    };
}

// Helper functions
function decodeResponse(obfuscatedCode) {
    // Decodes obfuscated JavaScript code for response processing
    return eval(obfuscatedCode);
}

function extractDownloadLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const downloadLinks = {};
    $("tbody tr").each((_, element) => {
        if ($(element).find("td").first().text().trim() === "360p (SD)") {
            downloadLinks.SD = $(element).find('a[href^="https://d.rapidcdn.app/"]').attr("href");
        }
    });
    return downloadLinks;
}

function extractVideoDataFromHTML(html, platform) {
    const $ = cheerio.load(html);
    return {
        platform,
        title: $("div.video-title").text().trim(),
        downloadLink: $("a[href]").attr("href"),
        author: $("span").text().trim()
    };
}

async function downloadWithGenericService(url, hostname, path, platform) {
    const response = await axios.post(`https://${hostname}${path}`, `url=${encodeURIComponent(url)}`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const videoData = response.data;
    return {
        platform,
        title: videoData.title,
        videoUrl: videoData.medias.find(media => media.quality === "hd" || media.quality === "sd")?.url
    };
}
