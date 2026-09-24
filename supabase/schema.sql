-- Ejecutar en el editor SQL de Supabase (SQL > New query)
create table if not exists app_data (
  clave text primary key,
  valor text not null,
  actualizado_en timestamptz not null default now()
);

alter table app_data enable row level security;

-- El proyecto usa una clave anon publica de solo lectura/escritura en esta tabla.
drop policy if exists "lectura publica app_data" on app_data;
create policy "lectura publica app_data" on app_data
  for select using (true);

drop policy if exists "escritura publica app_data" on app_data;
create policy "escritura publica app_data" on app_data
  for insert with check (true);

drop policy if exists "actualizacion publica app_data" on app_data;
create policy "actualizacion publica app_data" on app_data
  for update using (true);