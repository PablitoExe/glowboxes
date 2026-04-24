(function () {
  const statuses = {
    pedido_recibido: {
      label: "Pedido recibido",
      shortLabel: "Recibido",
      icon: "✓",
      tone: "process",
      colorClass: "is-process",
      description: "Ya tenemos tu pedido en el sistema."
    },
    preparando_pedido: {
      label: "Preparando pedido",
      shortLabel: "Preparando",
      icon: "◷",
      tone: "process",
      colorClass: "is-process",
      description: "El equipo esta armando tu compra."
    },
    pedido_despachado: {
      label: "Pedido despachado",
      shortLabel: "Despachado",
      icon: "▣",
      tone: "route",
      colorClass: "is-route",
      description: "El pedido ya salio de preparacion."
    },
    en_camino: {
      label: "En camino",
      shortLabel: "En camino",
      icon: "↗",
      tone: "route",
      colorClass: "is-route",
      description: "Tu pedido esta viajando hacia la direccion indicada."
    },
    en_sucursal: {
      label: "En sucursal",
      shortLabel: "En sucursal",
      icon: "⌂",
      tone: "route",
      colorClass: "is-route",
      description: "El pedido esta disponible en la sucursal."
    },
    listo_para_retirar: {
      label: "Listo para retirar",
      shortLabel: "Retirar",
      icon: "⌂",
      tone: "route",
      colorClass: "is-route",
      description: "Podes pasar por el local a retirar tu compra."
    },
    enviado_por_correo: {
      label: "Enviado por correo",
      shortLabel: "Correo",
      icon: "✉",
      tone: "route",
      colorClass: "is-route",
      description: "El paquete fue entregado al correo."
    },
    entregado_completado: {
      label: "Entregado / Completado",
      shortLabel: "Completado",
      icon: "✓",
      tone: "done",
      colorClass: "is-done",
      description: "El pedido fue entregado y cerrado."
    },
    cancelado: {
      label: "Cancelado",
      shortLabel: "Cancelado",
      icon: "×",
      tone: "danger",
      colorClass: "is-danger",
      description: "El pedido fue cancelado."
    }
  };

  const legacyStatusMap = {
    pendiente: "pedido_recibido",
    pagado: "preparando_pedido",
    enviado: "pedido_despachado"
  };

  const flows = {
    delivery: ["pedido_recibido", "preparando_pedido", "pedido_despachado", "en_camino", "entregado_completado"],
    correo: ["pedido_recibido", "preparando_pedido", "pedido_despachado", "enviado_por_correo", "entregado_completado"],
    retiro: ["pedido_recibido", "preparando_pedido", "en_sucursal", "listo_para_retirar", "entregado_completado"]
  };

  const shippingLabels = {
    delivery: "Delivery",
    correo: "Correo",
    retiro: "Retiro en local"
  };

  function normalizeStatus(status) {
    const rawStatus = String(status || "pedido_recibido").toLowerCase();
    return legacyStatusMap[rawStatus] || rawStatus;
  }

  function normalizeShippingType(type) {
    const rawType = String(type || "delivery").toLowerCase();
    return flows[rawType] ? rawType : "delivery";
  }

  function getFlow(shippingType) {
    return flows[normalizeShippingType(shippingType)];
  }

  function getStatusMeta(status) {
    const normalizedStatus = normalizeStatus(status);
    return statuses[normalizedStatus] || statuses.pedido_recibido;
  }

  function getStatusOptions(shippingType) {
    const flow = getFlow(shippingType);
    return [...flow, "cancelado"].map(status => ({
      value: status,
      ...getStatusMeta(status)
    }));
  }

  function getStepState(status, step, shippingType) {
    const flow = getFlow(shippingType);
    const normalizedStatus = normalizeStatus(status);
    const currentIndex = flow.indexOf(normalizedStatus);
    const stepIndex = flow.indexOf(step);

    if (normalizedStatus === "cancelado") return "pending";
    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return getStatusMeta(step).tone === "done" ? "done" : getStatusMeta(step).tone;
    return "pending";
  }

  function getProgress(status, shippingType) {
    const flow = getFlow(shippingType);
    const normalizedStatus = normalizeStatus(status);
    const index = Math.max(0, flow.indexOf(normalizedStatus));

    if (normalizedStatus === "cancelado") return 0;
    if (flow.length <= 1) return 100;

    return Math.round((index / (flow.length - 1)) * 100);
  }

  function isOrderActive(status) {
    const normalizedStatus = normalizeStatus(status);
    return normalizedStatus !== "entregado_completado" && normalizedStatus !== "cancelado";
  }

  function formatDateTime(value) {
    if (!value) return "Sin fecha";

    try {
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch (error) {
      return "Sin fecha";
    }
  }

  function historyFor(order) {
    const history = Array.isArray(order.order_status_history)
      ? order.order_status_history
      : Array.isArray(order.history)
        ? order.history
        : [];

    const normalizedHistory = history
      .map(item => ({
        status: normalizeStatus(item.status),
        timestamp: item.timestamp || item.created_at || order.updated_at || order.created_at
      }))
      .filter(item => item.status);

    if (normalizedHistory.length) {
      return normalizedHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    return [{
      status: normalizeStatus(order.status),
      timestamp: order.updated_at || order.created_at
    }];
  }

  function buildTimelineMarkup(order, escapeHtml) {
    const shippingType = normalizeShippingType(order.shipping_type);
    const currentStatus = normalizeStatus(order.status);
    const progress = getProgress(currentStatus, shippingType);

    return `
      <section class="order-timeline" style="--progress: ${progress}%">
        <div class="order-progress-track" aria-hidden="true"><span></span></div>
        <div class="order-steps">
          ${getFlow(shippingType).map(step => {
            const meta = getStatusMeta(step);
            const state = getStepState(currentStatus, step, shippingType);

            return `
              <article class="order-step ${state === "pending" ? "is-pending" : `is-${state}`}">
                <span class="order-step-icon">${escapeHtml(meta.icon)}</span>
                <strong>${escapeHtml(meta.shortLabel)}</strong>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  window.GlowOrders = {
    statuses,
    flows,
    shippingLabels,
    normalizeStatus,
    normalizeShippingType,
    getFlow,
    getStatusMeta,
    getStatusOptions,
    getProgress,
    getStepState,
    isOrderActive,
    formatDateTime,
    historyFor,
    buildTimelineMarkup
  };
})();
