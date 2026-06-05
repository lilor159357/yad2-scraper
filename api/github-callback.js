export default async function handler(request, response) {
    const { code } = request.query;
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (!code) {
        return response.status(400).json({ error: 'No code provided.' });
    }

    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ client_id, client_secret, code }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            throw new Error(tokenData.error_description || 'Failed to retrieve access token.');
        }

        response.status(200).json({ token: tokenData.access_token });
    } catch (error) {
        console.error('Error in GitHub callback:', error.message);
        response.status(500).json({ error: 'Authentication failed.' });
    }
}
