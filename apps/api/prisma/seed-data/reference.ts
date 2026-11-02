/**
 * Reference data. Coordinates are approximate area centres, good enough for radius search but
 * not surveyed; correct them from Admin > Locations. Every entry can be edited or deactivated
 * there, including the DIU campus, so nothing here is hard-wired into the application.
 */
type LocationSeed = {
  slug: string;
  name: string;
  type: 'COUNTRY' | 'DIVISION' | 'DISTRICT' | 'CITY' | 'AREA' | 'CAMPUS' | 'COMMUNITY';
  parent?: string;
  lat: number;
  lng: number;
  featured?: boolean;
};

export const LOCATIONS: LocationSeed[] = [
  { slug: 'bangladesh', name: 'Bangladesh', type: 'COUNTRY', lat: 23.685, lng: 90.3563 },
  { slug: 'dhaka-division', name: 'Dhaka Division', type: 'DIVISION', parent: 'bangladesh', lat: 23.9, lng: 90.3 },
  { slug: 'chattogram-division', name: 'Chattogram Division', type: 'DIVISION', parent: 'bangladesh', lat: 22.7, lng: 91.8 },
  { slug: 'sylhet-division', name: 'Sylhet Division', type: 'DIVISION', parent: 'bangladesh', lat: 24.7, lng: 91.7 },
  { slug: 'dhaka-district', name: 'Dhaka District', type: 'DISTRICT', parent: 'dhaka-division', lat: 23.8103, lng: 90.4125 },
  { slug: 'gazipur-district', name: 'Gazipur District', type: 'DISTRICT', parent: 'dhaka-division', lat: 24.0023, lng: 90.4264 },
  { slug: 'chattogram-district', name: 'Chattogram District', type: 'DISTRICT', parent: 'chattogram-division', lat: 22.3569, lng: 91.7832 },
  { slug: 'sylhet-district', name: 'Sylhet District', type: 'DISTRICT', parent: 'sylhet-division', lat: 24.8949, lng: 91.8687 },
  { slug: 'dhaka', name: 'Dhaka', type: 'CITY', parent: 'dhaka-district', lat: 23.8103, lng: 90.4125 },
  { slug: 'savar', name: 'Savar', type: 'CITY', parent: 'dhaka-district', lat: 23.8583, lng: 90.2667 },
  { slug: 'gazipur', name: 'Gazipur', type: 'CITY', parent: 'gazipur-district', lat: 24.0023, lng: 90.4264 },
  { slug: 'chattogram', name: 'Chattogram', type: 'CITY', parent: 'chattogram-district', lat: 22.3569, lng: 91.7832 },
  { slug: 'sylhet', name: 'Sylhet', type: 'CITY', parent: 'sylhet-district', lat: 24.8949, lng: 91.8687 },
  { slug: 'ashulia', name: 'Ashulia', type: 'AREA', parent: 'savar', lat: 23.8896, lng: 90.3211 },
  { slug: 'birulia', name: 'Birulia', type: 'AREA', parent: 'savar', lat: 23.8561, lng: 90.3389 },
  { slug: 'khagan', name: 'Khagan', type: 'AREA', parent: 'savar', lat: 23.8735, lng: 90.3145 },
  { slug: 'savar-bazar', name: 'Savar Bazar', type: 'AREA', parent: 'savar', lat: 23.8473, lng: 90.2575 },
  { slug: 'uttara', name: 'Uttara', type: 'AREA', parent: 'dhaka', lat: 23.8759, lng: 90.3795 },
  { slug: 'mirpur', name: 'Mirpur', type: 'AREA', parent: 'dhaka', lat: 23.8223, lng: 90.3654 },
  { slug: 'mohammadpur', name: 'Mohammadpur', type: 'AREA', parent: 'dhaka', lat: 23.7662, lng: 90.3589 },
  { slug: 'dhanmondi', name: 'Dhanmondi', type: 'AREA', parent: 'dhaka', lat: 23.7465, lng: 90.376 },
  { slug: 'banani', name: 'Banani', type: 'AREA', parent: 'dhaka', lat: 23.7937, lng: 90.4066 },
  { slug: 'gulshan', name: 'Gulshan', type: 'AREA', parent: 'dhaka', lat: 23.7925, lng: 90.4078 },
  { slug: 'bashundhara', name: 'Bashundhara', type: 'AREA', parent: 'dhaka', lat: 23.8193, lng: 90.4526 },
  { slug: 'daffodil-smart-city', name: 'Daffodil Smart City', type: 'CAMPUS', parent: 'ashulia', lat: 23.8769, lng: 90.3206, featured: true },
  { slug: 'diu-community', name: 'DIU community', type: 'COMMUNITY', lat: 23.8769, lng: 90.3206, featured: true },
];

export const CATEGORIES: { slug: string; name: string; icon: string; children: [string, string][] }[] = [
  { slug: 'electronics', name: 'Electronics', icon: 'laptop', children: [['laptops', 'Laptops'], ['phones', 'Phones and tablets'], ['audio', 'Headphones and audio'], ['accessories', 'Computer accessories']] },
  { slug: 'textbooks', name: 'Books and notes', icon: 'book-open', children: [['course-books', 'Course books'], ['fiction', 'Fiction and general']] },
  { slug: 'furniture', name: 'Furniture', icon: 'armchair', children: [['desks-chairs', 'Desks and chairs'], ['beds-storage', 'Beds and storage']] },
  { slug: 'home', name: 'Home and kitchen', icon: 'cooking-pot', children: [['kitchen', 'Kitchen'], ['appliances', 'Appliances']] },
  { slug: 'fashion', name: 'Clothing and shoes', icon: 'shirt', children: [['clothing', 'Clothing'], ['shoes-bags', 'Shoes and bags']] },
  { slug: 'vehicles', name: 'Bikes and vehicles', icon: 'bike', children: [['bicycles', 'Bicycles'], ['motorbikes', 'Motorbikes']] },
  { slug: 'sports', name: 'Sports and hobbies', icon: 'dumbbell', children: [['sports-gear', 'Sports gear'], ['instruments', 'Musical instruments']] },
];

export const PROHIBITED_KEYWORDS = [
  'gun', 'pistol', 'firearm', 'ammunition', 'yaba', 'heroin', 'cocaine', 'phensedyl',
  'counterfeit', 'fake id', 'fake nid', 'exam paper leak', 'stolen',
];
