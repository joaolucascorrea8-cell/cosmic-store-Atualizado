export type Product = {
  id: string;
  name: string;
  game: string;
  category: string;
  price: number;
  image: string;
  description: string;
  available: boolean;
};

export const products: Product[] = [
  {
    id: "dragon-permanente",
    name: "Dragon",
    game: "Blox Fruits",
    category: "Frutas Permanentes",
    price: 145,
    image: "/images/products/20560-perm-dragon-blox-fruits.png",
    description: "Fruta permanente Dragon.",
    available: true,
  },

  {
    id: "kitsune-permanente",
    name: "Kitsune",
    game: "Blox Fruits",
    category: "Frutas Permanentes",
    price: 120,
    image: "",
    description: "Fruta permanente Kitsune.",
    available: true,
  },

  {
    id: "yeti-permanente",
    name: "Yeti",
    game: "Blox Fruits",
    category: "Frutas Permanentes",
    price: 100,
    image: "",
    description: "Fruta permanente Yeti.",
    available: true,
  },
];