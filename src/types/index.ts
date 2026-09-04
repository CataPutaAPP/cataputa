export type UserRole = "cliente" | "prestador" | "parceiro";

export interface User {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type Urgency = "baixa" | "media" | "alta";
export type ServiceRequestStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";

export interface ServiceRequest {
  id: string;
  client_id: string;
  client_name: string;
  service_type: string;
  description: string;
  location: string;
  urgency: Urgency;
  status: ServiceRequestStatus;
  wants_partner: boolean;
  created_at: string;
}

export type ServiceOfferStatus = "pendente" | "aceita" | "recusada" | "em_andamento" | "concluida";

export interface ServiceOffer {
  id: string;
  request_id: string;
  provider_id: string | null;
  service_type: string;
  description: string;
  price: number;
  location: string;
  status: ServiceOfferStatus;
  created_at: string;
}

export type PartnershipStatus = "convite" | "ativa" | "recusada" | "concluida";

export interface Partnership {
  id: string;
  request_id: string;
  partner_id: string | null;
  client_name: string;
  service_type: string;
  description: string;
  share_percent: number;
  status: PartnershipStatus;
  created_at: string;
}
