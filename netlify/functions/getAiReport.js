// --- Imports ---
// We'll use the 'node-fetch' library to make our API call.
// This tells Netlify to install 'node-fetch' for this function.
import fetch from 'node-fetch';

// --- Helper: Formats the AI text into clean HTML ---
// This is the same logic from our main HTML file, moved to the backend.
function formatAiTextToHtml(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<h3>$1</h3>');
    html = html.replace(/^\s*[\*]\s(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^\s*\d\.\s(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(?:<li>(?:.|\n)*?<\/li>\s*)+/g, (match) => {
        return `<ul>${match}</ul>`;
    });
    html = html
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, ' ')
        .replace(/<br><br>/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<h3>)/g, '$1');
    html = html.replace(/(<\/h3>)<\/p>/g, '$1');
    html = html.replace(/<\/h3><p>/g, '</h3>');
    html = html.replace(/<\/ul><p>/g, '</ul>');
    return html;
}

// --- Main Function Handler ---
export async function handler(event, context) {
    // 1. Get the secret API key from Netlify's secure environment
    const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

    if (!GOOGLE_AI_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key is not configured on the server." }),
        };
    }

    // 2. Get the "failed skills" sent from the HTML file
    let skills = [];
    try {
        const body = JSON.parse(event.body);
        skills = body.skills || [];
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    if (skills.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "No skills provided." }) };
    }

    // 3. Set up the prompt for the Google AI
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GOOGLE_AI_API_KEY}`;
    
    const systemPrompt = "You are a friendly and encouraging 4th-grade teaching assistant. A student just failed a test and needs help with the following skills. For each skill, please generate a simple, easy-to-understand mini-lesson. This lesson should include: 1. A simple definition of the skill. 2. A few tips or strategies to help them get the right answer next time. 3. A quick, simple example. Do not use external links or URLs.";
    const userQuery = `Here are the skills I struggled with: ${skills.join(', ')}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    // 4. Call the Google AI API
    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API Error Body:", errorBody);
            throw new Error(`API Error: ${response.status} ${errorBody.error?.message || ''}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (!candidate || !candidate.content?.parts?.[0]?.text) {
            throw new Error("Invalid response from AI. No content found.");
        }

        // 5. Get the text and format it as HTML
        const rawText = candidate.content.parts[0].text;
        const html = formatAiTextToHtml(rawText);

        // 6. Send the formatted HTML back to the browser
        return {
            statusCode: 200,
            body: JSON.stringify({ html: html }), // Send back in the format our old function expects
        };

    } catch (error) {
        // ** THIS IS THE UPDATED PART **
        // Instead of just logging error.message, we log the whole error
        // for better debugging in Netlify's function logs.
        console.error("Error in Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
}
