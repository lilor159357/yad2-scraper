export default async function handler(req, res) {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        // פנייה ל-API שתפסת ביד2
        const url = `https://gw.yad2.co.il/free-search-autocomplete/suggestions?query=${encodeURIComponent(q)}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch from Yad2');
        
        const data = await response.json();
        
        // מחזיר את המידע הנקי לדפדפן שלנו
        return res.status(200).json(data);
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
