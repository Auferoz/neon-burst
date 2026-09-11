-- Mi puntuación personal de cada juego, en la misma escala 0-100 que
-- rating_metacritic y rating_opencritic para que la fila de ratings se lea
-- homogénea.
--
-- Nace en NULL para todos: se carga a mano desde el modal, juego por juego.
-- El detalle no renderiza el bloque mientras el valor sea NULL.
ALTER TABLE games ADD COLUMN rating_personal INTEGER;
