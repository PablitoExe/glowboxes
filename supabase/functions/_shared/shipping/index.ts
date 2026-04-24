import { andreaniProvider } from "./providers/andreani.ts";
import { correoProvider } from "./providers/correo.ts";
import type { ShipmentOrder, ShippingProvider, ShippingProviderName } from "./types.ts";

const providers: Record<Exclude<ShippingProviderName, "manual">, ShippingProvider> = {
  correo: correoProvider,
  andreani: andreaniProvider
};

export function normalizeShippingProvider(value: unknown): ShippingProviderName {
  const provider = String(value || "").trim().toLowerCase();

  if (provider === "correo" || provider === "correo_argentino" || provider === "via_cargo") return "correo";
  if (provider === "andreani") return "andreani";
  return "manual";
}

export function providerForOrder(order: ShipmentOrder): ShippingProviderName {
  const explicitProvider = normalizeShippingProvider(order.shipping_provider);

  if (explicitProvider !== "manual") {
    return explicitProvider;
  }

  if (String(order.shipping_type || "").toLowerCase() !== "correo") {
    return "manual";
  }

  return normalizeShippingProvider(order.shipping_carrier);
}

export function getShippingProvider(providerName: unknown): ShippingProvider {
  const provider = normalizeShippingProvider(providerName);

  if (provider === "manual") {
    throw new Error("El proveedor manual no tiene integracion automatica.");
  }

  return providers[provider];
}

export function getShippingProviderForOrder(order: ShipmentOrder): ShippingProvider {
  return getShippingProvider(providerForOrder(order));
}

export type {
  CreateShipmentResult,
  LabelResult,
  NormalizedShippingStatus,
  ShipmentOrder,
  ShipmentOrderItem,
  ShippingProvider,
  ShippingProviderName,
  TrackingResult
} from "./types.ts";
