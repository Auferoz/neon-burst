-- Separa "terminé la historia" de "conseguí el 100% de los logros".
--
-- Hasta ahora "Completado" significaba las dos cosas a la vez. Pasa a significar
-- solo el 100% de logros, y el nuevo estado "Terminado" toma el significado de
-- haber terminado la campaña.
--
-- Paso 1: todo lo que estaba en Completado es, como mínimo, Terminado.
UPDATE games SET estado = 'Terminado', updated_at = datetime('now')
WHERE estado = 'Completado';

-- Paso 2: de esos, los que ya tienen todos los logros vuelven a Completado con
-- el significado nuevo. Se excluyen los que no tienen logros registrados
-- (logros_total = 0), que si no darían un falso 100%.
UPDATE games SET estado = 'Completado', updated_at = datetime('now')
WHERE estado = 'Terminado'
  AND logros_total > 0
  AND logros_obt >= logros_total;
