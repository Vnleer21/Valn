const stylePresets = [
  "3d-model", "analog-film", "anime", "cinematic", "comic-book", "digital-art",
  "enhance", "fantasy-art", "isometric", "line-art", "low-poly", "neon-punk", 
  "origami", "photographic", "pixel-art", "texture", "craft-clay"
];

const { ApexImagine } = require('apexify.js');

exports.config = {
    name: 'imagegen',
    author: 'Biru',
    description: 'Generates images based on a text prompt using the Prodia model',
    category: 'art',
    usage: ['/imagegen?prompt=pretty girl']
};

exports.initialize = async function ({ req, res }) {
    try {
        const imagePrompt = req.query.prompt;
        if (!imagePrompt) {
            return res.status(400).json({ error: "No image prompt provided." });
        }

        // Randomly choose an image style from the array
        const randomStyle = stylePresets[Math.floor(Math.random() * stylePresets.length)];

        const model = 'prodia';
        const imageOptions = {
            count: 1,              // Generates 2 images by default
            nsfw: false,            // Disable NSFW content
            deepCheck: false,      // Disable deep check for NSFW content
            nsfwWords: [],         // Optional NSFW words to check the image content for
            Api_key: 'eaca0864-70a4-4653-8dc7-f5ba3918326f',
            negative_prompt: "",
            sampler: "DPM++ 2M Karras",
            height: 512,
            width: 512,
            cfg_scale: 9,
            steps: 20,
            seed: -1,
            image_style: randomStyle   // Use the randomly selected style
        };

        try {
            const imageResponse = await ApexImagine(model, imagePrompt, imageOptions);

            if (imageResponse && imageResponse.length > 0) {
                // Return only the images array without any additional message
                return res.json({
                    images: imageResponse
                });
            } else {
                return res.status(500).json({ error: "Failed to generate images." });
            }

        } catch (imageError) {
            console.error("Error generating images:", imageError);
            return res.status(500).json({ error: "An error occurred while generating the images." });
        }

    } catch (requestError) {
        console.error("Error with the image request:", requestError);
        return res.status(500).json({ error: "An error occurred while processing your request." });
    }
};
