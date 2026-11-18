// Words in English and Arabic. Arabic switches the whole layout to right-to-left.
const AR = {
  "3D": "ثلاثي الأبعاد", Top: "من الأعلى", Walk: "تجوّل", Photo: "صورة واقعية", "Photo ready": "الصورة جاهزة", "Making photo": "جارٍ تحسين الصورة",
  Day: "نهار", Night: "ليل", Live: "مباشر", Home: "المنزل", Homes: "المنازل", "New home": "منزل جديد", "Start from": "ابدأ من", Blank: "فارغ",
  Rooms: "الغرف", Room: "غرفة", Doors: "الأبواب", Door: "باب", Window: "نافذة", Slider: "باب منزلق", Arch: "قوس", Furniture: "الأثاث", Devices: "الأجهزة",
  Select: "تحديد", Draw: "رسم", Undo: "تراجع", Redo: "إعادة", Save: "حفظ", Saved: "تم الحفظ", Saving: "جارٍ الحفظ", Delete: "حذف", Duplicate: "نسخ", Rotate: "تدوير",
  Name: "الاسم", Type: "النوع", Floor: "الأرضية", Walls: "الجدران", Width: "العرض", Depth: "العمق", Height: "الارتفاع", Sill: "ارتفاع العتبة", Colour: "اللون",
  Settings: "الإعدادات", Quality: "الجودة", Auto: "تلقائي", Low: "منخفضة", Medium: "متوسطة", High: "عالية", "Cut walls": "جدران مقطوعة", "Full walls": "جدران كاملة",
  North: "الشمال", "Real sun": "الشمس الحقيقية", Link: "ربط", Entity: "الجهاز في Home Assistant", "Not linked": "غير مربوط", Import: "استيراد",
  "From a photo": "من صورة", "From CAD or PDF": "من ملف CAD أو PDF", Light: "إضاءة", Look: "الشكل", Brightness: "السطوع", Flip: "قلب الاتجاه", Done: "تم",
  "Drag to move. Pull a corner or a wall to resize.": "اسحب للتحريك. اسحب زاوية أو جداراً لتغيير الحجم.",
  "Tap and drag on the plan to draw a room.": "المس واسحب على المخطط لرسم غرفة.",
  "Tap a wall to add it.": "المس جداراً لإضافته.",
  "Drag a piece onto the plan.": "اسحب قطعة إلى المخطط.",
  Offline: "غير متصل", Level: "الطابق", "Add level": "إضافة طابق", Locked: "مقفل", Unlocked: "غير مقفل", Jammed: "عالق", "Device not found": "الجهاز غير موجود", "No homes yet": "لا توجد منازل بعد", Open: "مفتوح", Closed: "مغلق", On: "يعمل", Off: "متوقف", Away: "خارج المنزل",
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
