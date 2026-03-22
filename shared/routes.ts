import { z } from 'zod';
import { insertCustomerSchema, insertApplianceSchema, insertServiceOrderSchema, insertServiceOrderPickupWarningSchema, customers, appliances, serviceOrders, serviceOrderPickupWarnings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

const pickupWarningListItemSchema = z.object({
  id: z.number(),
  orderNumber: z.string().nullable(),
  status: z.string(),
  entryDate: z.union([z.string(), z.date()]),
  daysPending: z.number(),
  customer: z.object({
    id: z.number(),
    name: z.string(),
    phone: z.string(),
  }),
  appliance: z.object({
    id: z.number(),
    type: z.string(),
    brand: z.string(),
    model: z.string(),
  }),
  pickupWarning: z.object({
    id: z.number(),
    serviceOrderId: z.number(),
    warningSentAt: z.union([z.string(), z.date()]),
    warningDeadlineAt: z.union([z.string(), z.date()]),
    warningStatus: z.string(),
    isExpired: z.boolean(),
  }).nullable(),
});

const pickupWarningSchema = z.object({
  id: z.number(),
  serviceOrderId: z.number(),
  warningSentAt: z.union([z.string(), z.date()]),
  warningDeadlineAt: z.union([z.string(), z.date()]),
  warningStatus: z.string(),
  isExpired: z.boolean(),
});

export const api = {
  customers: {
    list: {
      method: 'GET' as const,
      path: '/api/customers',
      responses: {
        200: z.array(z.custom<typeof customers.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/customers/:id',
      responses: {
        200: z.custom<typeof customers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/customers',
      input: insertCustomerSchema,
      responses: {
        201: z.custom<typeof customers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/customers/:id',
      input: insertCustomerSchema.partial(),
      responses: {
        200: z.custom<typeof customers.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  appliances: {
    list: {
      method: 'GET' as const,
      path: '/api/customers/:customerId/appliances',
      responses: {
        200: z.array(z.custom<typeof appliances.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/appliances',
      input: insertApplianceSchema,
      responses: {
        201: z.custom<typeof appliances.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  serviceOrders: {
    list: {
      method: 'GET' as const,
      path: '/api/service-orders',
      responses: {
        200: z.array(z.custom<typeof serviceOrders.$inferSelect & { customer: typeof customers.$inferSelect, appliance: typeof appliances.$inferSelect }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/service-orders/:id',
      responses: {
        200: z.custom<typeof serviceOrders.$inferSelect & { customer: typeof customers.$inferSelect, appliance: typeof appliances.$inferSelect }>(),
        404: errorSchemas.notFound,
      },
    },
    pickupWarnings: {
      method: 'GET' as const,
      path: '/api/service-orders/pickup-warnings',
      responses: {
        200: z.array(pickupWarningListItemSchema),
      },
    },
    createPickupWarning: {
      method: 'POST' as const,
      path: '/api/service-orders/:id/pickup-warning',
      input: z.object({}),
      responses: {
        200: pickupWarningSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/service-orders',
      input: insertServiceOrderSchema,
      responses: {
        201: z.custom<typeof serviceOrders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/service-orders/:id',
      input: insertServiceOrderSchema.partial(),
      responses: {
        200: z.custom<typeof serviceOrders.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalOrders: z.number(),
          completedOrders: z.number(),
          totalRevenue: z.number(),
          statusDistribution: z.record(z.number()),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
