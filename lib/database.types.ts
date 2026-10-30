export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      events: {
        Row: {
          actor_role: Database['public']['Enums']['user_role'] | null;
          at: string;
          id: number;
          name: string;
          order_id: string | null;
          props: Json;
          shop_id: string | null;
          user_id: string | null;
        };
        Insert: {
          actor_role?: Database['public']['Enums']['user_role'] | null;
          at?: string;
          id?: number;
          name: string;
          order_id?: string | null;
          props?: Json;
          shop_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          actor_role?: Database['public']['Enums']['user_role'] | null;
          at?: string;
          id?: number;
          name?: string;
          order_id?: string | null;
          props?: Json;
          shop_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      group_tier_prices: {
        Row: {
          group_id: string;
          price_satang: number;
          selected_count: number;
        };
        Insert: {
          group_id: string;
          price_satang: number;
          selected_count: number;
        };
        Update: {
          group_id?: string;
          price_satang?: number;
          selected_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'group_tier_prices_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'option_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      ingredients: {
        Row: {
          id: string;
          is_available: boolean;
          name: string;
          shop_id: string;
        };
        Insert: {
          id?: string;
          is_available?: boolean;
          name: string;
          shop_id: string;
        };
        Update: {
          id?: string;
          is_available?: boolean;
          name?: string;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ingredients_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_ingredients: {
        Row: {
          ingredient_id: string;
          menu_id: string;
        };
        Insert: {
          ingredient_id: string;
          menu_id: string;
        };
        Update: {
          ingredient_id?: string;
          menu_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_ingredients_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'menu_ingredients_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_variants: {
        Row: {
          id: string;
          is_available: boolean;
          menu_id: string;
          option_ids: string[];
          price_satang: number | null;
        };
        Insert: {
          id?: string;
          is_available?: boolean;
          menu_id: string;
          option_ids: string[];
          price_satang?: number | null;
        };
        Update: {
          id?: string;
          is_available?: boolean;
          menu_id?: string;
          option_ids?: string[];
          price_satang?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_variants_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id'];
          },
        ];
      };
      menus: {
        Row: {
          base_price_satang: number | null;
          category: string;
          cook_seconds: number;
          deleted_at: string | null;
          id: string;
          is_available: boolean;
          name: string;
          pair_only: boolean;
          shop_id: string;
          sort: number;
        };
        Insert: {
          base_price_satang?: number | null;
          category: string;
          cook_seconds: number;
          deleted_at?: string | null;
          id?: string;
          is_available?: boolean;
          name: string;
          pair_only?: boolean;
          shop_id: string;
          sort?: number;
        };
        Update: {
          base_price_satang?: number | null;
          category?: string;
          cook_seconds?: number;
          deleted_at?: string | null;
          id?: string;
          is_available?: boolean;
          name?: string;
          pair_only?: boolean;
          shop_id?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'menus_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      option_groups: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['option_group_kind'];
          max_select: number;
          menu_id: string;
          min_select: number;
          name: string;
          note: string | null;
          select_all_label: string | null;
          show_when_group_id: string | null;
          show_when_option_ids: string[] | null;
          sort: number;
        };
        Insert: {
          id?: string;
          kind: Database['public']['Enums']['option_group_kind'];
          max_select: number;
          menu_id: string;
          min_select: number;
          name: string;
          note?: string | null;
          select_all_label?: string | null;
          show_when_group_id?: string | null;
          show_when_option_ids?: string[] | null;
          sort?: number;
        };
        Update: {
          id?: string;
          kind?: Database['public']['Enums']['option_group_kind'];
          max_select?: number;
          menu_id?: string;
          min_select?: number;
          name?: string;
          note?: string | null;
          select_all_label?: string | null;
          show_when_group_id?: string | null;
          show_when_option_ids?: string[] | null;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'option_groups_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'option_groups_show_when_group_id_fkey';
            columns: ['show_when_group_id'];
            isOneToOne: false;
            referencedRelation: 'option_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      options: {
        Row: {
          group_id: string;
          id: string;
          ingredient_id: string | null;
          is_available: boolean;
          is_default: boolean;
          name: string;
          price_delta_satang: number;
          sort: number;
        };
        Insert: {
          group_id: string;
          id?: string;
          ingredient_id?: string | null;
          is_available?: boolean;
          is_default?: boolean;
          name: string;
          price_delta_satang?: number;
          sort?: number;
        };
        Update: {
          group_id?: string;
          id?: string;
          ingredient_id?: string | null;
          is_available?: boolean;
          is_default?: boolean;
          name?: string;
          price_delta_satang?: number;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'options_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'option_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'options_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          kitchen_summary: string;
          line_total_satang: number;
          menu_id: string | null;
          menu_name: string;
          note: string | null;
          order_id: string;
          qty: number;
          selections: Json;
          unit_price_satang: number;
        };
        Insert: {
          id?: string;
          kitchen_summary: string;
          line_total_satang: number;
          menu_id?: string | null;
          menu_name: string;
          note?: string | null;
          order_id: string;
          qty: number;
          selections: Json;
          unit_price_satang: number;
        };
        Update: {
          id?: string;
          kitchen_summary?: string;
          line_total_satang?: number;
          menu_id?: string | null;
          menu_name?: string;
          note?: string | null;
          order_id?: string;
          qty?: number;
          selections?: Json;
          unit_price_satang?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        Insert: {
          allergy_note?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          customer_name: string;
          day?: string | null;
          estimated_wait_seconds?: number | null;
          feedback?: Database['public']['Enums']['wait_feedback'] | null;
          id?: string;
          item_count: number;
          last_called_at?: string | null;
          paid_at?: string | null;
          payment_expires_at?: string | null;
          picked_up_at?: string | null;
          picked_up_by?: string | null;
          pickup_at?: string | null;
          queue_label?: string | null;
          queue_no?: number | null;
          queued_at?: string | null;
          ready_at?: string | null;
          refund_method?: Database['public']['Enums']['payment_method'] | null;
          release_at?: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at?: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang?: number | null;
        };
        Update: {
          allergy_note?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          customer_name?: string;
          day?: string | null;
          estimated_wait_seconds?: number | null;
          feedback?: Database['public']['Enums']['wait_feedback'] | null;
          id?: string;
          item_count?: number;
          last_called_at?: string | null;
          paid_at?: string | null;
          payment_expires_at?: string | null;
          picked_up_at?: string | null;
          picked_up_by?: string | null;
          pickup_at?: string | null;
          queue_label?: string | null;
          queue_no?: number | null;
          queued_at?: string | null;
          ready_at?: string | null;
          refund_method?: Database['public']['Enums']['payment_method'] | null;
          release_at?: string | null;
          shop_id?: string;
          source?: Database['public']['Enums']['order_source'];
          started_at?: string | null;
          status?: Database['public']['Enums']['order_status'];
          total_satang?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount_satang: number;
          confirmed_at: string | null;
          created_at: string;
          id: string;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          status: string;
        };
        Insert: {
          amount_satang: number;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          status?: string;
        };
        Update: {
          amount_satang?: number;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          method?: Database['public']['Enums']['payment_method'];
          order_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          role: Database['public']['Enums']['user_role'];
          shop_id: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          role?: Database['public']['Enums']['user_role'];
          shop_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          role?: Database['public']['Enums']['user_role'];
          shop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      shop_daily_counters: {
        Row: {
          day: string;
          last_no: number;
          shop_id: string;
        };
        Insert: {
          day: string;
          last_no?: number;
          shop_id: string;
        };
        Update: {
          day?: string;
          last_no?: number;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shop_daily_counters_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };
      shops: {
        Row: {
          allow_allergy_note: boolean;
          allow_item_note: boolean;
          auto_advance: boolean;
          busy_level: string;
          category: string;
          est_wait_seconds: number;
          id: string;
          is_open: boolean;
          items_in_queue: number;
          learned_seconds_per_item: number | null;
          manual_seconds_per_item: number;
          name: string;
          queue_prefix: string;
          slug: string;
          stats_updated_at: string | null;
          updated_at: string;
          wait_mode: Database['public']['Enums']['wait_mode'];
        };
        Insert: {
          allow_allergy_note?: boolean;
          allow_item_note?: boolean;
          auto_advance?: boolean;
          busy_level?: string;
          category: string;
          est_wait_seconds?: number;
          id?: string;
          is_open?: boolean;
          items_in_queue?: number;
          learned_seconds_per_item?: number | null;
          manual_seconds_per_item: number;
          name: string;
          queue_prefix: string;
          slug: string;
          stats_updated_at?: string | null;
          updated_at?: string;
          wait_mode?: Database['public']['Enums']['wait_mode'];
        };
        Update: {
          allow_allergy_note?: boolean;
          allow_item_note?: boolean;
          auto_advance?: boolean;
          busy_level?: string;
          category?: string;
          est_wait_seconds?: number;
          id?: string;
          is_open?: boolean;
          items_in_queue?: number;
          learned_seconds_per_item?: number | null;
          manual_seconds_per_item?: number;
          name?: string;
          queue_prefix?: string;
          slug?: string;
          stats_updated_at?: string | null;
          updated_at?: string;
          wait_mode?: Database['public']['Enums']['wait_mode'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abandon_order: { Args: { p_order_id: string }; Returns: undefined };
      add_quick_walk_in: {
        Args: { p_item_count?: number; p_shop_id: string };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      advance_simulated_orders: { Args: never; Returns: undefined };
      assign_queue_number: { Args: { p_shop_id: string }; Returns: number };
      confirm_payment: {
        Args: {
          p_method: Database['public']['Enums']['payment_method'];
          p_order_id: string;
        };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cron_tick: { Args: never; Returns: undefined };
      current_day: { Args: never; Returns: string };
      current_role_name: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      current_vendor_shop: { Args: never; Returns: string };
      insert_order: {
        Args: {
          p_allergy_note?: string;
          p_customer_id: string;
          p_customer_name: string;
          p_items: Json;
          p_pickup_at?: string;
          p_release_at?: string;
          p_shop_id: string;
          p_source: Database['public']['Enums']['order_source'];
          p_total_satang: number;
        };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      log_event: {
        Args: {
          p_actor: Database['public']['Enums']['user_role'];
          p_name: string;
          p_order_id: string;
          p_props?: Json;
          p_shop_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      mark_received: { Args: { p_order_id: string }; Returns: undefined };
      queue_order: {
        Args: { p_order_id: string };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refresh_shop_stats: { Args: { p_shop_id: string }; Returns: undefined };
      shop_seconds_per_item: { Args: { p_shop_id: string }; Returns: number };
      submit_feedback: {
        Args: {
          p_feedback: Database['public']['Enums']['wait_feedback'];
          p_order_id: string;
        };
        Returns: undefined;
      };
      vendor_delete_menu: {
        Args: { p_menu_id: string; p_shop_id: string };
        Returns: string;
      };
      vendor_recall_order: {
        Args: { p_order_id: string; p_shop_id: string };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      vendor_save_menu: {
        Args: { p_menu: Json; p_shop_id: string };
        Returns: string;
      };
      vendor_set_order_status: {
        Args: {
          p_order_id: string;
          p_reason?: string;
          p_shop_id: string;
          p_status: Database['public']['Enums']['order_status'];
        };
        Returns: {
          allergy_note: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          day: string | null;
          estimated_wait_seconds: number | null;
          feedback: Database['public']['Enums']['wait_feedback'] | null;
          id: string;
          item_count: number;
          last_called_at: string | null;
          paid_at: string | null;
          payment_expires_at: string | null;
          picked_up_at: string | null;
          picked_up_by: string | null;
          pickup_at: string | null;
          queue_label: string | null;
          queue_no: number | null;
          queued_at: string | null;
          ready_at: string | null;
          refund_method: Database['public']['Enums']['payment_method'] | null;
          release_at: string | null;
          shop_id: string;
          source: Database['public']['Enums']['order_source'];
          started_at: string | null;
          status: Database['public']['Enums']['order_status'];
          total_satang: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      option_group_kind: 'variant' | 'tiered' | 'choice' | 'remove' | 'toppings';
      order_source: 'app' | 'walk_in_quick' | 'walk_in_full' | 'simulated';
      order_status:
        | 'awaiting_payment'
        | 'expired'
        | 'abandoned'
        | 'queued'
        | 'cooking'
        | 'ready'
        | 'picked_up'
        | 'cancelled';
      payment_method: 'demo' | 'cash';
      user_role: 'customer' | 'vendor' | 'admin';
      wait_feedback: 'faster' | 'accurate' | 'slower';
      wait_mode: 'auto' | 'manual';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      option_group_kind: ['variant', 'tiered', 'choice', 'remove', 'toppings'],
      order_source: ['app', 'walk_in_quick', 'walk_in_full', 'simulated'],
      order_status: [
        'awaiting_payment',
        'expired',
        'abandoned',
        'queued',
        'cooking',
        'ready',
        'picked_up',
        'cancelled',
      ],
      payment_method: ['demo', 'cash'],
      user_role: ['customer', 'vendor', 'admin'],
      wait_feedback: ['faster', 'accurate', 'slower'],
      wait_mode: ['auto', 'manual'],
    },
  },
} as const;
