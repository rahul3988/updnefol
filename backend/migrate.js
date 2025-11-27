// Database Migration Script
require('dotenv/config');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nefol';
const pool = new Pool({ connectionString });

async function runMigration() {
  console.log('🔄 Running database migration...');
  
  try {
    // Create all tables
    await pool.query(`
      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id serial primary key,
        title text not null,
        slug text unique,
        category text default '',
        price text default '',
        list_image text default '',
        description text default '',
        details jsonb default '{}'::jsonb,
        brand text default '',
        key_ingredients text default '',
        skin_type text default '',
        hair_type text default '',
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id serial primary key,
        name text not null,
        email text unique not null,
        password text not null,
        phone text,
        address jsonb,
        profile_photo text,
        loyalty_points integer default 0,
        total_orders integer default 0,
        member_since timestamptz default now(),
        is_verified boolean default false,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- Blog posts table
      CREATE TABLE IF NOT EXISTS blog_posts (
        id serial primary key,
        title text not null,
        excerpt text not null,
        content text not null,
        author_name text not null,
        author_email text not null,
        images jsonb default '[]'::jsonb,
        status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
        featured boolean default false,
        rejection_reason text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- CMS pages table
      CREATE TABLE IF NOT EXISTS cms_pages (
        id serial primary key,
        slug text unique not null,
        title text not null,
        content jsonb default '{}'::jsonb,
        meta_description text,
        is_active boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- CMS sections table
      CREATE TABLE IF NOT EXISTS cms_sections (
        id serial primary key,
        page_id integer not null references cms_pages(id) on delete cascade,
        section_type text not null,
        title text,
        content jsonb default '{}'::jsonb,
        order_index integer default 0,
        is_active boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id serial primary key,
        order_number text unique not null,
        customer_name text not null,
        customer_email text not null,
        shipping_address jsonb not null,
        items jsonb not null,
        subtotal numeric(12,2) not null,
        shipping numeric(12,2) not null default 0,
        tax numeric(12,2) not null default 0,
        total numeric(12,2) not null,
        status text not null default 'created',
        payment_method text,
        payment_type text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- Cart table
      CREATE TABLE IF NOT EXISTS cart (
        id serial primary key,
        user_id integer not null references users(id) on delete cascade,
        product_id integer not null references products(id) on delete cascade,
        quantity integer not null default 1,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        unique(user_id, product_id)
      );
      
      -- Wishlist table
      CREATE TABLE IF NOT EXISTS wishlist (
        id serial primary key,
        user_id integer not null references users(id) on delete cascade,
        product_id integer not null references products(id) on delete cascade,
        created_at timestamptz default now(),
        unique(user_id, product_id)
      );
      
      -- WhatsApp Chat Sessions
      CREATE TABLE IF NOT EXISTS whatsapp_chat_sessions (
        id serial primary key,
        customer_name text not null,
        customer_phone text not null unique,
        customer_email text,
        status text not null default 'active',
        priority text not null default 'medium',
        assigned_agent text,
        last_message text,
        last_message_time timestamptz,
        message_count integer default 0,
        tags text[],
        notes text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- WhatsApp Templates
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id serial primary key,
        name text not null,
        category text not null,
        content text not null,
        variables text[],
        is_approved boolean default false,
        scheduled_date timestamptz,
        scheduled_time text,
        is_scheduled boolean default false,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- WhatsApp Automations
      CREATE TABLE IF NOT EXISTS whatsapp_automations (
        id serial primary key,
        name text not null,
        trigger text not null,
        condition text,
        action text not null,
        template_id integer references whatsapp_templates(id) on delete set null,
        scheduled_date timestamptz,
        scheduled_time text,
        is_scheduled boolean default false,
        is_active boolean default false,
        messages_sent integer default 0,
        response_rate numeric(5,2) default 0,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- WhatsApp Scheduled Messages
      CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
        id serial primary key,
        template_id integer references whatsapp_templates(id) on delete set null,
        automation_id integer references whatsapp_automations(id) on delete set null,
        phone text not null,
        message text not null,
        scheduled_at timestamptz not null,
        status text default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
        sent_at timestamptz,
        error_message text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- WhatsApp Configuration
      CREATE TABLE IF NOT EXISTS whatsapp_config (
        id serial primary key,
        access_token text,
        phone_number_id text,
        business_account_id text,
        webhook_url text,
        verify_token text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      
      -- WhatsApp Incoming Messages Log
      CREATE TABLE IF NOT EXISTS whatsapp_incoming_messages (
        id serial primary key,
        message_id text unique not null,
        from_phone text not null,
        to_phone text,
        message_type text not null,
        message_text text,
        media_url text,
        timestamp timestamptz not null,
        status text default 'received' check (status in ('received', 'processed', 'replied')),
        raw_payload jsonb,
        created_at timestamptz default now()
      );
      
      -- WhatsApp Message Status Tracking
      CREATE TABLE IF NOT EXISTS whatsapp_message_status (
        id serial primary key,
        message_id text not null,
        status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
        timestamp timestamptz not null,
        error_code text,
        error_message text,
        created_at timestamptz default now()
      );
      
      -- WhatsApp Subscriptions
      CREATE TABLE IF NOT EXISTS whatsapp_subscriptions (
        id serial primary key,
        phone text not null unique,
        name text,
        subscribed_at timestamptz default now(),
        unsubscribed_at timestamptz,
        is_active boolean default true,
        source text,
        metadata jsonb,
        verification_code text,
        verified_at timestamptz
      );
      
      -- WhatsApp Chat (legacy/alternative table)
      CREATE TABLE IF NOT EXISTS whatsapp_chat (
        id serial primary key,
        phone_number text not null,
        session_id text,
        status text not null default 'active',
        last_message text,
        last_message_time timestamptz,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
      CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured);
      CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);
      CREATE INDEX IF NOT EXISTS idx_cms_sections_page_id ON cms_sections(page_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
      
      -- WhatsApp indexes
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_phone ON whatsapp_chat_sessions(customer_phone);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_sessions_status ON whatsapp_chat_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_status ON whatsapp_scheduled_messages(status);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_scheduled_at ON whatsapp_scheduled_messages(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_messages_from_phone ON whatsapp_incoming_messages(from_phone);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_messages_timestamp ON whatsapp_incoming_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_messages_status ON whatsapp_incoming_messages(status);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_message_status_message_id ON whatsapp_message_status(message_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_message_status_status ON whatsapp_message_status(status);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_message_status_timestamp ON whatsapp_message_status(timestamp);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_subscriptions_phone ON whatsapp_subscriptions(phone);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_subscriptions_active ON whatsapp_subscriptions(is_active);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_phone ON whatsapp_chat(phone_number);
    `);
    
    // Create trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS trigger AS $$ 
      BEGIN 
        new.updated_at = now(); 
        return new; 
      END; 
      $$ language plpgsql;
    `);
    
    // Add triggers
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
      CREATE TRIGGER trg_products_updated_at 
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
      CREATE TRIGGER trg_users_updated_at 
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
      CREATE TRIGGER trg_blog_posts_updated_at 
        BEFORE UPDATE ON blog_posts
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_cms_pages_updated_at ON cms_pages;
      CREATE TRIGGER trg_cms_pages_updated_at 
        BEFORE UPDATE ON cms_pages
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_cms_sections_updated_at ON cms_sections;
      CREATE TRIGGER trg_cms_sections_updated_at 
        BEFORE UPDATE ON cms_sections
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
      CREATE TRIGGER trg_orders_updated_at 
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_cart_updated_at ON cart;
      CREATE TRIGGER trg_cart_updated_at 
        BEFORE UPDATE ON cart
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_chat_sessions_updated_at ON whatsapp_chat_sessions;
      CREATE TRIGGER trg_whatsapp_chat_sessions_updated_at 
        BEFORE UPDATE ON whatsapp_chat_sessions
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON whatsapp_templates;
      CREATE TRIGGER trg_whatsapp_templates_updated_at 
        BEFORE UPDATE ON whatsapp_templates
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_automations_updated_at ON whatsapp_automations;
      CREATE TRIGGER trg_whatsapp_automations_updated_at 
        BEFORE UPDATE ON whatsapp_automations
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_scheduled_messages_updated_at ON whatsapp_scheduled_messages;
      CREATE TRIGGER trg_whatsapp_scheduled_messages_updated_at 
        BEFORE UPDATE ON whatsapp_scheduled_messages
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_config_updated_at ON whatsapp_config;
      CREATE TRIGGER trg_whatsapp_config_updated_at 
        BEFORE UPDATE ON whatsapp_config
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
        
      DROP TRIGGER IF EXISTS trg_whatsapp_chat_updated_at ON whatsapp_chat;
      CREATE TRIGGER trg_whatsapp_chat_updated_at 
        BEFORE UPDATE ON whatsapp_chat
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    `);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
