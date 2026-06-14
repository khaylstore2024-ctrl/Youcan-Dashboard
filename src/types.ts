export interface Order {
  _rowNum?: number;
  "Order ID": string;
  "Order date": string;
  "Full name": string;
  "Phone": string;
  "City": string;
  "Region": string;
  "Product name": string; // stores Product CODE
  "Product URL": string;
  "Variant price": number;
  "Total quantity": number;
  "Product variant": string;
  "Total price": number;
  "Condition": string; // Confirmed, Call again, WHATSAPP, Ne repond pas, Anule
  "Livreur": string; // CATHEDIS + dynamic
  "delivery": string; // Delivered, Retour, annuler, Client Injoignable, Annulé Au Téléphone, Annulé Sur Place
  "prix d'achat": number;
  "Frais livraison": number;
  "Bénéfice": number;
  "Fournisseur": string;
  "Fourni price": number;
  "WhatsApp Sent"?: string;
  "WhatsApp Count"?: number;
  "Unreachable Count"?: number;
}

export interface Purchase {
  _rowNum?: number;
  "ID": string; // ACH-XXXX
  "date": string;
  "nombre": number;
  "Produit": string;
  "Code": string;
  "Prix Unit": number;
  "total": number;
  "Fournisseur": string;
  "Prix de vente": number;
}

export interface Payment {
  _rowNum?: number;
  "ID": string; // PAY-XXXX
  "date": string;
  "Payment": number;
  "Fournisseur": string;
}

export interface Expense {
  _rowNum?: number;
  "ID": string; // EXP-XXXX or simple schema
  "date": string;
  "Prix": number; // MUST be 'Prix'
  "Taper": string; // free text for type of expense
}

export interface AppData {
  sales: Order[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
}
