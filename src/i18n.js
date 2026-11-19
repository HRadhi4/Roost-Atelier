// Words in English and Arabic. Arabic switches the whole layout to right-to-left.
const AR = {
  "3D": "ثلاثي الأبعاد", Top: "من الأعلى", Walk: "تجوّل", Photo: "صورة واقعية", "Photo ready": "الصورة جاهزة", "Making photo": "جارٍ تحسين الصورة",
  Day: "نهار", Night: "ليل", Live: "مباشر", Home: "المنزل", Homes: "المنازل", "New home": "منزل جديد", "Start from": "ابدأ من", Blank: "فارغ",
  Rooms: "الغرف", Room: "غرفة", Doors: "الأبواب", Door: "باب", Window: "نافذة", Slider: "باب منزلق", Arch: "قوس", Furniture: "الأثاث", Devices: "الأجهزة",
  Select: "تحديد", Draw: "رسم", Undo: "تراجع", Redo: "إعادة", Save: "حفظ", Saved: "تم الحفظ", Saving: "جارٍ الحفظ", Delete: "حذف", Duplicate: "نسخ", "Drag to turn": "اسحب للتدوير", "Whole floor": "الطابق كاملاً", "Recessed spot": "سبوت مخفي", "Track light": "إضاءة مسار", "Linear light": "إضاءة خطية", "Focus light": "إضاءة تركيز", "Hidden cove": "إضاءة مخفية بالجبس", Ceiling: "السقف", "Ceiling lights": "إضاءة السقف", Strip: "شريط", Length: "الطول", Heads: "الرؤوس", Tilt: "الميل", Turn: "تدوير", "Point the heads": "توجيه الرؤوس", "Aim height": "ارتفاع التوجيه", "From the left wall": "من الجدار الأيسر", "From the top wall": "من الجدار العلوي", "Fill the room evenly": "توزيع متساوٍ في الغرفة", "Make the grid": "إنشاء الشبكة", "Drag the small target on the plan onto the painting or wall it should light.": "اسحب الهدف الصغير على المخطط إلى اللوحة أو الجدار المراد إضاءته.", "Light output (each head)": "شدة الإضاءة (لكل رأس)", "Light output (per metre)": "شدة الإضاءة (لكل متر)", "Lamp glow": "توهج المصابيح", Photos: "الصور", "All photos ready": "كل الصور جاهزة", "Made by themselves in the background once the light is ready": "تُصنع تلقائياً في الخلفية بعد تجهيز الإضاءة", "Making room photos · touch to stop": "جارٍ تصوير الغرف · المس للإيقاف", Rotate: "تدوير",
  Name: "الاسم", Type: "النوع", Floor: "الأرضية", Walls: "الجدران", Width: "العرض", Depth: "العمق", Height: "الارتفاع", Sill: "ارتفاع العتبة", Colour: "اللون",
  Settings: "الإعدادات", Quality: "الجودة", Auto: "تلقائي", Low: "منخفضة", Medium: "متوسطة", High: "عالية", "Cut walls": "جدران مقطوعة", "Full walls": "جدران كاملة",
  North: "الشمال", "Real sun": "الشمس الحقيقية", Link: "ربط", Entity: "الجهاز في Home Assistant", "Not linked": "غير مربوط", Import: "استيراد",
  "From a photo": "من صورة", "From CAD or PDF": "من ملف CAD أو PDF", Light: "إضاءة", Look: "الشكل", Brightness: "السطوع", Flip: "قلب الاتجاه", Done: "تم",
  "Drag to move. Pull a corner or a wall to resize.": "اسحب للتحريك. اسحب زاوية أو جداراً لتغيير الحجم.",
  "Tap and drag on the plan to draw a room.": "المس واسحب على المخطط لرسم غرفة.",
  "Tap a wall to add it.": "المس جداراً لإضافته.",
  "Drag a piece onto the plan.": "اسحب قطعة إلى المخطط.",
  Offline: "غير متصل", "Room photos": "صور الغرف", "Made by themselves when the computer is free": "تُصنع تلقائياً عندما يكون الحاسوب غير مشغول", Warmth: "دفء الضوء", "Light output": "قوة الإضاءة", "Room brightness": "سطوع الغرفة", "Overall brightness": "السطوع العام", "Match a photo of this room": "مطابقة صورة لهذه الغرفة", "Could not read this photo": "تعذّرت قراءة الصورة", "Not smart: when is it on?": "غير ذكي: متى يعمل؟", "Always on": "يعمل دائماً", "Always off": "متوقف دائماً", "On after sunset": "يعمل بعد الغروب", "On between set times": "يعمل بين وقتين", Lighting: "الإضاءة", "Photo mode isn't available on this device": "وضع الصورة غير متاح على هذا الجهاز", Level: "الطابق", "Add level": "إضافة طابق", Locked: "مقفل", Unlocked: "غير مقفل", Jammed: "عالق", "Device not found": "الجهاز غير موجود", "No homes yet": "لا توجد منازل بعد", Open: "مفتوح", Closed: "مغلق", On: "يعمل", Off: "متوقف", Away: "خارج المنزل",
  "Living room": "غرفة المعيشة", Dining: "الطعام", Kitchen: "المطبخ", Bedroom: "غرفة النوم", Bathroom: "الحمام", Hall: "الممر", Entrance: "المدخل", Office: "المكتب",
  Laundry: "الغسيل", Balcony: "الشرفة", Garden: "الحديقة", Majlis: "المجلس", Living: "المعيشة", Decor: "الديكور", Lights: "الإضاءة", Outdoor: "خارجي",
  "Check the home": "فحص المنزل", "Looks good": "كل شيء سليم", Recognise: "تعرّف", Add: "إضافة", Cancel: "إلغاء", Close: "إغلاق", Rename: "إعادة تسمية", Search: "بحث",
};
let lang = "en";
export function setLang(l) { lang = /^ar/.test(l || "") ? "ar" : "en"; return lang; }
export const getLang = () => lang;
export const isRtl = () => lang === "ar";
export function t(s) { return lang === "ar" ? AR[s] || s : s; }
export function langFor(hass, override) { return setLang(override && override !== "auto" ? override : hass?.locale?.language || hass?.language || "en"); }
