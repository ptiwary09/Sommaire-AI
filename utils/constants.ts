import { isDev } from "./helpers";

 export const Pricingplans = [
  {
    name: 'Basic',
    price: 9,
    description: 'Perfect for occasional use',
    items: [
      '5 PDF summaries per month',
      'Standard processing speed',
      'Email support',
    ],
    id: 'basic',
    paymentLink: 
   isDev ? 'https://buy.stripe.com/test_5kQ28s4Ay6ok9Fo4qQ38400': '',
   priceId:
    isDev?'price_1Ri8DOK5VKAQi8wvzxOhOI87' : '',
  },

  {
    name: 'Pro',
    price: 19,
    description: 'For professionals and teams',
    items: [
      'Unlimited PDF summaries',
      'Priority processing',
      '24/7 priority support',
      'Markdown Export',
    ],
    id: 'pro',
    paymentLink: isDev ? 'https://buy.stripe.com/test_eVqcN69US4gc8Bk2iI38401' : '',
    priceId: isDev ?'price_1Ri8DOK5VKAQi8wvcoY8ytig' : '',
  }
];

export const containerVariants = {
  hidden: {opacity: 0},
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};


export const itemVariants = {
  hidden: {opacity: 0, y:20 },
  visible:{
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 15,
      stiffness: 50,
    
    },
  },
};