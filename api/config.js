export default async function handler(req, res) {
    // בודק את הסיסמה (אותה נגדיר ב-Vercel)
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized: Wrong Password' });
    }

    // שולף מההגדרות של Vercel את פרטי הגיטהאב
    const USER = process.env.GITHUB_USER;
    const REPO = process.env.GITHUB_REPO;
    const PAT = process.env.GITHUB_PAT;
    
    const API_URL = `https://api.github.com/repos/${USER}/${REPO}/contents/config.json`;
    const headers = {
        'Authorization': `token ${PAT}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    // בקשת GET - משיכת ההגדרות מגיטהאב לממשק
    if (req.method === 'GET') {
        try {
            const response = await fetch(API_URL, { headers });
            if (!response.ok) throw new Error('Failed to fetch from GitHub');
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // בקשת POST - שמירת שינויים חזרה לגיטהאב
    if (req.method === 'POST') {
        try {
            const response = await fetch(API_URL, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Update config.json via Vercel Admin UI',
                    content: req.body.content,
                    sha: req.body.sha
                })
            });
            
            if (!response.ok) throw new Error('Failed to push to GitHub');
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    res.status(405).json({ error: 'Method not allowed' });
}
