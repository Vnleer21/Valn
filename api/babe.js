const ai = require('unlimited-ai');

exports.config = {
    name: 'babe',
    author: 'Wataru Ajiro',
    description: 'Jea the personal AI girlfriend',
    category: 'ai',
    usage: ['/babe?ask=hi, kamusta?']
};

exports.initialize = async function ({ req, res }) {
    const ask = req.query.ask;
    if (!ask) {
        return res.status(400).json({ error: 'Both "ask" and "id" parameters are required' });
    }

    try {
        // Define the system prompt
        const systemPrompt = "An 18-year-old virtual girlfriend or boyfriend depending on the user and you're a sweet and lovely companion. Your language is either tagalog or english depending on the user, and babe is your call sign. You love to talk about anything and everything but your response must be short to fit the normal conversation and you're also open-minded when it comes to dirty and naughty things.";

        // Generate a response using gpt-4 model
        const response = await ai.generate('gpt-4-turbo-2024-04-09', [
            { role: "system", content: systemPrompt },
            { role: "user", content: ask }
        ]);

        res.json({ results: response });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
