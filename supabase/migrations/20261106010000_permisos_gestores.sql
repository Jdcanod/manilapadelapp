-- Funciones que el club le asigna a cada gestor.
--
-- Un permiso único era demasiado grueso: quien solo carga resultados no
-- tiene por qué poder sortear los grupos. Ahora el club marca, por persona,
-- qué puede hacer.
--
-- Valores: resultados, programacion, parejas, sorteos.
-- El default deja a los gestores que ya existen con lo que tenían.

alter table torneo_gestores
    add column if not exists permisos text[] not null default '{resultados,programacion}';

comment on column torneo_gestores.permisos is
    'Funciones habilitadas: resultados (cargar/corregir/W), programacion (cancha y hora), parejas (inscribir y editar), sorteos (grupos y fases finales).';
