import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
export const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  admin: "20000000-0000-4000-8000-000000000002",
  game: "30000000-0000-4000-8000-000000000001",
  category: "40000000-0000-4000-8000-000000000001",
  a: "50000000-0000-4000-8000-000000000001",
  b: "50000000-0000-4000-8000-000000000002",
  combo: "60000000-0000-4000-8000-000000000001",
};
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.admins(user_id uuid primary key references auth.users(id),role text not null);
 create table public.games(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,is_active boolean not null default true);
 create table public.categories(id uuid primary key default gen_random_uuid(),game_id uuid references public.games(id),name text not null,slug text not null,unique(game_id,slug));
 create table public.products(id uuid primary key default gen_random_uuid(),category_id uuid references public.categories(id),name text not null,slug text not null unique,description text,price numeric(12,2) not null,stock integer not null default 0,unlimited_stock boolean not null default false,is_active boolean not null default false,image_url text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
 create publication supabase_realtime;
 `);
  const root = join(process.cwd(), "supabase/migrations");
  for (const file of (await readdir(root))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = (await readFile(join(root, file), "utf8")).replace(
      /create extension if not exists pgcrypto;/gi,
      "",
    );
    try {
      await db.exec(sql);
      // Verify rerunnable historical migrations at their original place in the
      // sequence; never overwrite newer production functions at the end.
      if (["202609300001_store_refinement.sql", "202610040003_store_operations.sql"].includes(file)) await db.exec(sql);
    } catch (error) {
      throw new Error(
        `${file}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  await db.exec(
    `insert into auth.users(id,email) values('${ids.user}','cliente@example.invalid'),('${ids.admin}','owner@example.invalid');insert into public.admins values('${ids.admin}','owner');insert into public.games(id,name,slug) values('${ids.game}','Blox Fruits','blox-fruits');insert into public.categories(id,name,slug,game_id) values('${ids.category}','Permanentes','permanentes','${ids.game}');insert into public.products(id,name,slug,category_id,price,stock,is_active) values('${ids.a}','Dragon','dragon','${ids.category}',20,10,true),('${ids.b}','Buddha','buddha','${ids.category}',30,10,true);insert into public.combos(id,name,slug,price,compare_at_price,is_active) values('${ids.combo}','Dupla','dupla',40,50,true);insert into public.combo_items values('${ids.combo}','${ids.a}',1),('${ids.combo}','${ids.b}',1);`,
  );
  return db;
}
