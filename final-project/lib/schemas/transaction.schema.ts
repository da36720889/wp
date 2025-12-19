import { z } from 'zod';

export const createTransactionSchema = z.object({
  amount: z.number().positive('金額必須大於 0'),
  category: z.string().min(1, '類別不能為空'),
  description: z.string().optional(),
  type: z.enum(['income', 'expense'], {
    message: '類型必須是 income 或 expense',
  }),
  date: z.coerce.date().optional(),
});

export const queryTransactionSchema = z.object({
  userId: z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const deleteTransactionSchema = z.object({
  transactionId: z.string().min(1),
  userId: z.string().min(1),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type QueryTransactionInput = z.infer<typeof queryTransactionSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;

