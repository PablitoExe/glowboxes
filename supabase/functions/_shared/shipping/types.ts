export type ShippingProviderName = "correo" | "andreani" | "manual";

export type NormalizedShippingStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "delivered";

export type ShipmentOrderItem = {
  id?: string;
  product_id?: string | null;
  quantity: number;
  unit_price: number;
  products?: {
    name?: string | null;
    weight_grams?: number | null;
  } | null;
};

export type ShipmentOrder = {
  id: string;
  user_id?: string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  tax?: number | string | null;
  total?: number | string | null;
  status?: string | null;
  shipping_type?: string | null;
  shipping_provider?: ShippingProviderName | string | null;
  shipping_carrier?: string | null;
  tracking_code?: string | null;
  shipping_status?: NormalizedShippingStatus | string | null;
  shipping_data?: Record<string, unknown> | null;
  customer_phone?: string | null;
  profiles?: {
    full_name?: string | null;
  } | null;
  order_items?: ShipmentOrderItem[] | null;
};

export type CreateShipmentResult = {
  provider: ShippingProviderName;
  trackingCode: string | null;
  shippingStatus: NormalizedShippingStatus;
  labelUrl?: string | null;
  labelBase64?: string | null;
  raw: unknown;
};

export type TrackingResult = {
  provider: ShippingProviderName;
  trackingCode: string;
  status: NormalizedShippingStatus;
  description?: string | null;
  events: Array<{
    status: NormalizedShippingStatus;
    description?: string | null;
    location?: string | null;
    timestamp?: string | null;
    raw?: unknown;
  }>;
  raw: unknown;
};

export type LabelResult = {
  provider: ShippingProviderName;
  trackingCode: string;
  contentType: string;
  labelBase64?: string | null;
  labelUrl?: string | null;
  raw: unknown;
};

export type ShippingProvider = {
  createShipment(order: ShipmentOrder): Promise<CreateShipmentResult>;
  getTracking(trackingCode: string): Promise<TrackingResult>;
  getLabel(trackingCode: string): Promise<LabelResult>;
};
