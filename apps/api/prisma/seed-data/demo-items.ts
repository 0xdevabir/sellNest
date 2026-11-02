import { ListingCondition } from '@prisma/client';

export type DemoItem = {
  title: string;
  category: string;
  condition: ListingCondition;
  price: number;
  original?: number;
  negotiable?: boolean;
  location: string;
  seller: number;
  brand?: string;
  description: string;
};

/** Demo listings clustered around Daffodil Smart City / Ashulia / Khagan / Birulia. */
export const DEMO_ITEMS: DemoItem[] = [
  // Electronics
  { title: 'Lenovo IdeaPad 3 laptop, Ryzen 5, 8 GB', category: 'laptops', condition: 'GOOD', price: 38000, original: 58000, negotiable: true, location: 'daffodil-smart-city', seller: 0, brand: 'Lenovo', description: 'Used for two semesters. Battery lasts about four hours. Comes with the original charger. Small scratch on the lid, screen is clean.' },
  { title: 'HP Pavilion 15, Core i5, 512 GB SSD', category: 'laptops', condition: 'LIKE_NEW', price: 52000, original: 72000, negotiable: true, location: 'khagan', seller: 1, brand: 'HP', description: 'Bought last year and hardly used. Runs Windows 11 smoothly, and the keyboard backlight works. Box and bill available.' },
  { title: 'Acer Aspire 5, Ryzen 7, 16 GB RAM', category: 'laptops', condition: 'GOOD', price: 48000, original: 70000, negotiable: true, location: 'daffodil-smart-city', seller: 2, brand: 'Acer', description: 'Fast enough for coding and light design. SSD has plenty of space. Meet at the DIU gate or cafeteria.' },
  { title: 'MacBook Air M1, 8/256, space grey', category: 'laptops', condition: 'LIKE_NEW', price: 78000, original: 115000, negotiable: true, location: 'ashulia', seller: 3, brand: 'Apple', description: 'Battery health around 92%. No dents. Charger included. Prefer campus meetup.' },
  { title: 'Dell Inspiron 14, Core i3, 8 GB', category: 'laptops', condition: 'FAIR', price: 22000, negotiable: true, location: 'birulia', seller: 4, brand: 'Dell', description: 'Older machine but boots fine for Word, Excel and Zoom. Battery lasts about two hours on charge.' },
  { title: 'Samsung Galaxy A34 5G, 8/128', category: 'phones', condition: 'GOOD', price: 21500, negotiable: true, location: 'ashulia', seller: 2, brand: 'Samsung', description: 'One owner. Always used with a cover and screen protector. Official variant with charger and box.' },
  { title: 'Xiaomi Redmi Note 12, 6/128', category: 'phones', condition: 'FAIR', price: 11000, location: 'birulia', seller: 0, brand: 'Xiaomi', description: 'Back glass has a hairline crack; everything else works. A good backup phone at a fair price.' },
  { title: 'iPhone 11, 64 GB, black', category: 'phones', condition: 'GOOD', price: 32000, original: 45000, negotiable: true, location: 'daffodil-smart-city', seller: 1, brand: 'Apple', description: 'Battery health 86%. Face ID works. Comes with a cable and a soft case.' },
  { title: 'Realme Narzo 50, 4/128', category: 'phones', condition: 'GOOD', price: 9500, negotiable: true, location: 'khagan', seller: 3, brand: 'Realme', description: 'Clean display, no dead pixels. Used as a secondary phone. Charger included.' },
  { title: 'Samsung Galaxy Tab A8, 64 GB', category: 'phones', condition: 'LIKE_NEW', price: 16500, original: 24000, location: 'daffodil-smart-city', seller: 4, brand: 'Samsung', description: 'Great for notes and PDFs. Screen protector on. Box and charger available.' },
  { title: 'Sony WH-CH520 wireless headphones', category: 'audio', condition: 'LIKE_NEW', price: 4200, original: 6200, location: 'daffodil-smart-city', seller: 3, brand: 'Sony', description: 'Used for a month. Long battery life and clean sound. Includes the charging cable.' },
  { title: 'JBL Flip 5 portable speaker', category: 'audio', condition: 'GOOD', price: 5500, negotiable: true, location: 'khagan', seller: 0, brand: 'JBL', description: 'Loud and clear. Battery still lasts a full evening. Small scuff on the fabric.' },
  { title: 'boAt Airdopes 141 earbuds', category: 'audio', condition: 'GOOD', price: 1200, location: 'ashulia', seller: 1, brand: 'boAt', description: 'Both buds work. Case charges fine. Selling because I upgraded.' },
  { title: 'Logitech mechanical keyboard and mouse set', category: 'accessories', condition: 'GOOD', price: 3500, negotiable: true, location: 'khagan', seller: 1, brand: 'Logitech', description: 'Both work perfectly. Selling because I moved to a laptop-only setup. The USB receiver is included.' },
  { title: '24 inch Dell monitor, full HD', category: 'accessories', condition: 'GOOD', price: 12500, negotiable: true, location: 'daffodil-smart-city', seller: 4, brand: 'Dell', description: 'No dead pixels. HDMI cable included. Easy pickup from Smart City hostel area.' },
  { title: 'Casio scientific calculator fx-991EX', category: 'accessories', condition: 'LIKE_NEW', price: 1700, location: 'daffodil-smart-city', seller: 2, brand: 'Casio', description: 'Used for one semester. Genuine unit, with the cover and manual.' },
  { title: 'TP-Link Wi-Fi router, dual band', category: 'accessories', condition: 'GOOD', price: 1800, location: 'birulia', seller: 0, brand: 'TP-Link', description: 'Stable for a shared flat. Reset to factory defaults. Power adapter included.' },
  { title: 'USB-C hub, 7-in-1 with HDMI', category: 'accessories', condition: 'LIKE_NEW', price: 2200, location: 'daffodil-smart-city', seller: 3, description: 'Works with Mac and Windows. HDMI, USB-A, SD and power pass-through.' },
  { title: 'External SSD 500 GB, Samsung T7', category: 'accessories', condition: 'LIKE_NEW', price: 6500, original: 9000, location: 'ashulia', seller: 1, brand: 'Samsung', description: 'Barely used. Fast transfers. Cable in the box.' },

  // Books
  { title: 'Introduction to Algorithms, CLRS, 3rd edition', category: 'course-books', condition: 'GOOD', price: 900, location: 'daffodil-smart-city', seller: 2, description: 'Local print. Some highlighting in the first eight chapters. Useful for the algorithms course and for interviews.' },
  { title: 'Engineering mathematics book set, 3 volumes', category: 'course-books', condition: 'FAIR', price: 750, negotiable: true, location: 'ashulia', seller: 3, description: 'Three volumes with pencil notes in the margins. Covers are worn but all pages are intact.' },
  { title: 'Database System Concepts, Silberschatz', category: 'course-books', condition: 'GOOD', price: 1100, location: 'daffodil-smart-city', seller: 0, description: 'International edition photocopy bound well. Clean margins, a few sticky notes.' },
  { title: 'Operating System Concepts, 10th edition', category: 'course-books', condition: 'LIKE_NEW', price: 1300, location: 'khagan', seller: 1, description: 'Almost unused. Perfect for the OS course this semester.' },
  { title: 'DIU CSE lab report notebook pack', category: 'course-books', condition: 'NEW', price: 350, location: 'daffodil-smart-city', seller: 4, description: 'Four unused lab notebooks. Bought extra by mistake.' },
  { title: 'Humayun Ahmed novel collection, 12 books', category: 'fiction', condition: 'GOOD', price: 1800, location: 'khagan', seller: 4, description: 'Twelve novels in good condition. Selling them together before moving halls.' },
  { title: 'English vocabulary builder set', category: 'fiction', condition: 'GOOD', price: 600, location: 'birulia', seller: 2, description: 'Two paperbacks for IELTS prep. Light underlining only.' },

  // Furniture
  { title: 'Study table with drawer, wood finish', category: 'desks-chairs', condition: 'GOOD', price: 4500, original: 7500, negotiable: true, location: 'khagan', seller: 0, description: 'Solid table that fits a hostel room. You will need to arrange a van; I can help carry it downstairs.' },
  { title: 'Ergonomic mesh office chair', category: 'desks-chairs', condition: 'LIKE_NEW', price: 8500, negotiable: true, location: 'birulia', seller: 1, description: 'Adjustable height and armrests, used for six months. No tears in the mesh, and the wheels roll smoothly.' },
  { title: 'Folding study desk, compact', category: 'desks-chairs', condition: 'GOOD', price: 2800, location: 'daffodil-smart-city', seller: 2, description: 'Folds flat for moving day. Surface is clean. Ideal for a small room.' },
  { title: 'Bean bag chair, large', category: 'desks-chairs', condition: 'FAIR', price: 1500, negotiable: true, location: 'ashulia', seller: 3, description: 'Cover is washable. Beans settled a bit; still comfortable for gaming.' },
  { title: 'Single bed with mattress', category: 'beds-storage', condition: 'FAIR', price: 6000, negotiable: true, location: 'ashulia', seller: 2, description: 'Wooden frame and a foam mattress. Some marks on the frame. Must be picked up this month.' },
  { title: 'Plastic wardrobe, 4 shelves', category: 'beds-storage', condition: 'GOOD', price: 2200, location: 'daffodil-smart-city', seller: 3, description: 'Lightweight and easy to take apart for moving. Zip cover has no tears.' },
  { title: 'Metal bunk bed, bottom only', category: 'beds-storage', condition: 'GOOD', price: 5000, negotiable: true, location: 'khagan', seller: 0, description: 'Sturdy frame. Mattress not included. Pickup from Khagan mess area.' },
  { title: 'Storage boxes set of 5', category: 'beds-storage', condition: 'LIKE_NEW', price: 800, location: 'daffodil-smart-city', seller: 1, description: 'Clear plastic with lids. Great under a bed or in a wardrobe.' },

  // Home
  { title: 'Miyako rice cooker, 1.8 litre', category: 'kitchen', condition: 'GOOD', price: 1500, location: 'khagan', seller: 4, brand: 'Miyako', description: 'Works well and the inner pot has no scratches. Ideal for a shared hostel kitchen.' },
  { title: 'Electric kettle, 1.7 litre', category: 'kitchen', condition: 'GOOD', price: 900, location: 'daffodil-smart-city', seller: 0, description: 'Boils quickly. Auto shut-off works. No leaks.' },
  { title: 'Induction cooker plate', category: 'kitchen', condition: 'LIKE_NEW', price: 3200, original: 4500, location: 'ashulia', seller: 1, brand: 'Walton', description: 'Used for one semester. Comes with one compatible pot.' },
  { title: 'Lunch box set with bag', category: 'kitchen', condition: 'GOOD', price: 450, location: 'birulia', seller: 2, description: 'Three stainless containers. Bag has a shoulder strap.' },
  { title: 'Walton mini fridge, 50 litre', category: 'appliances', condition: 'GOOD', price: 9500, original: 14000, negotiable: true, location: 'ashulia', seller: 0, brand: 'Walton', description: 'Cools properly and runs quietly. Fits under a desk. Used for one and a half years.' },
  { title: 'Table fan, 16 inch', category: 'appliances', condition: 'FAIR', price: 1200, location: 'birulia', seller: 1, description: 'All three speeds work. It has a little noise at top speed, but nothing that bothers me at night.' },
  { title: 'Rechargeable LED study lamp', category: 'appliances', condition: 'LIKE_NEW', price: 850, location: 'daffodil-smart-city', seller: 3, description: 'Three brightness levels. USB charge. Perfect for late-night labs.' },
  { title: 'Extension board, 5 sockets with surge', category: 'appliances', condition: 'GOOD', price: 550, location: 'khagan', seller: 4, description: 'Heavy duty cable. All sockets and the switch work.' },

  // Fashion
  { title: 'Formal blazer, navy, size 40', category: 'clothing', condition: 'LIKE_NEW', price: 2500, original: 5000, location: 'daffodil-smart-city', seller: 4, description: 'Worn twice for presentations. Dry cleaned and ready to wear.' },
  { title: 'University hoodie, XL, black', category: 'clothing', condition: 'GOOD', price: 700, location: 'daffodil-smart-city', seller: 2, description: 'Soft fleece. Faded print is still readable. Washed many times.' },
  { title: 'Formal shirt pair, white and light blue', category: 'clothing', condition: 'GOOD', price: 900, location: 'ashulia', seller: 0, description: 'Size 40. No stains. Good for viva and interviews.' },
  { title: 'Bata leather shoes, size 42', category: 'shoes-bags', condition: 'GOOD', price: 1400, location: 'khagan', seller: 2, brand: 'Bata', description: 'Lightly used formal shoes. Soles are in good shape, and they have just been polished.' },
  { title: 'Laptop backpack, water resistant', category: 'shoes-bags', condition: 'LIKE_NEW', price: 900, location: 'daffodil-smart-city', seller: 3, description: 'Fits a 15.6 inch laptop. All zips work, and there are no stains.' },
  { title: 'Sports sneakers, size 43', category: 'shoes-bags', condition: 'FAIR', price: 1100, negotiable: true, location: 'birulia', seller: 1, description: 'Comfortable for walking campus. Sole grip still okay.' },

  // Vehicles & sports
  { title: 'Phoenix mountain bicycle, 26 inch', category: 'bicycles', condition: 'GOOD', price: 11500, negotiable: true, location: 'daffodil-smart-city', seller: 0, brand: 'Phoenix', description: 'Recently serviced with new brake pads. Good for getting around campus and the nearby area.' },
  { title: 'Hero Sprint hybrid bike', category: 'bicycles', condition: 'LIKE_NEW', price: 14000, original: 18500, negotiable: true, location: 'khagan', seller: 1, brand: 'Hero', description: 'Bought mid-semester, barely used. Lock and bottle holder included.' },
  { title: 'TVS Scooty Pep+, 2019', category: 'motorbikes', condition: 'GOOD', price: 45000, negotiable: true, location: 'ashulia', seller: 4, brand: 'TVS', description: 'Papers clear. Recent servicing. Ideal for Ashulia–Smart City trips. Meet at Savar road.' },
  { title: 'Yonex badminton racket pair', category: 'sports-gear', condition: 'GOOD', price: 1600, location: 'khagan', seller: 1, brand: 'Yonex', description: 'Two rackets with covers. Strings still have good tension.' },
  { title: 'Football, size 5, match quality', category: 'sports-gear', condition: 'GOOD', price: 900, location: 'daffodil-smart-city', seller: 2, description: 'Still round and holds air. Used on the campus ground a few times.' },
  { title: 'Dumbbell set, 5 kg pair', category: 'sports-gear', condition: 'LIKE_NEW', price: 1800, location: 'birulia', seller: 3, description: 'Cast iron with rubber coating. Quiet for hostel floors.' },
  { title: 'Acoustic guitar with bag', category: 'instruments', condition: 'GOOD', price: 5500, negotiable: true, location: 'daffodil-smart-city', seller: 4, description: 'Good beginner guitar with a nice tone. Comes with a bag, a capo and spare strings.' },
  { title: 'Casio CT-X700 keyboard', category: 'instruments', condition: 'LIKE_NEW', price: 12000, original: 16000, negotiable: true, location: 'ashulia', seller: 0, brand: 'Casio', description: '61 keys. Stand and adaptor included. Hardly played.' },
];
