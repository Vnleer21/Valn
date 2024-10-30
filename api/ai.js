const axios = require('axios');
const randomUseragent = require('random-useragent');

const conversationHistories = {};

exports.config = {
    name: 'ai',
    author: "biru",
    description: 'Interact with GPT-4O-Mini Fast & Lite Version.',
    usage: [`/ai?prompt=who%20are%20you&uid=${Date.now()}`],
    category: 'ai',
};

exports.initialize = async function ({ req, res, font, color }) {
    const senderID = req.query.uid || 'default';
    const query = req.query.prompt;

    if (!query) {
        return res.status(400).json({ error: "No prompt provided" });
    }

    if (['clear', 'reset', 'forgot', 'forget'].includes(query.toLowerCase())) {
        conversationHistories[senderID] = [];
        return res.json({ message: "Conversation history cleared." });
    }

    conversationHistories[senderID] = conversationHistories[senderID] || [];
    conversationHistories[senderID].push({ role: "user", content: query });

    const url = 'https://chataibot.ru/api/promo-chat/messages';
    const headers = {
        'Content-Type': 'application/json',
        'Accept-Language': 'ru',
        'User-Agent': randomUseragent.getRandom(),
        'Referer': 'https://chataibot.ru/app/free-chat',
    };
    const data = {
        messages: [...conversationHistories[senderID], { role: "user", content: query }]
    };

    let retries = 3;
    let success = false;
    let answer = "";
    let errorMessage = "An unexpected error occurred. Please try again later.";

    while (retries > 0 && !success) {
        try {
            const response = await axios.post(url, data, { headers });
            // Replace HTML tags like <b> and </b> with markdown-style or plain text
            answer = response.data.answer.replace(/<\/?b>/g, '**');

            conversationHistories[senderID].push({ role: "assistant", content: answer });
            success = true;
            res.json({ message: answer, author: exports.config.author });
        } catch (error) {
            retries -= 1;

            if (retries === 0) {
                if (error.response) {
                    const status = error.response.status;
                    const data = error.response.data;

                    switch (status) {
                        case 400:
                            errorMessage = "Bad Request. Please check your input and try again.";
                            break;
                        case 401:
                            errorMessage = "Unauthorized. Authentication failed or was not provided.";
                            break;
                        case 403:
                            errorMessage = "Forbidden. Input exceeds token limit or access is restricted.";
                            break;
                        case 404:
                            errorMessage = "Not Found. The requested resource could not be found.";
                            break;
                        case 500:
                            errorMessage = "Internal Server Error. The server encountered an error.";
                            break;
                        default:
                            errorMessage = data.message || errorMessage;
                    }
                } else if (error.message) {
                    errorMessage = error.message;
                }

                res.status(error.response?.status || 500).json({ error: errorMessage });
            }
        }
    }
};
