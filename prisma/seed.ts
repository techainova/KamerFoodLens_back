import { CourseLevel, PrismaClient, RecipeDifficulty, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface RecipeSeedData {
  slug: string;
  name: string;
  nameEN: string;
  region: string;
  description: string;
  ingredients: string[];
  tags: string[];
  durationMin: number;
  spiceLevel: number;
  accompagnements: string[];
}

const RECIPE_SEED_DATA: RecipeSeedData[] = [
  {
    slug: 'ekwang',
    name: 'Ekwang',
    nameEN: 'Ekwang',
    region: 'Sud-Ouest, Cameroun',
    description:
      "Plat à base de cocoyam (taro) râpé et enroulé dans des feuilles de cocoyam, mijoté longuement dans une sauce à l'huile de palme avec poisson fumé ou viande.",
    ingredients: ['cocoyam râpé', 'taro', 'feuilles de cocoyam', 'huile de palme', 'poisson fumé', 'piment', 'crevettes séchées'],
    tags: ['ekwang', 'cocoyam roll'],
    durationMin: 150,
    spiceLevel: 2,
    accompagnements: ['aucun (plat complet)'],
  },
  {
    slug: 'eru',
    name: 'Eru',
    nameEN: 'Eru',
    region: 'Sud-Ouest, Cameroun',
    description:
      "Ragoût de feuilles d'eru (okok) finement émincées, cuites avec des feuilles de waterleaf, de l'huile de palme, du poisson fumé et de la viande, traditionnellement servi avec du fufu de manioc ou du garri.",
    ingredients: ["feuilles d'eru", 'okok', 'waterleaf', 'huile de palme', 'poisson fumé', 'viande de bœuf', 'crevettes séchées'],
    tags: ['eru', 'okok', 'feuilles eru'],
    durationMin: 75,
    spiceLevel: 2,
    accompagnements: ['fufu de manioc', 'garri', 'miondo'],
  },
  {
    slug: 'jollof-ghana',
    name: 'Riz Jollof (Ghana)',
    nameEN: 'Ghanaian Jollof Rice',
    region: "Ghana, Afrique de l'Ouest",
    description:
      'Riz cuit dans une sauce tomate et poivron épicée, parfumée aux épices ouest-africaines, souvent accompagné de poulet, de bœuf ou de poisson grillé.',
    ingredients: ['riz long grain', 'tomates', 'poivron rouge', 'oignon', 'piment scotch bonnet', 'épices jollof', 'bouillon'],
    tags: ['jollof', 'riz jollof', 'jolof rice'],
    durationMin: 60,
    spiceLevel: 3,
    accompagnements: ['poulet grillé', 'salade', 'plantain frit'],
  },
  {
    slug: 'ndole',
    name: 'Ndolé',
    nameEN: 'Ndole',
    region: 'Littoral, Cameroun',
    description: 'Plat mijoté à base de feuilles de ndolé amères, pâte d\'arachide et poisson fumé ou viande.',
    ingredients: ['feuilles de ndolé', "pâte d'arachide", 'arachide', 'poisson fumé', 'crevettes séchées', 'huile de palme'],
    tags: ['ndole', 'ndolé', 'bitter leaf stew'],
    durationMin: 90,
    spiceLevel: 2,
    accompagnements: ['plantain', 'riz', 'miondo'],
  },
  {
    slug: 'palm-nut-soup',
    name: 'Soupe de noix de palme',
    nameEN: 'Palm Nut Soup',
    region: "Afrique Centrale et de l'Ouest",
    description:
      'Soupe onctueuse préparée à partir d\'extrait de noix de palme, mijotée avec viande, poisson fumé et épices, servie en plat principal avec un féculent.',
    ingredients: ['extrait de noix de palme', 'noix de palme', 'palmiste', 'poisson fumé', 'viande de bœuf', 'piment', 'gingembre', 'épices'],
    tags: ['soupe palme', 'banga', 'palm nut', 'soupe de palme'],
    durationMin: 100,
    spiceLevel: 2,
    accompagnements: ['fufu', 'riz', 'banku'],
  },
  {
    slug: 'waakye',
    name: 'Waakye',
    nameEN: 'Waakye',
    region: "Ghana, Afrique de l'Ouest",
    description:
      'Riz et haricots cuits ensemble avec des feuilles de sorgho (ou bicarbonate) qui leur donnent une teinte rouge-brun caractéristique, servi avec garri, spaghetti, œuf et sauce shito.',
    ingredients: ['riz', 'haricots noirs', 'haricots', 'feuilles de sorgho', 'garri', 'sauce shito', 'œuf'],
    tags: ['waakye', 'waakie'],
    durationMin: 80,
    spiceLevel: 2,
    accompagnements: ['garri', 'spaghetti', 'œuf bouilli', 'avocat'],
  },
  {
    slug: 'poulet-dg',
    name: 'Poulet DG',
    nameEN: 'Chicken DG',
    region: 'Centre, Cameroun',
    description:
      'Poulet frit puis sauté avec des plantains mûrs frits, des légumes et des épices, un plat emblématique des restaurants camerounais haut de gamme.',
    ingredients: ['poulet', 'plantain mûr', 'plantain frit', 'tomate', 'oignon', 'poivron', 'ail', 'gingembre', 'épices'],
    tags: ['poulet dg', 'directeur général', 'chicken dg', 'dg'],
    durationMin: 60,
    spiceLevel: 2,
    accompagnements: ['riz blanc', 'plantain'],
  },
  {
    slug: 'koki',
    name: 'Koki',
    nameEN: 'Koki Beans Cake',
    region: 'Ouest, Cameroun',
    description:
      "Galette de haricots noirs pilés et épicés, mélangés à l'huile de palme et aux épices, puis cuits enveloppés dans des feuilles de bananier.",
    ingredients: ['haricots noirs', 'haricots', 'huile de palme', 'piment', 'oignon', 'feuilles de bananier'],
    tags: ['koki', 'koki beans', 'gâteau de haricots'],
    durationMin: 90,
    spiceLevel: 2,
    accompagnements: ['miondo', 'riz'],
  },
  {
    slug: 'miondo',
    name: 'Miondo',
    nameEN: 'Miondo',
    region: 'Littoral, Cameroun',
    description:
      'Bâtonnets de manioc fermenté et cuit à la vapeur dans des feuilles de bananier, accompagnement traditionnel de nombreux plats camerounais.',
    ingredients: ['manioc fermenté', 'manioc', 'feuilles de bananier'],
    tags: ['miondo', 'bâton de manioc', 'kwacoco', 'bobolo'],
    durationMin: 60,
    spiceLevel: 0,
    accompagnements: ['ndolé', 'eru', 'poisson braisé'],
  },
  {
    slug: 'braise',
    name: 'Poisson braisé',
    nameEN: 'Grilled Fish',
    region: 'Cameroun',
    description:
      'Poisson entier mariné avec des épices camerounaises et grillé au charbon, servi avec du plantain frit ou du miondo.',
    ingredients: ['poisson', 'tilapia', 'capitaine', 'épices', 'piment', 'ail', 'gingembre', 'oignon'],
    tags: ['poisson braisé', 'braisé', 'grilled fish'],
    durationMin: 45,
    spiceLevel: 3,
    accompagnements: ['plantain frit', 'miondo', 'salade'],
  },
  {
    slug: 'mbongo',
    name: 'Mbongo Tchobi',
    nameEN: 'Black Pepper Stew',
    region: 'Littoral, Cameroun',
    description:
      'Ragoût sombre et épicé à base d\'écorce carbonisée de mbongo (prunus africana) qui lui donne sa couleur noire caractéristique, mijoté avec du poisson ou de la viande.',
    ingredients: ['écorce de mbongo', 'mbongo', 'poisson', 'viande', 'piment', 'épices noires', 'gingembre'],
    tags: ['mbongo', 'mbongo tchobi', 'ragoût noir'],
    durationMin: 120,
    spiceLevel: 4,
    accompagnements: ['miondo', 'plantain', 'riz'],
  },
  {
    slug: 'okok',
    name: 'Okok au Pistache',
    nameEN: 'Okok with Groundnut',
    region: 'Centre, Cameroun',
    description:
      'Feuilles d\'okok (gnetum africanum) cuites avec de la pâte de pistache (graines de courge), de la viande fumée et des épices.',
    ingredients: ["feuilles d'okok", 'pistache', 'pâte de pistache', 'graines de courge', 'viande fumée', 'crevettes'],
    tags: ['okok', 'okok pistache', 'feuilles okok', 'pistache'],
    durationMin: 90,
    spiceLevel: 2,
    accompagnements: ['miondo', 'plantain'],
  },
];

function difficultyFromDuration(durationMin: number): RecipeDifficulty {
  if (durationMin <= 60) {
    return RecipeDifficulty.easy;
  }
  if (durationMin <= 100) {
    return RecipeDifficulty.medium;
  }
  return RecipeDifficulty.hard;
}

async function seedRecipes(): Promise<void> {
  const existingCount = await prisma.recipe.count();
  if (existingCount > 0) {
    return;
  }

  for (const dish of RECIPE_SEED_DATA) {
    await prisma.recipe.create({
      data: {
        slug: dish.slug,
        name: dish.name,
        nameEN: dish.nameEN,
        region: dish.region,
        description: dish.description,
        duration: dish.durationMin,
        servings: 4,
        difficulty: difficultyFromDuration(dish.durationMin),
        rating: 4.5,
        ratingCount: 0,
        spiceLevel: dish.spiceLevel,
        cookType: 'Traditionnel',
        tags: dish.tags,
        ingredients: {
          create: dish.ingredients.map((name, index) => ({
            name,
            quantity: 'Selon goût',
            order: index,
          })),
        },
        steps: {
          create: [
            {
              order: 1,
              title: 'Préparation',
              description: dish.description,
            },
            {
              order: 2,
              title: 'Service',
              description: `Servir avec : ${dish.accompagnements.join(', ')}.`,
            },
          ],
        },
      },
    });
  }
}

async function seedBadges(): Promise<void> {
  const badges = [
    {
      name: 'Premier Scan',
      nameEN: 'First Scan',
      description: 'A effectué son premier scan de plat',
      descriptionEN: 'Performed their first dish scan',
      icon: 'Camera',
      color: '#F5A623',
      category: 'scan',
      xpReward: 10,
    },
    {
      name: 'Explorateur Culinaire',
      nameEN: 'Culinary Explorer',
      description: 'A scanné 10 plats différents',
      descriptionEN: 'Scanned 10 different dishes',
      icon: 'Globe',
      color: '#4A90D9',
      category: 'scan',
      xpReward: 50,
    },
    {
      name: 'Critique Gastronomique',
      nameEN: 'Food Critic',
      description: 'A laissé 5 avis sur des restaurants',
      descriptionEN: 'Left 5 restaurant reviews',
      icon: 'Star',
      color: '#D0021B',
      category: 'community',
      xpReward: 30,
    },
    {
      name: 'Quiz Master',
      nameEN: 'Quiz Master',
      description: 'A obtenu un score parfait à un quiz',
      descriptionEN: 'Scored perfectly on a quiz',
      icon: 'Trophy',
      color: '#7ED321',
      category: 'games',
      xpReward: 40,
    },
    {
      name: 'Client Fidèle',
      nameEN: 'Loyal Customer',
      description: 'A passé 10 commandes',
      descriptionEN: 'Placed 10 orders',
      icon: 'Heart',
      color: '#BD10E0',
      category: 'orders',
      xpReward: 60,
    },
    {
      name: 'Chef en Herbe',
      nameEN: 'Aspiring Chef',
      description: 'A terminé un cours de cuisine',
      descriptionEN: 'Completed a cooking course',
      icon: 'GraduationCap',
      color: '#F8E71C',
      category: 'courses',
      xpReward: 80,
    },
  ];

  for (const badge of badges) {
    const existing = await prisma.badge.findFirst({ where: { name: badge.name } });
    if (!existing) {
      await prisma.badge.create({ data: badge });
    }
  }
}

async function seedQuizQuestions(): Promise<void> {
  const questions = [
    {
      question: 'Quel est l\'ingrédient principal du Ndolé ?',
      options: ['Feuilles de ndolé', 'Manioc', 'Plantain', 'Riz'],
      correctIndex: 0,
      category: 'plats_traditionnels',
      difficulty: 'easy',
    },
    {
      question: 'D\'où provient le Poulet DG ?',
      options: ['Nigeria', 'Cameroun', 'Sénégal', 'Côte d\'Ivoire'],
      correctIndex: 1,
      category: 'origine',
      difficulty: 'easy',
    },
    {
      question: 'Quel poisson est traditionnellement utilisé dans le Koki ?',
      options: ['Aucun, c\'est un plat végétal', 'Machoiron', 'Thon', 'Tilapia'],
      correctIndex: 0,
      category: 'plats_traditionnels',
      difficulty: 'medium',
    },
    {
      question: 'Le Eru est principalement composé de quelles feuilles ?',
      options: ['Feuilles de manioc', 'Feuilles de eru et waterleaf', 'Feuilles de patate', 'Épinards'],
      correctIndex: 1,
      category: 'plats_traditionnels',
      difficulty: 'medium',
    },
    {
      question: 'Quelle région camerounaise est réputée pour le Achu ?',
      options: ['Littoral', 'Nord-Ouest', 'Est', 'Adamaoua'],
      correctIndex: 1,
      category: 'origine',
      difficulty: 'hard',
    },
    {
      question: 'Quel est l\'accompagnement classique du Ndolé ?',
      options: ['Riz blanc', 'Plantain, miondo ou baton de manioc', 'Frites', 'Pain'],
      correctIndex: 1,
      category: 'plats_traditionnels',
      difficulty: 'easy',
    },
    {
      question: 'Le Bobolo est fabriqué à partir de quel tubercule ?',
      options: ['Igname', 'Manioc', 'Patate douce', 'Taro'],
      correctIndex: 1,
      category: 'plats_traditionnels',
      difficulty: 'easy',
    },
    {
      question: 'Quelle boisson locale accompagne souvent les grillades au Cameroun ?',
      options: ['Vin de palme', 'Coca-Cola uniquement', 'Lait', 'Jus d\'orange'],
      correctIndex: 0,
      category: 'boissons',
      difficulty: 'medium',
    },
  ];

  const existingCount = await prisma.quizQuestion.count();
  if (existingCount === 0) {
    await prisma.quizQuestion.createMany({ data: questions });
  }
}

async function seedSystemSettings(): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      maintenanceMode: false,
      registrationsOpen: true,
      aiEnabled: true,
      commissionPct: 10,
    },
  });
}

interface MenuItemSeedData {
  name: string;
  description: string;
  priceXAF: number;
  category: string;
  imageUrl?: string;
}

interface RestaurantSeedData {
  name: string;
  cuisineType: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  priceRange: number;
  specialties: string[];
  hoursLabel: string;
  isVerified: boolean;
  avatar: string;
  coverUrl: string;
  menu: MenuItemSeedData[];
}

const RESTAURANT_SEED_DATA: RestaurantSeedData[] = [
  {
    name: 'Chez Mama Pauline',
    cuisineType: 'Restaurant camerounais',
    address: 'Rue Njo-Njo, Bonapriso',
    city: 'Douala',
    lat: 4.0511,
    lng: 9.7679,
    priceRange: 2,
    specialties: ['Ndolé', 'Poulet DG'],
    hoursLabel: '11h–22h',
    isVerified: true,
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Ndol%C3%A8_%C3%A0_la_viande%2C_morue_et_crevettes.jpg',
    coverUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Fish_restaurant_in_Douala.jpg',
    menu: [
      { name: 'Ndolé traditionnel', description: "Poisson fumé, crevettes, pâte d'arachide", priceXAF: 4500, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Ndol%C3%A8_%C3%A0_la_viande%2C_morue_et_crevettes.jpg' },
      { name: 'Poulet DG', description: 'Plantains frits, légumes sautés', priceXAF: 5500, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Poulet_GD_%28fried_chicken_with_ripe_plantains_and_mixed_vegetables%29.jpg' },
      { name: 'Eru & Fufu', description: 'Eru frais, waterleaf, viande fumée', priceXAF: 4000, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Water_fufu_and_Eru.jpg' },
      { name: 'Koki haricots', description: 'Gâteau de haricots à la feuille de bananier', priceXAF: 2500, category: 'Entrées', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Le_koki_3.jpg' },
      { name: 'Miondo (x3)', description: 'Bâton de manioc cuit vapeur', priceXAF: 1500, category: 'Accompagnements', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Batons_de_Manioc_et_Miondo.jpg' },
      { name: 'Jus de gingembre', description: 'Frais & naturel', priceXAF: 1000, category: 'Boissons', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ginger_%2C_zobo_and_tiger_nuts_drink.jpg' },
      { name: 'Jus de bissap', description: 'Hibiscus rouge, citronné', priceXAF: 800, category: 'Boissons', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Sobolo.jpg' },
      { name: 'Eau minérale', description: 'Source Boa', priceXAF: 500, category: 'Boissons' },
    ],
  },
  {
    name: "Restaurant L'Authenticité",
    cuisineType: 'Cuisine du Littoral',
    address: 'Avenue de la Liberté, Akwa',
    city: 'Douala',
    lat: 4.0465,
    lng: 9.7735,
    priceRange: 3,
    specialties: ['Mbongo tchobi', 'Eru'],
    hoursLabel: '10h–21h',
    isVerified: true,
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Mbongo_Tchobi_%28sauce_noir%29.jpg',
    coverUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/57/CAM-Douala-Resto_viandes.jpg',
    menu: [
      { name: 'Poulet DG', description: 'La spécialité maison', priceXAF: 5500, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Poulet_GD_%28fried_chicken_with_ripe_plantains_and_mixed_vegetables%29.jpg' },
      { name: 'Mbongo Tchobi', description: 'Poisson, sauce noire épicée', priceXAF: 4800, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Mbongo_Tchobi_%28sauce_noir%29.jpg' },
      { name: 'Okok au Pistache', description: 'Feuilles okok, pâte de pistache', priceXAF: 4200, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Okok_and_kassava.jpg' },
      { name: 'Poisson braisé', description: 'Tilapia entier, épices maison', priceXAF: 5000, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Grilled_Tilapia_001.jpg' },
      { name: 'Plantain frit (x4)', description: 'Croquant, doré à la perfection', priceXAF: 1200, category: 'Accompagnements', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Fried_Plantain%2C_Moimoi_and_cabbage.jpg' },
      { name: 'Eau minérale', description: 'Source Boa', priceXAF: 500, category: 'Boissons' },
    ],
  },
  {
    name: 'Kmer Saveurs',
    cuisineType: 'Street food camerounaise',
    address: 'Marché Central',
    city: 'Douala',
    lat: 4.0552,
    lng: 9.7601,
    priceRange: 1,
    specialties: ['Soya', 'Koki'],
    hoursLabel: '12h–20h',
    isVerified: false,
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Suya_preparation_for_grilling_5.jpg',
    coverUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Braiseuse_de_brochettes_de_poulet.jpg',
    menu: [
      { name: 'Eru & Fufu', description: 'Classique du Sud-Ouest', priceXAF: 4000, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Fufu_and_Eru.jpg' },
      { name: 'Beignets haricots', description: '6 pièces, sauce tomate pimentée', priceXAF: 1500, category: 'Entrées', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Fried_Bean_cake.jpg' },
      { name: 'Soya (brochettes)', description: 'Bœuf mariné, piment et épices', priceXAF: 2500, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Suya_preparation_for_grilling_5.jpg' },
      { name: 'Ndolé', description: 'Version familiale simplifiée', priceXAF: 3500, category: 'Plats', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ndole_and_Ripe_Plantains.jpg' },
      { name: 'Miondo (x3)', description: 'Bâton de manioc cuit vapeur', priceXAF: 1000, category: 'Accompagnements', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/B%C3%A2tons_de_manioc_preparation_%281%29.JPG' },
      { name: 'Jus de canne', description: 'Frais pressé sur place', priceXAF: 700, category: 'Boissons', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Sugar_cane_juice_glass.jpg' },
    ],
  },
];

async function seedRestaurants(): Promise<void> {
  const existingCount = await prisma.restaurant.count();
  if (existingCount > 0) {
    return;
  }

  const ownerEmail = 'restaurants-seed@kmerfoodlens.com';
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      passwordHash,
      firstName: 'KFL',
      lastName: 'Restaurants',
      role: Role.pro,
      isEmailVerified: true,
    },
  });

  for (const restaurant of RESTAURANT_SEED_DATA) {
    await prisma.restaurant.create({
      data: {
        ownerId: owner.id,
        name: restaurant.name,
        cuisineType: restaurant.cuisineType,
        address: restaurant.address,
        city: restaurant.city,
        lat: restaurant.lat,
        lng: restaurant.lng,
        priceRange: restaurant.priceRange,
        specialties: restaurant.specialties,
        hoursLabel: restaurant.hoursLabel,
        isVerified: restaurant.isVerified,
        avatar: restaurant.avatar,
        coverUrl: restaurant.coverUrl,
        isOpen: true,
        isActive: true,
        menuItems: {
          create: restaurant.menu.map((item) => ({
            name: item.name,
            description: item.description,
            priceXAF: item.priceXAF,
            category: item.category,
            imageUrl: item.imageUrl,
          })),
        },
      },
    });
  }
}

interface EventSeedData {
  title: string;
  category: string;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
  city: string;
  priceXAF: number;
  maxSeats: number;
  tags: string[];
  organizerEmail: string;
  organizerBusinessName: string;
}

const EVENT_SEED_DATA: EventSeedData[] = [
  {
    title: 'Festival des Saveurs du Cameroun 2026',
    category: 'Festival',
    description:
      "Le plus grand rassemblement culinaire camerounais de l'année ! Découvrez les spécialités de toutes les régions : Ndolé du Littoral, Eru du Sud-Ouest, Kossam du Nord... Plus de 50 stands, des démonstrations de chefs, et des animations tout le weekend.",
    startAt: '2026-08-01T09:00:00.000Z',
    endAt: '2026-08-01T18:00:00.000Z',
    location: 'Palais des Congrès de Yaoundé',
    city: 'Yaoundé',
    priceXAF: 2000,
    maxSeats: 5000,
    tags: ['Festival', 'Toutes régions', 'Famille'],
    organizerEmail: 'events-seed-1@kmerfoodlens.com',
    organizerBusinessName: 'Association Culinaire Camerounaise',
  },
  {
    title: 'Atelier : Maîtriser le Ndolé en 3h',
    category: 'Atelier',
    description:
      "Chef Joël Kamga vous guide pas à pas dans la préparation d'un Ndolé traditionnel. De la désamerisation des feuilles à la cuisson des crevettes, vous repartez avec la technique complète. Ingrédients et tablier fournis.",
    startAt: '2026-07-26T08:00:00.000Z',
    endAt: '2026-07-26T11:00:00.000Z',
    location: 'Studio Culinaire KFL',
    city: 'Douala',
    priceXAF: 15000,
    maxSeats: 12,
    tags: ['Atelier', 'Ndolé', 'Débutants OK'],
    organizerEmail: 'events-seed-2@kmerfoodlens.com',
    organizerBusinessName: 'Chef Joël Kamga',
  },
  {
    title: 'Dégustation : Vins & Cuisine Camerounaise',
    category: 'Dégustation',
    description:
      "Une soirée inédite autour des accords mets & vins entre la gastronomie camerounaise et des vins sélectionnés. 5 plats, 5 vins, 5 histoires. Places très limitées — réservation obligatoire.",
    startAt: '2026-07-30T18:30:00.000Z',
    endAt: '2026-07-30T22:00:00.000Z',
    location: "Restaurant L'Authenticité",
    city: 'Douala',
    priceXAF: 35000,
    maxSeats: 20,
    tags: ['Dégustation', 'Vins', 'Soirée', 'Adultes'],
    organizerEmail: 'events-seed-3@kmerfoodlens.com',
    organizerBusinessName: "Restaurant L'Authenticité",
  },
  {
    title: 'Concours : Meilleur Poulet DG de Douala',
    category: 'Concours',
    description:
      "Vous croyez faire le meilleur Poulet DG de la ville ? Prouvez-le ! Inscription gratuite, jury composé de 5 chefs professionnels. Le gagnant remporte 500 000 FCFA et une mise en avant sur KFL pendant 3 mois.",
    startAt: '2026-08-15T13:00:00.000Z',
    endAt: '2026-08-15T18:00:00.000Z',
    location: 'Centre Culturel Français',
    city: 'Douala',
    priceXAF: 0,
    maxSeats: 30,
    tags: ['Concours', 'Poulet DG', 'Prix en argent'],
    organizerEmail: 'events-seed-4@kmerfoodlens.com',
    organizerBusinessName: 'KmerFoodLens & Mairie de Douala',
  },
  {
    title: 'Conférence : Nutrition et Plats Traditionnels',
    category: 'Conférence',
    description:
      "Dr. Amina Essomba, nutritionniste, présente ses recherches sur les apports nutritionnels des plats camerounais. Une perspective scientifique sur notre héritage culinaire et comment l'adapter aux enjeux de santé modernes.",
    startAt: '2026-08-22T15:00:00.000Z',
    endAt: '2026-08-22T17:00:00.000Z',
    location: 'Université de Yaoundé I',
    city: 'Yaoundé',
    priceXAF: 0,
    maxSeats: 200,
    tags: ['Conférence', 'Nutrition', 'Gratuit'],
    organizerEmail: 'events-seed-5@kmerfoodlens.com',
    organizerBusinessName: 'Dr. Amina Essomba',
  },
];

async function seedEvents(): Promise<void> {
  const existingCount = await prisma.event.count();
  if (existingCount > 0) {
    return;
  }

  for (const eventData of EVENT_SEED_DATA) {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
    const [firstName, ...rest] = eventData.organizerBusinessName.split(' ');
    const organizer = await prisma.user.upsert({
      where: { email: eventData.organizerEmail },
      update: {},
      create: {
        email: eventData.organizerEmail,
        passwordHash,
        firstName,
        lastName: rest.join(' ') || firstName,
        role: Role.pro,
        isEmailVerified: true,
      },
    });

    await prisma.proProfile.upsert({
      where: { userId: organizer.id },
      update: {},
      create: { userId: organizer.id, businessName: eventData.organizerBusinessName },
    });

    await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: eventData.title,
        category: eventData.category,
        description: eventData.description,
        location: eventData.location,
        city: eventData.city,
        tags: eventData.tags,
        startAt: new Date(eventData.startAt),
        endAt: new Date(eventData.endAt),
        priceXAF: eventData.priceXAF,
        maxSeats: eventData.maxSeats,
      },
    });
  }
}

interface CourseLessonSeedData {
  title: string;
  sectionTitle: string;
  durationSec: number;
}

interface CourseSeedData {
  title: string;
  description: string;
  level: CourseLevel;
  priceXAF: number;
  isCertified: boolean;
  instructorEmail: string;
  instructorBusinessName: string;
  lessons: CourseLessonSeedData[];
}

const COURSE_SEED_DATA: CourseSeedData[] = [
  {
    title: 'Maîtriser le Ndolé en 7 étapes',
    description:
      "Un cours complet pour maîtriser le plat national camerounais, de la désamertume des feuilles à la cuisson lente traditionnelle.",
    level: CourseLevel.intermediate,
    priceXAF: 0,
    isCertified: false,
    instructorEmail: 'courses-seed-1@kmerfoodlens.com',
    instructorBusinessName: 'Chef Amina Foning',
    lessons: [
      { title: 'Présentation du cours et de la recette', sectionTitle: 'Introduction', durationSec: 720 },
      { title: 'Histoire et origine du Ndolé', sectionTitle: 'Introduction', durationSec: 600 },
      { title: 'Désamertumer les feuilles de ndolé', sectionTitle: 'Préparation', durationSec: 1080 },
      { title: "Préparer la pâte d'arachide", sectionTitle: 'Préparation', durationSec: 900 },
      { title: 'La cuisson lente traditionnelle', sectionTitle: 'Cuisson', durationSec: 1500 },
      { title: 'Dressage et accompagnements', sectionTitle: 'Cuisson', durationSec: 660 },
    ],
  },
  {
    title: 'Les sauces camerounaises',
    description:
      "Découvrez les sauces emblématiques de la cuisine camerounaise : bases, épices et techniques de liaison propres à chaque région.",
    level: CourseLevel.beginner,
    priceXAF: 15000,
    isCertified: false,
    instructorEmail: 'courses-seed-2@kmerfoodlens.com',
    instructorBusinessName: 'Chef Joël Eyenga',
    lessons: [
      { title: 'Les bases des sauces camerounaises', sectionTitle: 'Introduction', durationSec: 660 },
      { title: 'Sauce arachide', sectionTitle: 'Les sauces', durationSec: 1200 },
      { title: 'Sauce jaune', sectionTitle: 'Les sauces', durationSec: 1080 },
      { title: 'Sauce noire (Mbongo)', sectionTitle: 'Les sauces', durationSec: 1500 },
      { title: 'Conservation et remise en température', sectionTitle: 'Finitions', durationSec: 480 },
    ],
  },
  {
    title: 'Maîtriser le Mbongo Tchobi',
    description:
      "Maîtrisez l'art du Mbongo Tchobi — le plat signature du Littoral camerounais. De la sélection des épices à la cuisson lente, apprenez chaque étape avec une cheffe certifiée.",
    level: CourseLevel.advanced,
    priceXAF: 25000,
    isCertified: true,
    instructorEmail: 'courses-seed-3@kmerfoodlens.com',
    instructorBusinessName: 'Cheffe Sandrine Mballa',
    lessons: [
      { title: 'Présentation du cours et de la cheffe', sectionTitle: 'Introduction', durationSec: 720 },
      { title: 'Histoire et origine du Mbongo Tchobi', sectionTitle: 'Introduction', durationSec: 1080 },
      { title: "Identifier le njansang et l'écorce HK", sectionTitle: 'Les Épices & Ingrédients', durationSec: 1500 },
      { title: 'Torréfaction et broyage des épices', sectionTitle: 'Les Épices & Ingrédients', durationSec: 1800 },
      { title: 'Choix du poisson : capitaine vs carpe', sectionTitle: 'Les Épices & Ingrédients', durationSec: 1200 },
      { title: 'Préparation de la base — oignon et tomate', sectionTitle: 'La Sauce Noire', durationSec: 1320 },
      { title: "Incorporation des épices — timing et ordre", sectionTitle: 'La Sauce Noire', durationSec: 1680 },
      { title: 'La coloration noire — secret et technique', sectionTitle: 'La Sauce Noire', durationSec: 2100 },
      { title: 'Cuisson longue à feu doux', sectionTitle: 'Cuisson & Finitions', durationSec: 2400 },
      { title: 'Dressage et présentation', sectionTitle: 'Cuisson & Finitions', durationSec: 1320 },
    ],
  },
];

async function seedCourses(): Promise<void> {
  const existingCount = await prisma.course.count();
  if (existingCount > 0) {
    return;
  }

  for (const courseData of COURSE_SEED_DATA) {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
    const [firstName, ...rest] = courseData.instructorBusinessName.split(' ');
    const instructor = await prisma.user.upsert({
      where: { email: courseData.instructorEmail },
      update: {},
      create: {
        email: courseData.instructorEmail,
        passwordHash,
        firstName,
        lastName: rest.join(' ') || firstName,
        role: Role.pro,
        isEmailVerified: true,
        bio: `${courseData.instructorBusinessName} — chef certifié, spécialiste de la cuisine camerounaise.`,
      },
    });

    await prisma.proProfile.upsert({
      where: { userId: instructor.id },
      update: {},
      create: { userId: instructor.id, businessName: courseData.instructorBusinessName },
    });

    await prisma.course.create({
      data: {
        instructorId: instructor.id,
        title: courseData.title,
        description: courseData.description,
        priceXAF: courseData.priceXAF,
        level: courseData.level,
        isCertified: courseData.isCertified,
        lessons: {
          create: courseData.lessons.map((lesson, index) => ({
            title: lesson.title,
            duration: lesson.durationSec,
            order: index + 1,
            sectionTitle: lesson.sectionTitle,
          })),
        },
      },
    });
  }
}

async function seedTombola(): Promise<void> {
  const existingCount = await prisma.tombola.count();
  if (existingCount > 0) {
    return;
  }

  await prisma.tombola.create({
    data: {
      title: 'Grande Tombola KFL — Juillet 2026',
      drawAt: new Date('2026-08-02T18:00:00.000Z'),
      pricePerTicketXAF: 1000,
      maxTickets: 1000,
      isActive: true,
      prizes: [
        { rank: 1, label: '1er Prix', description: 'Voyage gastronomique au Cameroun', value: '500 000 FCFA', icon: '✈️' },
        { rank: 2, label: '2ème Prix', description: 'Abonnement Pro KFL 1 an + bon resto', value: '100 000 FCFA', icon: '⭐' },
        { rank: 3, label: '3ème Prix', description: "Bon d'achat restaurant partenaire", value: '50 000 FCFA', icon: '🍽️' },
        { rank: 4, label: 'Prix spéciaux (x5)', description: 'Kit épices camerounaises', value: '10 000 FCFA', icon: '🌶️' },
      ],
    },
  });
}

async function main(): Promise<void> {
  await seedBadges();
  await seedQuizQuestions();
  await seedSystemSettings();
  await seedRecipes();
  await seedRestaurants();
  await seedEvents();
  await seedCourses();
  await seedTombola();
  // eslint-disable-next-line no-console
  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
