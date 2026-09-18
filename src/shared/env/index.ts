import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().default('Caliqui'),
  VITE_RAZORPAY_KEY_ID: z.string().min(1, 'Missing VITE_RAZORPAY_KEY_ID in .env file'),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;