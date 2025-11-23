// Tipos completos para Mercado Libre API según documentación oficial

// === TIPOS DE ENVÍO ADICIONALES ===

export interface MLShippingOption {
  shipping_method_id: number;
  name: string;
  description: string;
  currency_id: string;
  list_cost: number;
  cost: number;
  estimated_delivery: {
    date: string;
    time_from: string;
    time_to: string;
  };
  estimated_delivery_time: {
    type: 'known_frame' | 'over_frame' | 'unknown_frame';
    unit: string;
    value: number;
  };
  estimated_delivery_final: {
    date: string;
    time_from: string;
    time_to: string;
  };
  shipping_mode: string;
  logistic_type: string;
  treatment: string;
  guaranteed: boolean;
  order_priority: number;
  tags: string[];
  speed: {
    handling: number;
    shipping: number;
  };
}

export interface MLShippingCalculateRequest {
  zipcode: string;
  item_id: string;
  quantity: number;
  dimensions?: {
    height: number;
    width: number;
    length: number;
    weight: number;
  };
  seller_address?: string;
  free_method?: string;
  local_pickup?: boolean;
  logistic_type?: string;
}

export interface MLShippingCalculateResponse {
  coverage: {
    all_country: boolean;
    excluded_places: Array<{
      type: string;
      description: string;
    }>;
  };
  country: {
    id: string;
    name: string;
  };
  state: {
    id: string;
    name: string;
  };
  city: {
      id: string;
      name: string;
  };
  dimensions: {
    height: number;
    width: number;
    length: number;
    weight: number;
  };
  input: {
    zipcode_source: string;
    zipcode_target: string;
    dimensions: {
      height: number;
      width: number;
      length: number;
      weight: number;
    };
    item_price: number;
    free_shipping: boolean;
    list_cost: number;
    cost: number;
    seller_id: number;
  };
  methods: Array<{
    shipping_method_id: number;
    name: string;
    description: string;
    currency_id: string;
    list_cost: number;
    cost: number;
    estimated_delivery: {
      date: string;
      time_from: string;
      time_to: string;
    };
    estimated_delivery_time: {
      type: string;
      unit: string;
      value: number;
    };
    estimated_delivery_final: {
      date: string;
      time_from: string;
      time_to: string;
    };
    shipping_mode: string;
    logistic_type: string;
    treatment: string;
    guaranteed: boolean;
    order_priority: number;
    tags: string[];
    speed: {
      handling: number;
      shipping: number;
    };
  }>;
  source: string;
  destination: {
    type: string;
    zip_code: string;
    city_id: string;
    city_name: string;
    state_id: string;
    state_name: string;
    country_id: string;
    country_name: string;
  };
}

export interface MLShipmentHistory {
  date_created: string;
  status: string;
  substatus: string;
  comment: string;
  source: string;
  tracking_number?: string;
  tracking_url?: string;
}

export interface MLShipmentCreateRequest {
  order_id: string;
  mode: 'me1' | 'me2' | 'me3';
  shipping_method: number;
  sender_address_id: string;
  receiver_address_id: string;
  shipping_items: Array<{
    id: string;
    description: string;
    quantity: number;
    dimensions: {
      height: number;
      width: number;
      length: number;
      weight: number;
    };
  }>;
  comment?: string;
  tags?: string[];
}

export interface MLWebhookShipmentNotification {
  application_id: string;
  user_id: string;
  topic: 'shipments';
  resource: string;
  attempts: number;
  sent: string;
  received: string;
}

export interface MLWebhookOrderNotification {
  application_id: string;
  user_id: number;
  topic: 'orders' | 'payments';
  resource: string;
  attempts: number;
  sent: string;
  received: string;
  order: MLOrder;
}

// === TIPOS PRINCIPALES ===

export interface MLOrder {
  id: string;
  date_created: string;
  date_closed: string;
  last_updated: string;
  manufacture_date?: string;
  expiration_date?: string;
  status: string;
  status_detail: string;
  buying_mode: 'buy_it_now' | 'auction';
  total_amount: number;
  currency_id: string;
  shipment: {
    id: string;
    status: string;
    status_history?: Array<{
      status: string;
      date: string;
    }>;
    shipping_items?: Array<{
      id: string;
      description: string;
      quantity: number;
      dimensions: {
        height: number;
        width: number;
        length: number;
        weight: number;
      };
    }>;
    shipping_method: {
      id: number;
      name: string;
      description: string;
      type: string;
    };
    receiver_address: {
      id: string;
      address_line: string;
      street_name: string;
      street_number: number;
      comment: string;
      zip_code: string;
      city: {
        id: string;
        name: string;
      };
      state: {
        id: string;
        name: string;
      };
      country: {
        id: string;
        name: string;
      };
      latitude: number;
      longitude: number;
    };
    sender_address: {
      id: string;
      address_line: string;
      street_name: string;
      street_number: number;
      comment: string;
      zip_code: string;
      city: {
        id: string;
        name: string;
      };
      state: {
        id: string;
        name: string;
      };
      country: {
        id: string;
        name: string;
      };
      latitude: number;
      longitude: number;
    };
    shipping_option?: {
      id: string;
      name: string;
      currency_id: string;
      list_cost: number;
      cost: number;
      estimated_delivery: {
        date: string;
        time_from: string;
        time_to: string;
      };
    };
    cost?: number;
    currency_id?: string;
    base_cost?: number;
    logistic_type?: string;
    date_created?: string;
    last_updated?: string;
    tracking_number?: string;
    tracking_method?: string;
    tracking_url?: string;
    substatus?: string;
    tags?: string[];
    carrier_info?: {
      carrier_id: number;
      name: string;
      phone?: string;
      email?: string;
      website?: string;
    };
  };
  order_items: Array<{
    item: {
      id: string;
      title: string;
      category_id: string;
      variation_id?: string;
      seller_custom_field?: string;
      thumbnail: string;
      thumbnail_id: string;
      seller_sku?: string;
      condition: string;
      listing_type_id: string;
      buying_mode: string;
      site_id: string;
      permalink: string;
      warranty?: string;
      catalog_product_id?: string;
      domain_attributes?: string[];
      parent_item_id?: string;
      differential_pricing?: {
        id: number;
        payment_methods?: Array<{
          id: string;
        }>;
      };
      deal_ids?: string[];
    };
    quantity: number;
    unit_price: number;
    full_unit_price?: number;
    currency_id: string;
    manufacturing_time?: number;
    sale_fee?: number;
    listing_type?: string;
    condition?: string;
    item_condition?: string;
    warranty?: string;
    taxes?: Array<{
      id?: string;
      name?: string;
      vat?: number;
    }>;
    discount?: number;
    promotion_id?: string;
    differential_pricing_id?: number;
    deal_ids?: string[];
    campaign_id?: string;
    variation_attributes?: Array<{
      id: string;
      name: string;
      value_name: string;
    }>;
    sale_terms?: Array<{
      id: string;
    }>;
    dimensions?: {
      height: number;
      width: number;
      length: number;
      weight: number;
    };
  }>;
  payments: Array<{
    id: string;
    order_id: string;
    payer_id: number;
    collector_id: number;
    card_id?: string;
    campaign_id?: number;
    payment_method_id: string;
    payment_type_id: string;
    site_id: string;
    currency_id: string;
    installments: number;
    issuer_id?: string;
    activation_uri?: string;
    payment_method?: {
      id: string;
      name: string;
      payment_type_id: string;
      financial_institution?: string;
      debit_card?: boolean;
      credit_card?: boolean;
      prepaid_card?: boolean;
      description?: string;
      secure_thumbnail?: string;
      thumbnail?: string;
      processing_modes?: Array<string>;
      settings?: Array<{
        bin?: {
          pattern?: string;
          exclusion_pattern?: string;
          installments_pattern?: string;
        };
        card_number?: {
          length?: number;
          security_code?: {
            length?: number;
            card_location?: string;
          };
        };
      }>;
    };
    external_reference?: string;
    status: string;
    status_detail: string;
    transaction_amount: number;
    transaction_amount_refunded?: number;
    coupon_amount?: number;
    differential_pricing?: any;
    deduction_schema?: any;
    transaction_details: {
      external_resource_url?: string;
      installment_amount?: number;
      financial_institution?: string;
      payment_method_reference_id?: string;
      net_received_amount?: number;
      total_paid_amount?: number;
      overpaid_amount?: number;
      payable_amount?: number;
      acquirer_reference?: string;
    };
    fee_details?: Array<{
      type: string;
      amount: number;
      fee_payer?: string;
    }>;
    taxes?: Array<{
      type?: string;
      value?: number;
    }>;
    counter_currency?: string;
    shipping_amount?: number;
    total_paid_amount: number;
    card?: {
      id: string;
      first_six_digits: string;
      last_four_digits: string;
      expiration_month: number;
      expiration_year: number;
      date_created?: string;
      date_last_updated?: string;
      cardholder?: {
        name: string;
        identification?: {
          type: string;
          number: string;
        };
      };
    };
    statement_descriptor?: string;
    alive?: boolean;
    binary_mode: boolean;
    call_for_authorize_id?: string;
    coupon_code?: string;
    description?: string;
    integrator_id?: string;
    marketplace?: string;
    merchant_account_id?: number;
    merchant_number?: string;
    metadata?: Record<string, any>;
    notification_url?: string;
    order?: {
      id: number;
      type: string;
    };
    additional_info?: {
      ip_address?: string;
      items?: Array<{
        id: string;
        title: string;
        description?: string;
        picture_url?: string;
        category_id?: string;
        quantity: number;
        unit_price: number;
        unit_measure?: string;
        total_amount?: number;
      }>;
      payer?: {
        first_name?: string;
        last_name?: string;
        phone?: {
          area_code?: string;
          number?: string;
        };
        address?: {
          street_name?: string;
          street_number?: string;
          zip_code?: string;
        };
        registration_date?: string;
      };
      shipments?: {
        receiver_address?: {
          street_name?: string;
          street_number?: string;
          zip_code?: string;
          floor?: string;
          apartment?: string;
          city?: string;
          state?: string;
          country?: string;
        };
        zip_code?: string;
        street_name?: string;
        street_number?: string;
        floor?: string;
        apartment?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    };
    callback_url?: string;
    date_of_expiration?: string;
    expiration_date?: string;
    date_created: string;
    date_approved?: string;
    last_modified: string;
    payment_method_option_id?: string;
    three_ds_info?: {
      external_resource_url?: string;
      cre_token?: string;
    };
    point_of_interaction?: {
      type?: string;
      sub_type?: string;
      application_data?: {
        name?: string;
        version?: string;
      };
      transaction_data?: {
        qr_code?: {
          base64?: string;
          alve?: string;
        };
        ticket_url?: string;
      };
    };
    captured?: boolean;
    live_mode?: boolean;
    refund_reason?: string;
    refunds?: Array<any>;
    shipping_cost?: number;
    taxes_amount?: number;
    application_fee?: number;
    platform_fee?: number;
    reason?: string;
    payer: {
      id: number;
      email: string;
      identification?: {
        type: string;
        number: string;
      };
      first_name: string;
      last_name: string;
      phone?: {
        area_code?: string;
        number?: string;
        extension?: string;
      };
      type?: string;
      entity_type?: string;
    };
    collector: {
      id: number;
      email: string;
      nickname: string;
      first_name: string;
      last_name: string;
      phone?: {
        area_code?: string;
        number?: string;
        extension?: string;
      };
      address?: {
        street_name?: string;
        street_number?: string;
        zip_code?: string;
      };
      country_id?: string;
    };
    marketplace_owner?: number;
    sponsor_id?: number;
    authorization_code?: string;
  }>;
  feedback?: {
    purchase: {
      rating: string;
      message?: string;
      reason?: string;
      fulfillment?: string;
    };
    sale: {
      rating: string;
      message?: string;
      reason?: string;
      fulfillment?: string;
    };
  };
  comments?: string;
  pack_id?: string;
  application_id: string;
  seller: {
    id: number;
    nickname: string;
    email: string;
    phone?: {
      area_code?: string;
      number?: string;
      extension?: string;
    };
    first_name: string;
    last_name: string;
    billing_info?: {
      doc_type?: string;
      doc_number?: string;
    };
  };
  buyer: {
    id: number;
    nickname: string;
    email: string;
    phone?: {
      area_code?: string;
      number?: string;
      extension?: string;
    };
    first_name: string;
    last_name: string;
    billing_info?: {
      doc_type?: string;
      doc_number?: string;
    };
  };
  tags: string[];
  mediated?: boolean;
  taxes?: {
    amount?: number;
    currency_id?: string;
    type?: string;
  };
  taxes_amount?: number;
  total_amount_with_shipping?: number;
  paid_amount?: number;
  coupon?: {
    id: string;
    amount?: number;
    coupon_type?: string;
    coupon_value?: number;
    campaign_id?: string;
    campaign_name?: string;
    discount_type?: string;
    discount_detail?: string;
    coupon_percentage?: number;
    coupon_amount?: number;
    coupon_expires?: string;
  };
  deal_id?: string;
  fiscal_data?: {
    fiscal_id?: string;
    fiscal_id_type?: string;
    fiscal_name?: string;
    fiscal_address?: string;
    fiscal_phone?: string;
    fiscal_note?: string;
  };
  order_request?: {
    // Campos futuros para order_request
  };
  hidden_for_seller?: boolean;
  hidden_for_buyer?: boolean;
  eligibility?: {
    reason?: string;
    restricted?: boolean;
  };
  claim?: {
    id: string;
    type: string;
    status: string;
  };
}

export interface MLItem {
  id: string;
  site_id: string;
  title: string;
  subtitle?: string;
  seller_id: number;
  category_id: string;
  official_store_id?: number;
  price: number;
  base_price: number;
  original_price?: number;
  currency_id: string;
  initial_quantity: number;
  available_quantity: number;
  sold_quantity: number;
  sale_terms?: Array<{
    id: string;
    name: string;
    value_id?: string;
    value_name?: string;
    value_struct?: {
      number?: number;
      unit?: string;
    };
  }>;
  buying_mode: 'buy_it_now' | 'auction';
  listing_type_id: string;
  start_time: string;
  stop_time?: string;
  condition: 'new' | 'used';
  permalink: string;
  thumbnail: string;
  thumbnail_id: string;
  secure_thumbnail: string;
  pictures: Array<{
    id: string;
    url: string;
    secure_url: string;
    size: string;
    max_size: string;
    quality: string;
  }>;
  video_id?: string;
  descriptions?: Array<{
    id: string;
    plain_text: string;
  }>;
  accepts_mercadopago: boolean;
  non_mercado_pago_payment_methods?: Array<{
    id: string;
    description: string;
    type: string;
    secure_thumbnail: string;
    thumbnail: string;
    deferred_capture?: string;
    settings?: Array<{
      card_number?: {
        length?: number;
        security_code?: {
          length?: number;
          card_location?: string;
        };
      };
      bin?: {
        pattern?: string;
        exclusion_pattern?: string;
        installments_pattern?: string;
      };
    }>;
    additional_info_needed?: Array<string>;
    min_allowed_amount?: number;
    max_allowed_amount?: number;
    accreditation_time?: number;
    financial_institutions?: Array<{
      id: string;
      description: string;
    }>;
    payment_type_id?: string;
  }>;
  shipping?: {
    mode: 'me1' | 'me2' | 'custom';
    local_pickup: boolean;
    free_shipping: boolean;
    logistic_type?: string;
    store_pick_up: boolean;
    dimensions?: string;
    tags?: string[];
    item_dimensions?: {
      height: number;
      width: number;
      length: number;
    };
    methods?: Array<{
      id: string;
    }>;
    free_methods?: Array<{
      id: number;
      rule?: {
        free_mode?: string;
        value?: number;
        default?: boolean;
        free_shipping_flag?: boolean;
      };
    }>;
  };
  international_delivery_mode?: string;
  seller_address: {
    id: string;
    comment?: string;
    address_line: string;
    zip_code: string;
    city: {
      id: string;
      name: string;
    };
    state: {
      id: string;
      name: string;
    };
    country: {
      id: string;
      name: string;
    };
    latitude: number;
    longitude: number;
    search_location: {
      neighborhood?: {
        id: string;
        name: string;
      };
      city?: {
        id: string;
        name: string;
      };
      state?: {
        id: string;
        name: string;
      };
    };
  };
  seller_contact?: string;
  location?: {
    address_line: string;
    zip_code: string;
    neighborhood: {
      id: string;
      name: string;
    };
    city: {
      id: string;
      name: string;
    };
    state: {
      id: string;
      name: string;
    };
    country: {
      id: string;
      name: string;
    };
    latitude: number;
    longitude: number;
  };
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  coverage_areas?: Array<{
    type: string;
    positions: Array<{
      latitude: number;
      longitude: number;
    }>;
  }>;
  attributes?: Array<{
    id: string;
    name: string;
    value_id: string;
    value_name: string;
    value_struct?: {
      number?: number;
      unit?: string;
    };
    attribute_group_id: string;
    attribute_group_name: string;
    source: number;
  }>;
  warnings?: Array<{
    message: string;
    severity?: string;
    cause?: string;
  }>;
  listing_source: string;
  variations?: Array<{
    id: number;
    product_id?: number;
    attribute_combinations: Array<{
      id: string;
      name: string;
      value_id: string;
      value_name: string;
      value_struct?: {
        number?: number;
        unit?: string;
      };
    }>;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    picture_ids: Array<string>;
    seller_custom_field?: string;
    catalog_product_id?: string;
  }>;
  status: string;
  sub_status?: Array<string>;
  tags: Array<string>;
  warranty?: string;
  catalog_product_id?: string;
  domain_attributes?: Array<string>;
  parent_item_id?: string;
  differential_pricing?: {
    id: number;
    payment_methods?: Array<{
      id: string;
    }>;
  };
  deal_ids?: Array<string>;
  automatic_relist?: boolean;
  date_created: string;
  last_updated: string;
  health: number;
  catalog_listing: boolean;
  item_relations?: Array<{
    id: string;
    parent_id?: string;
    child_id?: string;
    relation_type: string;
  }>;
}

export interface MLWebhookEvent {
  id: string;
  application_id: string;
  user_id: number;
  topic: 'orders' | 'items' | 'questions' | 'payments' | 'shipments' | 'claims' | 'invoices';
  resource: string;
  attempts: number;
  sent: string;
  received: string;
}

export interface MLShipment {
  id: string;
  mode: 'me1' | 'me2' | 'me3';
  shipping_method: {
    id: number;
    name: string;
    description: string;
    type: 'standard' | 'express' | 'fulfillment';
  };
  sender_address: {
    id: string;
    address_line: string;
    street_name: string;
    street_number: number;
    comment: string;
    zip_code: string;
    city: {
      id: string;
      name: string;
    };
    state: {
      id: string;
      name: string;
    };
    country: {
      id: string;
      name: string;
    };
    latitude: number;
    longitude: number;
    agency: {
      carrier_id: number;
      description: string;
    };
  };
  receiver_address: {
    id: string;
    address_line: string;
    street_name: string;
    street_number: number;
    comment: string;
    zip_code: string;
    city: {
      id: string;
      name: string;
    };
    state: {
      id: string;
      name: string;
    };
    country: {
      id: string;
      name: string;
    };
    latitude: number;
    longitude: number;
    agency: {
      carrier_id: number;
      description: string;
    };
  };
  shipping_items: Array<{
    id: string;
    description: string;
    quantity: number;
    dimensions: {
      height: number;
      width: number;
      length: number;
      weight: number;
    };
  }>;
  cost: number;
  currency_id: string;
  status: string;
  substatus: string;
  date_created: string;
  last_updated: string;
  tracking_number?: string;
  tracking_url?: string;
  tracking_method?: string;
  tags: string[];
  order_id: string;
  logistic_type: 'drop_off' | 'cross_docking' | 'fulfillment' | 'self_service';
  carrier_info: {
    carrier_id: number;
    name: string;
    phone: string;
    email: string;
    website: string;
  };
}

export interface MLShipmentTracking {
  shipment_id: string;
  tracking_number: string;
  tracking_url: string;
  status: string;
  substatus: string;
  date_created: string;
  last_updated: string;
  history: MLShipmentHistory[];
  carrier_info: {
    carrier_id: number;
    name: string;
    phone: string;
    email: string;
    website: string;
  };
}

// Estados de envío según documentación de Mercado Libre
export const ML_SHIPMENT_STATUS = {
  PENDING: 'pending',
  READY_TO_PRINT: 'ready_to_print',
  PRINTED: 'printed',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  NOT_DELIVERED: 'not_delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  CONFIRMED_DELIVERY: 'confirmed_delivery',
  STALLED: 'stalled',
  DESTRUCTION: 'destruction',
  FORWARDED: 'forwarded',
  RETRY: 'retry',
  SHIPPING_COSTS: 'shipping_costs',
  BAD_ADDRESS: 'bad_address',
  NEUTRALIZED: 'neutralized',
  CONTESTED: 'contested',
  REFUSED: 'refused',
  BAD_PACKAGE: 'bad_package',
  BAD_QUANTITY: 'bad_quantity',
  BAD_CONTENT: 'bad_content',
  CUSTOMS_HOLD: 'customs_hold',
  BAD_LABEL: 'bad_label',
  BAD_MEASUREMENTS: 'bad_measurements',
  CARRIER_ERROR: 'carrier_error',
  TRANSPORTATION_PROBLEM: 'transportation_problem',
  CARRIER_DELAY: 'carrier_delay',
  CUSTOMS_RETENTION: 'customs_retention',
  CUSTOMS_TRANSIT: 'customs_transit',
  WAREHOUSE_PROCESSING_DELAY: 'warehouse_processing_delay',
  CARRIER_PICKUP_DELAY: 'carrier_pickup_delay',
  BAD_DOCUMENTATION: 'bad_documentation',
  BAD_PACKAGING: 'bad_packaging',
  RETURN_REQUESTED: 'return_requested',
  RETURN_IN_PROGRESS: 'return_in_progress',
  RETURN_COMPLETED: 'return_completed',
  RETURN_DECLINED: 'return_declined',
  RETURN_REJECTED: 'return_rejected',
  RETURN_CANCELLED: 'return_cancelled',
} as const;

export type MLShipmentStatus = keyof typeof ML_SHIPMENT_STATUS;

// Mapeo de estados ML a estados locales
export const ML_STATUS_TO_LOCAL = {
  [ML_SHIPMENT_STATUS.PENDING]: 'pending',
  [ML_SHIPMENT_STATUS.READY_TO_PRINT]: 'processing',
  [ML_SHIPMENT_STATUS.PRINTED]: 'processing',
  [ML_SHIPMENT_STATUS.IN_TRANSIT]: 'shipped',
  [ML_SHIPMENT_STATUS.DELIVERED]: 'delivered',
  [ML_SHIPMENT_STATUS.NOT_DELIVERED]: 'failed',
  [ML_SHIPMENT_STATUS.CANCELLED]: 'cancelled',
  [ML_SHIPMENT_STATUS.RETURNED]: 'returned',
  [ML_SHIPMENT_STATUS.CONFIRMED_DELIVERY]: 'delivered',
  [ML_SHIPMENT_STATUS.STALLED]: 'pending',
  [ML_SHIPMENT_STATUS.BAD_ADDRESS]: 'failed',
  [ML_SHIPMENT_STATUS.CONTESTED]: 'pending',
  [ML_SHIPMENT_STATUS.REFUSED]: 'failed',
  [ML_SHIPMENT_STATUS.BAD_PACKAGE]: 'failed',
  [ML_SHIPMENT_STATUS.BAD_QUANTITY]: 'failed',
  [ML_SHIPMENT_STATUS.BAD_CONTENT]: 'failed',
  [ML_SHIPMENT_STATUS.CUSTOMS_HOLD]: 'pending',
  [ML_SHIPMENT_STATUS.BAD_LABEL]: 'failed',
  [ML_SHIPMENT_STATUS.BAD_MEASUREMENTS]: 'failed',
  [ML_SHIPMENT_STATUS.CARRIER_ERROR]: 'failed',
  [ML_SHIPMENT_STATUS.TRANSPORTATION_PROBLEM]: 'failed',
  [ML_SHIPMENT_STATUS.CARRIER_DELAY]: 'pending',
  [ML_SHIPMENT_STATUS.CUSTOMS_RETENTION]: 'pending',
  [ML_SHIPMENT_STATUS.CUSTOMS_TRANSIT]: 'pending',
  [ML_SHIPMENT_STATUS.WAREHOUSE_PROCESSING_DELAY]: 'pending',
  [ML_SHIPMENT_STATUS.CARRIER_PICKUP_DELAY]: 'pending',
  [ML_SHIPMENT_STATUS.BAD_DOCUMENTATION]: 'failed',
  [ML_SHIPMENT_STATUS.BAD_PACKAGING]: 'failed',
  [ML_SHIPMENT_STATUS.RETURN_REQUESTED]: 'returned',
  [ML_SHIPMENT_STATUS.RETURN_IN_PROGRESS]: 'returned',
  [ML_SHIPMENT_STATUS.RETURN_COMPLETED]: 'returned',
  [ML_SHIPMENT_STATUS.RETURN_DECLINED]: 'returned',
  [ML_SHIPMENT_STATUS.RETURN_REJECTED]: 'returned',
  [ML_SHIPMENT_STATUS.RETURN_CANCELLED]: 'returned',
} as const;

export type LocalShipmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed' | 'cancelled' | 'returned';

// Estados de órdenes según documentación oficial
export const ORDER_STATUS = {
  CONFIRMED: 'confirmed',
  PAYMENT_REQUIRED: 'payment_required',
  PAYMENT_IN_PROCESS: 'payment_in_process',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  INVALIDATED: 'invalidated'
} as const;

export const ORDER_STATUS_DETAIL = {
  // Confirmed
  NOT_YET_PAID: 'not_yet_paid',
  // Payment Required
  WAITING_FOR_PAYMENT: 'waiting_for_payment',
  // Payment In Process
  PAYMENT_IN_PROGRESS: 'payment_in_progress',
  // Paid
  PAYED: 'payed',
  // Cancelled
  CANCELLED: 'cancelled',
  BY_BUYER: 'by_buyer',
  BY_SELLER: 'by_seller',
  BY_ML: 'by_ml',
  BY_SYSTEM: 'by_system',
  // Invalidated
  NOT_CONFIRMED: 'not_confirmed'
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;
export type OrderStatusDetail = keyof typeof ORDER_STATUS_DETAIL;

// Estados de productos según documentación oficial
export const ITEM_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  UNDER_REVIEW: 'under_review',
  INACTIVE: 'inactive'
} as const;

export type ItemStatus = keyof typeof ITEM_STATUS;
