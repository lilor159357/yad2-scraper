export default async function handler(req, res) {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        const url = `https://gw.yad2.co.il/free-search-autocomplete/suggestions?query=${encodeURIComponent(q)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // אלו ה-Headers החכמים של האפליקציה שעוקפים את מנגנון האבטחה!
                "accept": "application/json, text/plain, */*",
                "mobile-app": "true",
                "x-mobile-app": "true",
                "user-agent": "RESPONSIVE_MOBILE_APP_ANDROID_NEW_RN_APP Mozilla/5.0 (Linux; Android 14; DumberOS Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.7049.100 Mobile Safari/537.36"
            }
        });

        // אם יד2 חוסמים אותנו, אנחנו רוצים לדעת בדיוק איזה קוד הם החזירו
        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ 
                error: `Yad2 blocked the request with status ${response.status}`,
                details: text.substring(0, 200) // מחזיר קצת מהתשובה כדי שנבין מה קרה
            });
        }
        
        const data = await response.json();
        return res.status(200).json(data);
        
    } catch (error) {
        // שגיאת שרת אמיתית (למשל fetch לא נתמך)
        return res.status(500).json({ error: error.toString() });
    }
}
