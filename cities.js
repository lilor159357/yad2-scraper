// רשימת גיבוי קטנה למקרה שאין אינטרנט או שהשרת הממשלתי נפל
window.CITIES_DICT = {
    "תל אביב יפו": 5000, "ירושלים": 3000, "חיפה": 4000, "ראשון לציון": 8300,
    "פתח תקווה": 7900, "אשדוד": 70, "נתניה": 7400, "באר שבע": 9000,
    "בני ברק": 6100, "חולון": 6600, "רמת גן": 8600, "רחובות": 8400,
    "אשקלון": 7100, "בת ים": 6200, "בית שמש": 2610, "כפר סבא": 6900
};

// פנייה ל-API הרשמי של ממשלת ישראל למשיכת כל 1,300+ היישובים!
fetch('https://data.gov.il/api/3/action/datastore_search?resource_id=d4901968-dad3-4845-a9b0-a57d027f11ab&limit=1500')
    .then(res => res.json())
    .then(data => {
        if (data && data.result && data.result.records) {
            data.result.records.forEach(record => {
                // מנקה רווחים ומוסיף את העיר והמספר למילון שלנו
                const cityName = record['שם_ישוב'].trim();
                const cityCode = record['סמל_ישוב'];
                
                if (cityName && cityCode) {
                    window.CITIES_DICT[cityName] = cityCode;
                }
            });
            // משדר אירוע לממשק כדי שידע שהרשימה המלאה הגיעה וירענן את הרשימה הנפתחת
            window.dispatchEvent(new Event('citiesLoaded'));
            console.log(`✅ נטענו בהצלחה ${Object.keys(window.CITIES_DICT).length} יישובים ממשרד הפנים!`);
        }
    })
    .catch(err => console.error('שגיאה במשיכת רשימת הערים ממשרד הפנים:', err));
