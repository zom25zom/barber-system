// Initial default data for Barbershop Booking & Management System

export const DEFAULT_BARBERS = [
  {
    id: "b1",
    name: "أحمد علي",
    title: "كبير الحلاقين - خبير قصات كلاسيكية ومودرن",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    workDays: [0, 1, 2, 3, 4, 6], // 0: Sun, 1: Mon, etc.
    workStart: "14:00",
    workEnd: "23:00",
    isOff: false,
    rating: 4.9
  },
  {
    id: "b2",
    name: "مصطفى حسن",
    title: "أخصائي تسريحات حديثة وتدريج دقيق",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    workDays: [0, 1, 2, 3, 4, 5, 6],
    workStart: "15:00",
    workEnd: "00:00",
    isOff: false,
    rating: 4.8
  },
  {
    id: "b3",
    name: "عمر الفاروق",
    title: "خبير العناية بالبشرة واللحية وتجهيز العرسان",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    workDays: [0, 2, 3, 4, 5, 6],
    workStart: "16:00",
    workEnd: "01:00",
    isOff: false,
    rating: 4.95
  }
];

export const DEFAULT_SERVICES = [
  {
    id: "s1",
    name: "قص شعر ملكي + تصفيف",
    price: 75,
    duration: 30,
    category: "شعر",
    description: "قص متقن تناسب ملامح الوجه مع غسيل وتصفيف بالاستشوار والمنتجات العالمية."
  },
  {
    id: "s2",
    name: "تحديد وتشذيب اللحية مع البخار",
    price: 45,
    duration: 20,
    category: "لحية",
    description: "تحديد بالشفره مع بخار دافئ وزيوت مغذية للبشرة واللحية."
  },
  {
    id: "s3",
    name: "باقة VIP الشاملة (قص + لحية + تنظيف بشرة + مساج)",
    price: 160,
    duration: 65,
    category: "باقات",
    description: "العناية الكاملة الكبرى: قص وتحديد وتنظيف بشرة عميق بالأجهزة ومساج للكتفين."
  },
  {
    id: "s4",
    name: "تنظيف بشرة بقناع الفحم وقناع الذهب",
    price: 85,
    duration: 30,
    category: "بشرة",
    description: "إزالة الخلايا الميتة والرؤوس السوداء مع قناع الذهب لترطيب نضر."
  },
  {
    id: "s5",
    name: "صبغة لحية وشعر احترافية",
    price: 90,
    duration: 40,
    category: "صبغة",
    description: "تغطية كاملة للشيب بمنتجات خالية من الأمونيا تحافظ على حيوية الشعر."
  },
  {
    id: "s6",
    name: "قص وتحديد للأطفال (أقل من 12 سنة)",
    price: 50,
    duration: 20,
    category: "شعر",
    description: "قصة مريحة ولطيفة للأطفال في جو ممتع وهادئ."
  }
];

const todayStr = new Date().toISOString().split('T')[0];

export const DEFAULT_BOOKINGS = [
  {
    id: "bk-101",
    customerName: "سعد المهندس",
    customerPhone: "0501112233",
    barberId: "b1",
    serviceIds: ["s1", "s2"],
    totalPrice: 120,
    totalDuration: 50,
    date: todayStr,
    time: "16:00",
    status: "Pending",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: "يرجى الالتزام بالموعد"
  },
  {
    id: "bk-102",
    customerName: "خالد العتيبي",
    customerPhone: "0554445566",
    barberId: "b1",
    serviceIds: ["s3"],
    totalPrice: 160,
    totalDuration: 65,
    date: todayStr,
    time: "17:00",
    status: "Pending",
    createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString()
  },
  {
    id: "bk-103",
    customerName: "فهد الدوسري",
    customerPhone: "0567778899",
    barberId: "b2",
    serviceIds: ["s1"],
    totalPrice: 75,
    totalDuration: 30,
    date: todayStr,
    time: "16:30",
    status: "Pending",
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: "bk-104",
    customerName: "محمد الشمري",
    customerPhone: "0590001122",
    barberId: "b2",
    serviceIds: ["s2", "s4"],
    totalPrice: 130,
    totalDuration: 50,
    date: todayStr,
    time: "17:15",
    status: "Pending",
    createdAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: "bk-100",
    customerName: "عبدالعزيز الغامدي",
    customerPhone: "0543219876",
    barberId: "b1",
    serviceIds: ["s1"],
    totalPrice: 75,
    totalDuration: 30,
    date: todayStr,
    time: "15:00",
    status: "Completed",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "bk-099",
    customerName: "ياسر القحطاني",
    customerPhone: "0533334455",
    barberId: "b3",
    serviceIds: ["s3"],
    totalPrice: 160,
    totalDuration: 65,
    date: todayStr,
    time: "16:15",
    status: "Completed",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const DEFAULT_NOTIFICATIONS = [
  {
    id: "n-1",
    title: "حجز جديد",
    message: "قام محمد الشمري بحجز موعد لدى مصطفى حسن الساعة 05:15 م",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    type: "new_booking"
  },
  {
    id: "n-2",
    title: "حجز جديد",
    message: "قام فهد الدوسري بحجز موعد لدى مصطفى حسن الساعة 04:30 م",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    type: "new_booking"
  }
];
