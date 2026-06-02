const fs = require('fs');
const nodemailer = require('nodemailer');
const config = require('./config.json');

// ה-Headers שעוקפים את חסימת ShieldSquare
const API_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "mobile-app": "true",
    "x-mobile-app": "true",
    "user-agent": "RESPONSIVE_MOBILE_APP_ANDROID_NEW_RN_APP Mozilla/5.0 (Linux; Android 14; DumberOS Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.7049.100 Mobile Safari/537.36",
    "anonymous_userid": "7c3335b7-b8e7-4bac-b001-7810782c8d13",
    "Cookie": "guest_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjp7InV1aWQiOiI4Nzc5NGZhZS05Y2Q2LTRmZDUtYTc1Yy1mNTRiNDUxNDZkNTAifSwiaWF0IjoxNzgwNDA5NTE5LCJleHAiOjE4MTE5NjcxMTl9.s70RJMZ0hL6TyEBCQecFJ1dvj6P-vCln5FuhqDivvkg; favorites_userid=7c3335b7-b8e7-4bac-b001-7810782c8d13"
};

// --- פונקציית הקסם: ממירה לינק של דפדפן ללינק של האפליקציה! ---
const convertWebToApiUrl = (webUrl) => {
    try {
        const urlObj = new URL(webUrl);
        const params = new URLSearchParams(urlObj.search);
        
        params.set('pageNumber', '1');
        params.set('itemsPerPage', '40');
        // הוספנו את פרמטר הזמן שהאפליקציה שולחת כדי למנוע שגיאות חסר
        params.set('scrollSessionId', new Date().toISOString());
        
        let endpoint = 'recommerce-feed/search';
        
        if (urlObj.pathname.includes('/realestate/')) {
            endpoint = 'realestate-feed/search';
        } else if (urlObj.pathname.includes('/vehicles/')) {
            endpoint = 'vehicles-feed/search';
        }
        
        return `https://gw.yad2.co.il/${endpoint}?${params.toString()}`;
    } catch (e) {
        console.error("Invalid URL provided, falling back to original:", webUrl);
        return webUrl;
    }
};

const fetchYad2Api = async (url) => {
    try {
        const res = await fetch(url, { method: 'GET', headers: API_HEADERS });
        if (!res.ok) {
            // כאן הוספתי את הקסם: אנחנו שולפים את טקסט השגיאה שהשרת מחזיר
            const errorText = await res.text();
            throw new Error(`HTTP Error: ${res.status} | Server says: ${errorText}`);
        }
        const json = await res.json();
        return json.data.items || [];
    } catch (err) {
        console.error("Fetch error:", err);
        throw err;
    }
};

const checkIfHasNewItem = async (items, topic) => {
    const filePath = `./data/${topic}.json`;
    let savedIds = [];
    try {
        savedIds = require(filePath);
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            if (!fs.existsSync('data')) fs.mkdirSync('data');
            fs.writeFileSync(filePath, '[]');
        } else {
            throw new Error(`Could not read / create ${filePath}`);
        }
    }

    let shouldUpdateFile = false;
    const newItems = [];

    items.forEach(item => {
        const id = item.id || item.adId;
        if (id && !savedIds.includes(id)) {
            savedIds.push(id);
            newItems.push(item);
            shouldUpdateFile = true;
        }
    });

    if (shouldUpdateFile) {
        fs.writeFileSync(filePath, JSON.stringify(savedIds, null, 2));
        fs.writeFileSync("push_me", ""); 
    }
    return newItems;
};

const sendEmail = async (subject, text) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: subject,
        text: text
    });
};

const scrape = async (topic, webUrl) => {
    console.log(`\nScanning ${topic}...`);
    // המרה אוטומטית של הלינק
    const apiUrl = convertWebToApiUrl(webUrl);
    console.log(`Converted API Target: ${apiUrl}`);

    try {
        const items = await fetchYad2Api(apiUrl);
        const newItems = await checkIfHasNewItem(items, topic);

        if (newItems.length > 0) {
            const msgLines = newItems.map((item, index) => {
                const title = item.title || "ללא כותרת";
                const price = item.price ? `${item.price} ₪` : "לא צוין מחיר";
                const city = item.address && item.address.city ? item.address.city.textHeb : "עיר לא ידועה";
                const link = item.urlIdentifier ? `https://www.yad2.co.il/item/${item.urlIdentifier}` : "";
                return `${index + 1}. ${title} | 📍 ${city} | 💰 ${price}\n🔗 ${link}`;
            });

            const msg = `מצאנו ${newItems.length} פריטים חדשים בחיפוש שלך!\n\n${msgLines.join("\n\n----------\n\n")}\n\nלינק מקורי לחיפוש:\n${webUrl}`;
            await sendEmail(`[Yad2] מצאנו ${newItems.length} פריטים חדשים: ${topic}!`, msg);
            console.log(`✅ Sent email for ${topic}!`);
        } else {
            console.log("No new items were added.");
        }
    } catch (e) {
        console.error(e);
        await sendEmail(`[Yad2] שגיאה בסריקה: ${topic} 😥`, `Scan workflow failed...\n${e.message}`);
    }
};

const program = async () => {
    for (const project of config.projects) {
        if (project.disabled) {
            console.log(`Topic "${project.topic}" is disabled. Skipping.`);
            continue;
        }
        await scrape(project.topic, project.url);
        // השהייה קטנה בין חיפושים כדי לא לחסום את השרת
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

program();
