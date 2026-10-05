-- Partido ganado por W (walkover): el rival no se presentó.
--
-- Se guarda QUIÉN ganó, no un marcador: un W no tiene games ni sets, y
-- escribirle un 6-0 falsearía los desempates (la tabla desempata por % de
-- sets y games, así que un marcador inventado le daría ventaja real a quien
-- ganó sin jugar).
--
-- El que gana suma el partido y los puntos; el que no se presentó no suma
-- nada, ni siquiera el partido jugado — y por eso su % de participación baja,
-- que es la consecuencia de no presentarse.

alter table partidos
    add column if not exists walkover_ganador_id uuid references parejas(id);

comment on column partidos.walkover_ganador_id is
    'Si está, el partido se ganó por W (el rival no se presentó) y esta es la pareja ganadora. El marcador queda en "W.O.".';
