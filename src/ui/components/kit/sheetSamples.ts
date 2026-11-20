// Real lots dealt by the engine (buildDeck, seeds 11 and 22), kept as the sheet's review samples on #/kit.
import type { LotPub } from "../../../engine/types";

export const SAMPLE_LOTS: Record<string, LotPub> = {
 "clean": {
  "id": "L1-kia-k8-2023-gdi-y2026",
  "no": 1,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": 5,
  "mode": "inspected",
  "seller": "showroom",
  "car": {
   "modelId": "kia-k8-2023-gdi-y2026",
   "makeAr": "كيا",
   "makeEn": "Kia",
   "modelAr": "K8",
   "modelEn": "K8",
   "trim": "",
   "year": 2026,
   "body": "sedan",
   "engine": "2.5L 4 سلندر",
   "hp": 198,
   "fuel": "petrol",
   "drive": "FWD",
   "trans": "8AT",
   "tier": "luxury",
   "doors": 4,
   "km": 1700,
   "spec": "خليجي",
   "specKind": "gcc",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "جده",
   "owners": 1,
   "service": "dealer",
   "najm": 0,
   "istimara": "valid",
   "mvpi": "expired",
   "insurance": "comp",
   "fines": 0,
   "panels": {
    "fb": "ok",
    "hood": "ok",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "ok",
    "lfd": "ok",
    "lrd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "ok",
    "rrd": "ok",
    "rrq": "ok"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "ok",
    "chassis": "ok",
    "airbags": "ok",
    "ac": "cold",
    "susp": "ok"
   },
   "tires": 2026,
   "extras": [
    "كاميرا",
    "مثبت سرعة",
    "حساسات",
    "رادار"
   ],
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": 99,
    "hood": 104,
    "roof": 124,
    "trunk": 111,
    "rb": 140,
    "lff": 108,
    "lfd": 119,
    "lrd": 132,
    "lrq": 121,
    "rff": 143,
    "rfd": 119,
    "rrd": 107,
    "rrq": 111
   },
   "scan": {
    "status": "clean",
    "codes": []
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: مالك واحد",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 1,000 كم عند الوكيل",
    "زيت القير: تغيّر 2026"
   ],
   "inspector": [
    "القطع المغيّرة كلها أصلية بفواتيرها"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "س س ص",
    "en": "S S X",
    "num": "2",
    "special": {
     "tier": "top",
     "label": "لوحة مميزة",
     "note": "حرف مكرر، رقم فردي",
     "value": 65000
    },
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-22/900x675-1_-GO__MTc5MjY4MTc5ODc3NTcyNzk3MzkwNw.jpg",
    "h:userfiles30/2026-10-22/900x675-1_-GO__MTc5MjY4MTc5ODcxNjc5NTUwNDM0Mg.jpg",
    "h:userfiles30/2026-10-22/900x1200-1_-GO__MTc5MjY4MTc5ODE4MjMzOTk2NjExOQ.jpg",
    "h:userfiles30/2026-10-22/900x675-1_-GO__MTc5MjY4MTc5ODgwMzkyNzQ0ODg2OQ.jpg",
    "h:userfiles30/2026-10-22/900x675-1_-GO__MTc5MjY4MTc5ODU1OTEzNDU0NDU0Nw.jpg",
    "h:userfiles30/2026-10-22/900x1200-1_-GO__MTc5MjY4MTc5ODY3ODk5NTg1NDM4NA.jpg",
    "h:userfiles30/2026-10-22/900x1200-1_-GO__MTc5MjY4MTc5OTAyNTc4MDYzMTczMw.jpg",
    "h:userfiles30/2026-10-22/900x1200-1_-GO__MTc5MjY4MTc5ODczOTM5OTc5MDY1Ng.jpg"
   ],
   "adTitle": "كيا كي8 GLS TOP 2026",
   "adUrl": "https://haraj.com.sa/11191105456",
   "said": [
    "km",
    "trans",
    "fuel",
    "doors"
   ],
   "story": {
    "owner": "عند واحد يجمع ساعات، يدلعها مثل ساعاته",
    "use": "نص ممشاها سفر ونصه مدينة",
    "why": "ملّ من صيانة الأوروبي، يقول يبي ياباني ويرتاح",
    "quirks": [
     "مقبض الباب الأمامي اليسار من داخل مرتخي",
     "خدش طويل خفيف على الباب الأمامي اليمين",
     "إضاءة الأبواب الداخلية وحدة منها مطفية"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "دنلوب 2026، دعسة 7.9 مم",
     "tone": "good"
    },
    {
     "k": "جهاز الطلاء",
     "v": "متوسط 118 ميكرون، أعلى قراءة 143",
     "tone": "good"
    },
    {
     "k": "الزيت والماي",
     "v": "زيت جديد، الماي صافي",
     "tone": "good"
    },
    {
     "k": "الفاضي",
     "v": "680 دورة، ثابت",
     "tone": "good"
    },
    {
     "k": "حرارة الفتحات",
     "v": "6°م",
     "tone": "good"
    },
    {
     "k": "التعليق",
     "v": "متماسك، بدون صوت",
     "tone": "good"
    },
    {
     "k": "أسفل السيارة",
     "v": "ناشف",
     "tone": "good"
    }
   ]
  },
  "title": "كيا K8",
  "adKey": "11191105456",
  "notes": [
   "فيها: كاميرا، مثبت سرعة، حساسات، رادار"
  ],
  "estimate": [
   190000,
   225000
  ],
  "opening": 135000
 },
 "yukon": {
  "id": "L1-gmc-yukon-2025-at4",
  "no": 1,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": 4.4,
  "mode": "inspected",
  "seller": "showroom",
  "car": {
   "modelId": "gmc-yukon-2025-at4",
   "makeAr": "GMC",
   "makeEn": "GMC",
   "modelAr": "يوكن",
   "modelEn": "Yukon",
   "nick": "جمس",
   "trim": "Denali",
   "year": 2025,
   "body": "suv",
   "engine": "6.2L V8",
   "hp": 420,
   "fuel": "petrol",
   "drive": "4WD",
   "trans": "10AT",
   "tier": "luxury",
   "doors": 4,
   "km": 16000,
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "الرياض",
   "owners": 1,
   "service": "workshop",
   "najm": 0,
   "istimara": "valid",
   "mvpi": "expired",
   "insurance": "comp",
   "fines": 0,
   "panels": {
    "fb": "paint",
    "hood": "ok",
    "roof": "ok",
    "trunk": "ok",
    "rb": "paint",
    "lff": "ok",
    "lfd": "ok",
    "lrd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "ok",
    "rrd": "ok",
    "rrq": "ok"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "ok",
    "chassis": "ok",
    "airbags": "ok",
    "ac": "cold",
    "susp": "ok"
   },
   "tires": 2026,
   "extras": [],
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": 293,
    "hood": 137,
    "roof": 140,
    "trunk": 148,
    "rb": 216,
    "lff": 126,
    "lfd": 135,
    "lrd": 148,
    "lrq": 142,
    "rff": 102,
    "rfd": 100,
    "rrd": 99,
    "rrq": 138
   },
   "scan": {
    "status": "clean",
    "codes": []
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: مالك واحد",
    "سجل الصيانة: ورش خارجية، فواتير متفرقة",
    "آخر غيار زيت: على 13,200 كم",
    "الكفرات: تغيرت 2026",
    "بطارية: تغيرت 2026",
    "فحمات أمامية: تغيرت 2025"
   ],
   "inspector": [
    "الكراسي الكهربا كلها تشتغل"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ب ك ع",
    "en": "B K E",
    "num": "3480",
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-08/900x675-1_-GO__MTc5MTQ0Mjk0MzQ0MjY5NzM3MDcyMg.jpg",
    "h:userfiles30/2026-10-08/900x1200-1_-GO__MTc5MTQ0Mjk0MzI3MzY4OTU0NTQwNw.jpg",
    "h:userfiles30/2026-10-08/900x675-1_-GO__MTc5MTQ0Mjk0MzQ1MDYzMTUyNTc4Mg.jpg",
    "h:userfiles30/2026-10-08/900x675-1_-GO__MTc5MTQ0Mjk0MzcwNTM4NDE2OTU0MQ.jpg",
    "h:userfiles30/2026-10-08/900x675-1_-GO__MTc5MTQ0Mjk0MzIzNTI4NTI4NzU4MA.jpg",
    "h:userfiles30/2026-10-08/900x1200-1_-GO__MTc5MTQ0Mjk0MzU3MTA2OTg0Njk2.jpg",
    "h:userfiles30/2026-10-08/900x1200-1_-GO__MTc5MTQ0Mjk0MzgxODQ1NDM2MTQ0MA.jpg",
    "h:userfiles30/2026-10-08/900x675-1_-GO__MTc5MTQ0Mjk0MzY0MjgxMDY3MTcxNw.jpg"
   ],
   "adTitle": "جي ام سي دينالي موديل 2025 عداد 16 الف كم",
   "adUrl": "https://haraj.com.sa/11190120308",
   "said": [
    "km",
    "engine",
    "hp",
    "trans",
    "fuel",
    "doors"
   ],
   "story": {
    "owner": "كانت مع مستثمر يسافر أكثر مما يقعد، يلمّعها قبل أي مناسبة",
    "use": "أكثر من نص ممشاها بين البيت والمستشفى",
    "why": "صار يمشي على رجوله أكثر، وسيارة وحدة تكفيه",
    "quirks": [
     "لمعة الصدام الخلفي غير عن اللي جنبه",
     "حزام الراكب عليه غطا قطن",
     "درج الراكب ما يتسكّر إلا بدفة"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "كومهو 2026، دعسة 8.2 مم",
     "tone": "good"
    },
    {
     "k": "جهاز الطلاء",
     "v": "متوسط 148 ميكرون، أعلى قراءة 293",
     "tone": "bad"
    },
    {
     "k": "الفاضي",
     "v": "760 دورة، ثابت",
     "tone": "good"
    },
    {
     "k": "حرارة الفتحات",
     "v": "8°م",
     "tone": "good"
    },
    {
     "k": "التعليق",
     "v": "متماسك، بدون صوت",
     "tone": "good"
    },
    {
     "k": "أسفل السيارة",
     "v": "ناشف",
     "tone": "good"
    }
   ]
  },
  "title": "GMC يوكن Denali",
  "adKey": "11190120308",
  "notes": [
   "جي ام سي دينالي (يوكن) موديل 2025 مستخدم، عداد 16 ألف كم، محرك 6.2 لتر 8 سلندر، قير أوتوماتيك 10 سرعات، بنزين",
   "حساسات أمامية وخلفية، تنبيه ما قبل التصادم، نظام المحافظة على المسار، سقف بانوراما، كاميرا 360",
   "دخول ذكي، تشغيل بالبصمة وعن بعد، مقاعد جلد مع تبريد وتدفئة، شاشات خلفية، مكيف خلفي، جنوط 24",
   "Apple CarPlay وAndroid Auto، ركن تلقائي، عدادات ديجيتال، شنطة كهربائية، مقاعد خلفية كهربائية",
   "دعاسات جانبية كهربائية"
  ],
  "estimate": [
   310000,
   370000
  ],
  "opening": 165000
 },
 "asis": {
  "id": "L2-toyota-lc76-2022-wagon",
  "no": 2,
  "kind": "open",
  "reserve": false,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": null,
  "mode": "asis",
  "seller": "owner",
  "car": {
   "modelId": "toyota-lc76-2022-wagon",
   "makeAr": "تويوتا",
   "makeEn": "Toyota",
   "modelAr": "جيب ربع",
   "modelEn": "Land Cruiser 76 Hardtop",
   "nick": "الربع",
   "trim": "",
   "year": 2022,
   "body": "suv",
   "engine": "4.0L V6",
   "hp": 228,
   "fuel": "petrol",
   "drive": "4WD",
   "trans": "5MT",
   "tier": "work",
   "doors": 4,
   "km": 15000,
   "kmTag": "low",
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "الرياض",
   "owners": 2,
   "service": "dealer",
   "najm": 1,
   "istimara": "valid",
   "mvpi": "valid",
   "mvpiUntil": "2026/10",
   "insurance": "comp",
   "fines": 0,
   "panels": {
    "fb": "ok",
    "hood": "unknown",
    "roof": "ok",
    "trunk": "ok",
    "rb": "unknown",
    "lff": "unknown",
    "lfd": "paint",
    "lrd": "unknown",
    "lrq": "ok",
    "rff": "unknown",
    "rfd": "ok",
    "rrd": "unknown",
    "rrq": "ok"
   },
   "mech": {
    "engine": "unknown",
    "gearbox": "ok",
    "chassis": "unknown",
    "airbags": "ok",
    "ac": "cold",
    "susp": "unknown"
   },
   "tires": 2026,
   "extras": [],
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": 115,
    "hood": null,
    "roof": 103,
    "trunk": 94,
    "rb": null,
    "lff": null,
    "lfd": 254,
    "lrd": null,
    "lrq": 103,
    "rff": null,
    "rfd": 112,
    "rrd": null,
    "rrq": 105
   },
   "scan": {
    "status": "none",
    "codes": []
   },
   "history": [
    "نجم 2026: حادث، نسبة الخطأ 0%، تقدير الأضرار 6,900 ريال",
    "موجز: مالكين، 1 تفويض",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 9,800 كم عند الوكيل",
    "بطارية: تغيرت 2023",
    "غسيل رديتر: 2026"
   ],
   "inspector": [
    "فحص خارجي فقط، العيوب الخفية ما تنضمن"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ح ل ح",
    "en": "J L J",
    "num": "5568",
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-21/1800x1350_977BFDE8-FDD7-409E-A575-7A33507D01A1.jpg",
    "h:userfiles30/2026-10-21/1800x1350_0A490848-2217-43E0-B641-D3C29A1DD3A8.jpg",
    "h:userfiles30/2026-10-21/1800x1350_ECC217F5-B11D-4972-B060-48B9B1BC340E.jpg",
    "h:userfiles30/2026-10-21/1800x1350_712225DA-9E73-4087-BDA1-0E141FC61B09.jpg",
    "h:userfiles30/2026-10-21/1800x1350_D397F7B2-428F-4965-A4C1-790D184BC8A2.jpg",
    "h:userfiles30/2026-10-21/1800x1350_8CF69BE8-EAA0-406A-8DF5-C4502EF07649.jpg",
    "h:userfiles30/2026-10-21/1800x1350_F2E49271-2B2E-4FCA-BE80-EC09549A0F7D.jpg",
    "h:userfiles30/2026-10-21/1800x1350_15422AB3-A137-4405-9A44-9AEB0E6D2CB2.jpg"
   ],
   "adTitle": "جيب ربع 2022 سعودي شبة الجديد",
   "adUrl": "https://haraj.com.sa/11191041328",
   "said": [
    "km",
    "spec",
    "doors"
   ],
   "story": {
    "owner": "عند صاحب ورشة، يصلح فيها اللي يخرب أول بأول",
    "use": "مشت في البر والنفود أكثر من أي مكان ثاني",
    "why": "استلم سيارة من الشركة، وما يبي سيارتين",
    "quirks": [
     "لاصق حماية شفاف على العتبات من يوم الشراء",
     "حماية الحوض بلاستيك وعليها خدوش شغل",
     "شبك حماية قدام الرديتر من الحصى"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "ميشلان 2026، دعسة 8.2 مم",
     "tone": "good"
    },
    {
     "k": "البطارية",
     "v": "92% من بعيد",
     "tone": "mid"
    },
    {
     "k": "الباقي",
     "v": "ما انفحص",
     "tone": "mid"
    }
   ]
  },
  "title": "تويوتا جيب ربع",
  "adKey": "11191041328",
  "notes": [
   "تويوتا جيب ربع موديل 2022 وكالة سعودي نص فل (دفلك)، الممشى 15 ألف كيلو، شبه جديد",
   "كل ما يهم المشتري موضح في الصور والإعلان ولا يوجد أي ملاحظات",
   "المكينة والبدي وكالة شرط 100%، وإذا طلع خلاف الكلام أتحمل تكاليف الفحص"
  ],
  "estimate": [
   135000,
   175000
  ],
  "opening": 70000
 },
 "staria": {
  "id": "L9-hyundai-staria-2023-11seat",
  "no": 9,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": 4.9,
  "mode": "inspected",
  "seller": "showroom",
  "car": {
   "modelId": "hyundai-staria-2023-11seat",
   "makeAr": "هيونداي",
   "makeEn": "Hyundai",
   "modelAr": "ستاريا",
   "modelEn": "Staria",
   "trim": "",
   "year": 2023,
   "body": "van",
   "engine": "2.2L ديزل تيربو",
   "hp": 174,
   "fuel": "diesel",
   "drive": "FWD",
   "trans": "8AT",
   "tier": "work",
   "doors": 4,
   "km": 88000,
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "جده",
   "owners": 2,
   "service": "dealer",
   "najm": 1,
   "istimara": "valid",
   "mvpi": "valid",
   "mvpiUntil": "2026/10",
   "insurance": "tpl",
   "fines": 0,
   "panels": {
    "fb": "ok",
    "hood": "ok",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "spot",
    "lfd": "ok",
    "lrd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "ok",
    "rrd": "ok",
    "rrq": "ok"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "ok",
    "chassis": "ok",
    "airbags": "ok",
    "ac": "cold",
    "susp": "ok"
   },
   "tires": 2023,
   "extras": [
    "كاميرا",
    "دخول ذكي"
   ],
   "warranty": "ضمان وكالة ساري حتى 2028",
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": 145,
    "hood": 119,
    "roof": 117,
    "trunk": 121,
    "rb": 122,
    "lff": 173,
    "lfd": 111,
    "lrd": 109,
    "lrq": 134,
    "rff": 127,
    "rfd": 148,
    "rrd": 133,
    "rrq": 111
   },
   "scan": {
    "status": "clean",
    "codes": []
   },
   "history": [
    "نجم 2024: حادث، نسبة الخطأ 0%، تقدير الأضرار 6,800 ريال",
    "موجز: مالكين، 2 تفاويض",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 83,400 كم عند الوكيل",
    "بطارية: تغيرت 2025"
   ],
   "inspector": [
    "العادم نظيف، لا دخان ولا ريحة",
    "زيت القير غامق وريحته محروقة"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ق ن ن",
    "en": "G N N",
    "num": "8851",
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-22/1012x1800_20EEA239-06ED-41DE-BE46-D3CDC8E85E81.jpg",
    "h:userfiles30/2026-10-22/1012x1800_E80D138D-9953-4FDE-9944-E0231045EBB3.jpg",
    "h:userfiles30/2026-10-22/1012x1800_26107A8B-55AF-4A3E-ABF0-DE652376CEA1.jpg",
    "h:userfiles30/2026-10-22/1012x1800_BC6224F9-D5F9-447E-9041-E5892D1D1AE5.jpg",
    "h:userfiles30/2026-10-22/1012x1800_DF240402-D5FD-46BC-AA6E-11D088A2FC40.jpg",
    "h:userfiles30/2026-10-22/1012x1800_0C74CB52-E4B7-460E-962A-31D2B7B56402.jpg",
    "h:userfiles30/2026-10-22/1012x1800_BB2AF29A-95E5-4FE5-ACEE-371E3851B7D6.jpg",
    "h:userfiles30/2026-10-22/1012x1800_F9341A6B-D8A8-4FA4-ADCB-CAF02380E872.jpg"
   ],
   "adTitle": "هيونداي ستاريا 2023 ( ديزل ) فل الفل بحالة الوكالة",
   "adUrl": "https://haraj.com.sa/11191109081",
   "said": [
    "km",
    "spec",
    "engine",
    "hp",
    "fuel",
    "doors"
   ],
   "story": {
    "owner": "عند مهندس في شركة بترول، يوقف بعيد عن الناس عشان ما ينصدم بابها",
    "use": "تمشي بين المدينة والمزرعة وتوقف في الشمس",
    "why": "جاه عرض شغل برا البلد، وما يبي يشحنها",
    "quirks": [
     "في السقف الداخلي بقعة صغيرة فوق الراكب",
     "كرسي السواق مرجّع لورا على الآخر",
     "تدفئة الكراسي ما استخدمت ولا مرة"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "بريجستون 2023، دعسة 3.6 مم",
     "tone": "mid"
    },
    {
     "k": "فحمات الفرامل",
     "v": "8% باقي",
     "tone": "bad"
    },
    {
     "k": "البطارية",
     "v": "69%، عمرها سنتين",
     "tone": "mid"
    },
    {
     "k": "جهاز الطلاء",
     "v": "متوسط 128 ميكرون، أعلى قراءة 173",
     "tone": "mid"
    },
    {
     "k": "حرارة الفتحات",
     "v": "5°م",
     "tone": "good"
    },
    {
     "k": "التعليق",
     "v": "متماسك، بدون صوت",
     "tone": "good"
    },
    {
     "k": "أسفل السيارة",
     "v": "ناشف",
     "tone": "good"
    }
   ]
  },
  "title": "هيونداي ستاريا",
  "adKey": "11191109081",
  "notes": [
   "فيها: كاميرا، دخول ذكي"
  ],
  "estimate": [
   82500,
   97500
  ],
  "opening": 60000
 },
 "sf90": {
  "id": "L10-ferrari-sf90-spider-2022-y2023",
  "no": 10,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": 4.7,
  "mode": "inspected",
  "seller": "owner",
  "car": {
   "modelId": "ferrari-sf90-spider-2022-y2023",
   "makeAr": "فيراري",
   "makeEn": "Ferrari",
   "modelAr": "SF90 Spider",
   "modelEn": "SF90 Spider",
   "trim": "",
   "year": 2023,
   "body": "convertible",
   "engine": "4.0L توين تيربو V8 هايبرد",
   "hp": 986,
   "fuel": "hybrid",
   "drive": "AWD",
   "trans": "8DCT",
   "tier": "exotic",
   "doors": 2,
   "km": 17400,
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "جده",
   "owners": 2,
   "service": "dealer",
   "najm": 0,
   "istimara": "valid",
   "mvpi": "valid",
   "mvpiUntil": "2026/01",
   "insurance": "comp",
   "fines": 0,
   "panels": {
    "fb": "ok",
    "hood": "ok",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "ok",
    "lfd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "ok",
    "rrq": "ok"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "minor",
    "chassis": "ok",
    "airbags": "ok",
    "ac": "weak",
    "susp": "ok"
   },
   "tires": 2023,
   "extras": [],
   "warranty": "ضمان وكالة ساري حتى 2028",
   "runs": "drive",
   "keys": 1,
   "microns": {
    "fb": 103,
    "hood": 99,
    "roof": 119,
    "trunk": 106,
    "rb": 135,
    "lff": 148,
    "lfd": 116,
    "lrq": 148,
    "rff": 136,
    "rfd": 110,
    "rrq": 117
   },
   "scan": {
    "status": "stored",
    "codes": [
     [
      "P0741",
      "أداء قابض محول العزم"
     ]
    ]
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: مالكين، 2 تفاويض",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 13,600 كم عند الوكيل",
    "فحمات أمامية: تغيرت 2026",
    "الفحص الدوري: رسبت مرة 2024 ونجحت بعد الإصلاح"
   ],
   "inspector": [
    "القير يتأخر شوي وهو بارد",
    "فلتر المكيف مسدود",
    "المكينة والقير وكالة ما انفكت",
    "صيانة خيالية"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ا ك م",
    "en": "A K Z",
    "num": "1815",
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-5-31/675x900-1_-7QmWJSmkI832ll.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-tQEWBwudz7KJsm.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-oALFOIhrZDeu4m.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-dkmDyOI4RQzB1f.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-rXEHrSClBoFxZJ.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-r5ybIxXCuChEs6.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-I3hs3h5omJwMCG.jpg",
    "h:userfiles30/2026-5-31/675x900-1_-gjduC3q0OFw2BH.jpg"
   ],
   "adTitle": "فيراري SF90",
   "adUrl": "https://haraj.com.sa/11181511733",
   "said": [
    "doors"
   ],
   "story": {
    "owner": "صاحبها صاحب مصنع، ما يدخّن فيها ولا يخلي أحد يدخّن",
    "use": "أغلب مشاويرها بين المدينة والقرية بالليل",
    "why": "يبي يبيع قبل لا ينزل سعرها أكثر",
    "quirks": [
     "كاميرا قدام مثبتة بالشفاط ومعها شريحة",
     "كرسي السواق نازل شوي من جهة الباب"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "يوكوهاما 2023، دعسة 4.2 مم",
     "tone": "mid"
    },
    {
     "k": "جهاز الطلاء",
     "v": "متوسط 122 ميكرون، أعلى قراءة 148",
     "tone": "good"
    },
    {
     "k": "الزيت والماي",
     "v": "زيت جديد، الماي صافي",
     "tone": "good"
    },
    {
     "k": "الفاضي",
     "v": "730 دورة، ثابت",
     "tone": "good"
    },
    {
     "k": "حرارة الفتحات",
     "v": "15°م",
     "tone": "mid"
    },
    {
     "k": "التعليق",
     "v": "متماسك، بدون صوت",
     "tone": "good"
    },
    {
     "k": "أسفل السيارة",
     "v": "رشح خفيف",
     "tone": "mid"
    }
   ]
  },
  "title": "فيراري SF90 Spider",
  "adKey": "11181511733",
  "notes": [
   "(( ما شاء الله"
  ],
  "estimate": [
   2050000,
   2450000
  ],
  "opening": 1250000
 },
 "datsun": {
  "id": "L7-datsun-720-1984-pickup",
  "no": 7,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": 4.2,
  "mode": "inspected",
  "seller": "owner",
  "car": {
   "modelId": "datsun-720-1984-pickup",
   "makeAr": "نيسان",
   "makeEn": "Nissan (Datsun)",
   "modelAr": "ددسن",
   "modelEn": "Datsun 720 Pickup",
   "nick": "ددسن 84",
   "trim": "",
   "year": 1984,
   "body": "pickup",
   "engine": "2.4L 4 سلندر",
   "hp": 95,
   "fuel": "petrol",
   "drive": "RWD",
   "trans": "5MT",
   "tier": "classic",
   "doors": 2,
   "km": 374500,
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "حسب الصور",
   "colorHex": "#C9CCC8",
   "interior": "حسب الصور",
   "city": "المجمعة",
   "owners": 3,
   "service": "none",
   "najm": 0,
   "istimara": "valid",
   "mvpi": "valid",
   "mvpiUntil": "2026/12",
   "insurance": "comp",
   "fines": 2700,
   "panels": {
    "fb": "paint",
    "hood": "ok",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "ok",
    "lfd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "paint",
    "rrq": "ok"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "minor",
    "chassis": "ok",
    "airbags": "ok",
    "ac": "cold",
    "susp": "ok"
   },
   "tires": 2026,
   "extras": [],
   "runs": "drive",
   "keys": 1,
   "microns": {
    "fb": 261,
    "hood": 130,
    "roof": 109,
    "trunk": 120,
    "rb": 117,
    "lff": 110,
    "lfd": 98,
    "lrq": 104,
    "rff": 110,
    "rfd": 272,
    "rrq": 136
   },
   "scan": {
    "status": "stored",
    "codes": [
     [
      "P0741",
      "أداء قابض محول العزم"
     ]
    ]
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: 3 ملاك، 4 تفاويض",
    "سجل الصيانة: لا يوجد",
    "مخالفات ساهر: 9 مخالفات بمجموع 2,700 ريال"
   ],
   "inspector": [
    "زيت القير يبي تغيير",
    "القطع نادرة وأغلبها من التشاليح"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ط ى ط",
    "en": "T V T",
    "num": "3157",
    "kind": "private",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-02/902x1600_30A15C42-712E-4198-84A9-E3772506FCE9.jpg",
    "h:userfiles30/2026-10-02/904x1600_E070D0AB-0911-45BF-9A39-02C0C11BB22D.jpg",
    "h:userfiles30/2026-10-02/900x1600_7E7EFCFB-65E7-4AF6-8E7D-4DAE0DF78514.jpg",
    "h:userfiles30/2026-10-02/900x1600_FE90BCC1-E42D-4029-8F82-63AE2BD64D7F.jpg",
    "h:userfiles30/2026-10-02/900x1600_E06802EF-D329-405E-8956-13918E49D133.jpg"
   ],
   "adTitle": "ددسن 84",
   "adUrl": "https://haraj.com.sa/11189755794",
   "said": [
    "trans",
    "fuel"
   ],
   "story": {
    "owner": "صاحبها مدرس رياضيات، ما يوقفها إلا في الظل ولو مشى بعدها",
    "use": "ممشاها بين الدوائر الحكومية في المواسم، والباقي واقفة",
    "why": "قالوا له المزاد يجيب سعر أحسن من الحراج",
    "quirks": [
     "الإطار الاحتياطي مو مقاسها، من سيارة ثانية",
     "التظليل غامق أكثر من المسموح"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "جوديير 2026، دعسة 7.4 مم",
     "tone": "good"
    },
    {
     "k": "البطارية",
     "v": "43%، عمرها 4 سنين",
     "tone": "bad"
    },
    {
     "k": "جهاز الطلاء",
     "v": "متوسط 142 ميكرون، أعلى قراءة 272",
     "tone": "bad"
    },
    {
     "k": "الفاضي",
     "v": "740 دورة، ثابت",
     "tone": "good"
    },
    {
     "k": "حرارة الفتحات",
     "v": "8°م",
     "tone": "good"
    },
    {
     "k": "التعليق",
     "v": "متماسك، بدون صوت",
     "tone": "good"
    },
    {
     "k": "أسفل السيارة",
     "v": "رشح خفيف",
     "tone": "mid"
    }
   ]
  },
  "title": "نيسان ددسن",
  "adKey": "11189755794",
  "notes": [
   "الموديل: 1984 كلاسيكي",
   "الحالة العامة: مجدد بالكامل على نظافة وبودي وبطن مشدود، ومفحوص وجاهز لنقل الملكية",
   "المحركات والقير: القير والمكينة شرط لا حراره ولا قره ، وعزم الموتر كفو وخالي من الحرارة ومزود بديلكو إلكتروني",
   "المكيف: المكيف موجود ولكن الكمبروسر يحتاج إلى تركيب",
   "العدادات: جميع العدادات شغالة"
  ],
  "estimate": [
   8500,
   10000
  ],
  "opening": 4000
 },
 "eclass": {
  "id": "L7-mercedes-e200-2018",
  "no": 7,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": null,
  "mode": "asis",
  "seller": "showroom",
  "car": {
   "modelId": "mercedes-e200-2018",
   "makeAr": "مرسيدس",
   "makeEn": "Mercedes-Benz",
   "modelAr": "E-Class",
   "modelEn": "E-Class",
   "trim": "",
   "year": 2018,
   "body": "sedan",
   "engine": "2.0L تيربو 4 سلندر",
   "hp": 184,
   "fuel": "petrol",
   "drive": "RWD",
   "trans": "9AT",
   "tier": "luxury",
   "doors": 4,
   "km": 104000,
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "فضي",
   "colorHex": "#B7BBC0",
   "interior": "حسب الصور",
   "city": "جده",
   "owners": 3,
   "service": "dealer",
   "najm": 0,
   "istimara": "valid",
   "mvpi": "valid",
   "mvpiUntil": "2026/10",
   "insurance": "tpl",
   "fines": 0,
   "panels": {
    "fb": "unknown",
    "hood": "unknown",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "unknown",
    "lfd": "ok",
    "lrd": "ok",
    "lrq": "ok",
    "rff": "ok",
    "rfd": "ok",
    "rrd": "ok",
    "rrq": "unknown"
   },
   "mech": {
    "engine": "ok",
    "gearbox": "ok",
    "chassis": "unknown",
    "airbags": "ok",
    "ac": "cold",
    "susp": "unknown"
   },
   "tires": 2022,
   "extras": [],
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": null,
    "hood": null,
    "roof": 122,
    "trunk": 112,
    "rb": 144,
    "lff": null,
    "lfd": 114,
    "lrd": 109,
    "lrq": 109,
    "rff": 99,
    "rfd": 145,
    "rrd": 128,
    "rrq": null
   },
   "scan": {
    "status": "none",
    "codes": []
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: 3 ملاك، 4 تفاويض",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 102,500 كم عند الوكيل",
    "زيت القير: تغيّر 2022",
    "بطارية: تغيرت 2024"
   ],
   "inspector": [
    "فحص خارجي فقط، العيوب الخفية ما تنضمن"
   ],
   "regType": "خصوصي",
   "plate": {
    "ar": "ن ا ى",
    "en": "N A V",
    "num": "5619",
    "kind": "private",
    "format": "eu"
   },
   "photos": [
    "h:userfiles30/2025-12-21/900x1200-1_-GO__MTc2NjMxMDkyNTc4NTc3MjcyNjE2MA.jpg",
    "h:userfiles30/2025-12-21/900x1200-1_-GO__MTc2NjMxMDkyNTA4MzQ4MTEyNDQwNw.jpg",
    "h:userfiles30/2025-12-21/900x1200-1_-GO__MTc2NjMxMDkyNTI3NjIxMTI0MTU2Ng.jpg",
    "h:userfiles30/2025-12-21/900x1200-1_-GO__MTc2NjMxMDkyNTMwMTY3MjE3OTEwMg.jpg",
    "h:userfiles30/2025-12-21/886x1920-1_-GO__MTc2NjMxMDkyNDkyMDcxMjE2NzE3Mw.jpg",
    "h:userfiles30/2025-12-21/886x1920-1_-GO__MTc2NjMxMDkyNTA4NDA0NzUwNzg5Ng.jpg",
    "h:userfiles30/2025-12-21/886x1920-1_-GO__MTc2NjMxMDkyNTA1NzgxMzU1NTgzMg.jpg",
    "h:userfiles30/2025-12-21/900x1200-1_-GO__MTc2NjMxMDkyNTQ2MjkyOTkyMDY3Mw.jpg"
   ],
   "adTitle": "مرسيدس مالك واحد نظيفة جدا ممشى قليل E200 2018",
   "adUrl": "https://haraj.com.sa/11171968555",
   "said": [
    "km",
    "spec",
    "color",
    "trans",
    "fuel",
    "doors"
   ],
   "story": {
    "owner": "عند رجل أعمال، السواق يسوقها وهو ورا",
    "use": "طول السنة في طلعات البحر والشاليهات",
    "why": "عينه على فرصة في السوق، ويبي يقلل مصاريف الشهر",
    "quirks": [
     "رشاش الماي الأمامي ضعيف",
     "ريحة عود خفيفة باقية في الفرش",
     "زر النافذة الخلفية اليسار يبي ضغطتين"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "كومهو 2022، دعسة 2.3 مم",
     "tone": "bad"
    },
    {
     "k": "البطارية",
     "v": "90% من بعيد",
     "tone": "mid"
    },
    {
     "k": "الباقي",
     "v": "ما انفحص",
     "tone": "mid"
    }
   ]
  },
  "title": "مرسيدس E-Class",
  "adKey": "11171968555",
  "notes": [
   "مرسيدس E E200 2018",
   "الممشى: 104.000 كلم",
   "طبقة حماية PPF خارجي وداخلي مع نانو سيراميك للمقاعد والجلد",
   "البدي و المحركات جميعها بحاله الوكاله",
   "السبارة اشتريتها من الوكيل في هولندا حيث كنت اعمل هناك"
  ],
  "estimate": [
   120000,
   155000
  ],
  "opening": 72500
 },
 "covered": {
  "id": "L9-ram-1500-trx-2022",
  "no": 9,
  "kind": "covered",
  "reserve": false,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": null,
  "mode": "asis",
  "seller": "showroom",
  "car": null,
  "cover": {
   "body": "pickup",
   "yearFrom": 2018,
   "yearTo": 2026,
   "hints": [
    "اللون: رصاصي",
    "المواصفات: سعودي",
    "بنزين"
   ],
   "photo": "h:userfiles30/2026-08-24/900x675-1_-GO__MTc4NzU1MjgxMjU5NzQ3OTg1MjU5OA.jpg"
  },
  "title": "RAM 1500 TRX غمارتين",
  "adKey": "11187097217",
  "notes": [
   "الغطا ما ينشال إلا بعد البيع"
  ],
  "estimate": null,
  "opening": 75000
 },
 "coveredCar": {
  "id": "L8-kia-carnival-2022-mid",
  "no": 8,
  "kind": "open",
  "reserve": true,
  "relist": 0,
  "fee": {
   "pct": 2.5,
   "vat": true,
   "transfer": 150,
   "label": "سعي 2.5% + ضريبة"
  },
  "grade": null,
  "mode": "asis",
  "seller": "owner",
  "car": {
   "modelId": "kia-carnival-2022-mid",
   "makeAr": "كيا",
   "makeEn": "Kia",
   "modelAr": "كرنفال",
   "modelEn": "Carnival",
   "trim": "",
   "year": 2022,
   "body": "van",
   "engine": "3.5L V6",
   "hp": 268,
   "fuel": "petrol",
   "drive": "FWD",
   "trans": "8AT",
   "tier": "family",
   "doors": 4,
   "km": 9000,
   "kmTag": "low",
   "spec": "سعودي وكالة",
   "specKind": "saudi",
   "color": "كحلي",
   "colorHex": "#1C2944",
   "interior": "حسب الصور",
   "city": "الرياض",
   "owners": 2,
   "service": "dealer",
   "najm": 0,
   "istimara": "expired",
   "mvpi": "expired",
   "insurance": "tpl",
   "fines": 0,
   "panels": {
    "fb": "spot",
    "hood": "unknown",
    "roof": "ok",
    "trunk": "ok",
    "rb": "ok",
    "lff": "paint",
    "lfd": "dent",
    "lrd": "paint",
    "lrq": "unknown",
    "rff": "unknown",
    "rfd": "ok",
    "rrd": "unknown",
    "rrq": "ok"
   },
   "mech": {
    "engine": "unknown",
    "gearbox": "ok",
    "chassis": "unknown",
    "airbags": "ok",
    "ac": "cold",
    "susp": "unknown"
   },
   "tires": 2024,
   "extras": [],
   "runs": "drive",
   "keys": 2,
   "microns": {
    "fb": 181,
    "hood": null,
    "roof": 111,
    "trunk": 110,
    "rb": 132,
    "lff": 284,
    "lfd": 874,
    "lrd": 259,
    "lrq": null,
    "rff": null,
    "rfd": 144,
    "rrd": null,
    "rrq": 109
   },
   "scan": {
    "status": "none",
    "codes": []
   },
   "history": [
    "سجل نجم: لا توجد حوادث مسجلة",
    "موجز: مالكين، 3 تفاويض",
    "سجل الصيانة: منتظم بالوكالة",
    "آخر غيار زيت: على 2,900 كم عند الوكيل",
    "زيت القير: تغيّر 2025"
   ],
   "inspector": [
    "فحص خارجي فقط، العيوب الخفية ما تنضمن"
   ],
   "regType": "نقل خاص",
   "plate": {
    "ar": "هـ و ع",
    "en": "H U E",
    "num": "9521",
    "kind": "transport",
    "format": "us"
   },
   "photos": [
    "h:userfiles30/2026-10-22/1350x1800_29EC7469-CE8D-4EC4-8C8D-F90BE33D504A.jpg",
    "h:userfiles30/2026-10-22/1350x1800_CB86EFE8-346B-49B4-90C0-5D98CCFCE3D5.jpg",
    "h:userfiles30/2026-10-22/1800x1350_F98DBC2F-65F2-4DFF-B504-E82E9CAD258E.jpg",
    "h:userfiles30/2026-10-22/1800x1350_D8BFBBB6-A8D8-4E2E-928C-6AFAD114EA1C.jpg",
    "h:userfiles30/2026-10-22/1800x1350_C2C48BD3-9F52-4606-90D5-343D5E8376DF.jpg",
    "h:userfiles30/2026-10-22/1800x1350_7B446E0B-7A6A-4F14-94C4-B3291BC1A0FB.jpg",
    "h:userfiles30/2026-10-22/1350x1800_56FB86D0-DDE1-4552-9C00-7F71F6FA97F8.jpg",
    "h:userfiles30/2026-10-22/1350x1800_0F507D9F-A956-433A-A1A2-9F2D7A039EA9.jpg"
   ],
   "adTitle": "كرنفال 2022 سعودي عداد 9 الف فقط",
   "adUrl": "https://haraj.com.sa/11191075756",
   "said": [
    "km",
    "spec",
    "color",
    "doors"
   ],
   "story": {
    "owner": "عند مزارع نخل، موسم الصرام يشيل فيها كراتين",
    "use": "عاشت بين البيت وبيوت الأهل والمكيف شغال على الآخر",
    "why": "جته من دين، وهو أصلاً ما يحبها",
    "quirks": [
     "الإريل مغيّر بقصير",
     "حماية شفافة على الكبوت والمرايات",
     "المراية الداخلية مغيّرة بعريضة"
    ]
   },
   "checks": [
    {
     "k": "الكفرات",
     "v": "كونتيننتال 2024، دعسة 4.8 مم",
     "tone": "mid"
    },
    {
     "k": "البطارية",
     "v": "67% من بعيد",
     "tone": "mid"
    },
    {
     "k": "الباقي",
     "v": "ما انفحص",
     "tone": "mid"
    }
   ]
  },
  "title": "كيا كرنفال",
  "adKey": "11191075756",
  "notes": [
   "البدي وكاله عدا كبوت رش خارجي، الشاص والارباق سليم، المتحركات علئ الشرط (سعودي الجبر، 6 سلندر 3500، داخلية جملي)"
  ],
  "estimate": [
   77500,
   100000
  ],
  "opening": 49000
 }
};
