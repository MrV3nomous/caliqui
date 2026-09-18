export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          default_shipping_address: Json | null;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      designs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          canvas_state: Json;
          tshirt_color: string;
          thumbnail_url: string | null;
          is_ordered: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['designs']['Row'],
          'id' | 'created_at' | 'updated_at' | 'deleted_at'
        >;
        Update: Partial<Database['public']['Tables']['designs']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          design_id: string | null;
          marketplace_item_id: string | null;
          status: 'draft' | 'processing' | 'shipped' | 'delivered' | 'failed' | 'refunded';
          print_file_path: string;
          amount: number;
          currency: string;
          shipping_snapshot: Json | null;
          payment_intent_id: string | null;
          idempotency_key: string;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['orders']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      marketplace_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          print_file_path: string;
          thumbnail_url: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
