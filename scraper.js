const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const fs = require('fs');
const config = require('./config.json');

const getYad2Response = async (url) => {
    const requestOptions = {
        method: 'GET',
        redirect: 'follow',
        // כדאי להוסיף 'User-Agent' כדי להיראות קצת יותר כמו דפדפן רגיל ולא כמו בוט
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };
    try {
        const res = await fetch(url, requestOptions)
        console.log(`HTTP Status received: ${res.status}`); // מדפיס את קוד התשובה
        return await res.text()
    } catch (err) {
        console.log("Fetch error:", err)
    }
}

const scrapeItemsAndExtractImgUrls = async (url) => {
    const yad2Html = await getYad2Response(url);
    if (!yad2Html) {
        throw new Error("Could not get Yad2 response");
    }
    
    const $ = cheerio.load(yad2Html);
    const title = $("title")
    const titleText = title.first().text();
    
    // הדפסה של הכותרת של הדף - זה יעזור לנו לדעת אם חסמו אותנו
    console.log(`Page title is: "${titleText}"`); 
    
    if (titleText === "ShieldSquare Captcha" || titleText.includes("Just a moment") || titleText.includes("Access Denied")) {
        throw new Error("Bot detection - Access blocked by Yad2");
    }

    const $feedItems = $(".feeditem").find(".pic");
    
    // הדפסה שתראה כמה פריטים עם המחלקה הזו באמת נמצאו
    console.log(`Found ${$feedItems.length} elements with '.feeditem .pic'`); 
    
    if ($feedItems.length === 0) {
        // הדפסת דוגמה של ה-HTML במקרה שלא מצאנו כלום, כדי שנוכל לחקור מה השתנה
        console.log("No items found. Here is a snippet of the HTML:");
        console.log(yad2Html.substring(0, 500)); 
    }

    const imageUrls = []
    $feedItems.each((_, elm) => {
        const imgSrc = $(elm).find("img").attr('src');
        if (imgSrc) {
            imageUrls.push(imgSrc)
        }
    })
    
    console.log(`Extracted ${imageUrls.length} image URLs.`);
    return imageUrls;
}

const checkIfHasNewItem = async (imgUrls, topic) => {
    const filePath = `./data/${topic}.json`;
    let savedUrls = [];
    try {
        savedUrls = require(filePath);
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            fs.mkdirSync('data');
            fs.writeFileSync(filePath, '[]');
        } else {
            console.log(e);
            throw new Error(`Could not read / create ${filePath}`);
        }
    }
    let shouldUpdateFile = false;
    savedUrls = savedUrls.filter(savedUrl => {
        shouldUpdateFile = true;
        return imgUrls.includes(savedUrl);
    });
    const newItems = [];
    imgUrls.forEach(url => {
        if (!savedUrls.includes(url)) {
            savedUrls.push(url);
            newItems.push(url);
            shouldUpdateFile = true;
        }
    });
    if (shouldUpdateFile) {
        const updatedUrls = JSON.stringify(savedUrls, null, 2);
        fs.writeFileSync(filePath, updatedUrls);
        await createPushFlagForWorkflow();
    }
    return newItems;
}

const createPushFlagForWorkflow = () => {
    fs.writeFileSync("push_me", "")
}

// פונקציה חדשה לשליחת מייל
const sendEmail = async (subject, text) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: subject,
        text: text
    };

    await transporter.sendMail(mailOptions);
};

const scrape = async (topic, url) => {
    try {
        // בחרתי להוריד את המייל של ה"התחלת סריקה" כדי שלא יוצף לך המייל כל 15 דקות. 
        // אם אתה רוצה לקבל אינדיקציה שהבוט רץ, אפשר להוריד את ההערה מהשורה הבאה:
        // await sendEmail(`[Yad2] סריקה התחילה: ${topic}`, `Starting scanning ${topic} on link:\n${url}`);
        
        console.log(`Scanning ${topic}...`);
        const scrapeImgResults = await scrapeItemsAndExtractImgUrls(url);
        const newItems = await checkIfHasNewItem(scrapeImgResults, topic);
        
        if (newItems.length > 0) {
            const newItemsJoined = newItems.join("\n----------\n");
            const msg = `מצאנו ${newItems.length} פריטים חדשים בחיפוש שלך!\n\n${newItemsJoined}\n\nלינק לחיפוש:\n${url}`
            await sendEmail(`[Yad2] מצאנו ${newItems.length} פריטים חדשים: ${topic}!`, msg);
            console.log(`Sent email for ${topic}!`);
        } else {
            console.log("No new items were added");
        }
    } catch (e) {
        let errMsg = e?.message || "";
        if (errMsg) {
            errMsg = `Error: ${errMsg}`
        }
        await sendEmail(`[Yad2] שגיאה בסריקה: ${topic} 😥`, `Scan workflow failed...\n${errMsg}`);
        throw new Error(e)
    }
}

const program = async () => {
    await Promise.all(config.projects.filter(project => {
        if (project.disabled) {
            console.log(`Topic "${project.topic}" is disabled. Skipping.`);
        }
        return !project.disabled;
    }).map(async project => {
        await scrape(project.topic, project.url)
    }))
};

program();
