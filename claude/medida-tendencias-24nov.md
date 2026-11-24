# Las tendencias, medidas con los datos públicos (24 nov)

Fran, 24 nov: «la app sigue sin entender las tendencias». No dijo con qué jugador. En vez de adivinarlo, se ha medido la
inercia del motor con el valor de todos los jugadores de LaLiga, que la API da sin sesión.

Cómo: `node .github/ia/medir-inercia-publico.mjs <carpeta-caché> [desde] [valor mínimo en M]`. Baja la lista de jugadores,
el valor de cada uno día a día y las jornadas con sus fechas, monta una liga vacía y le pasa la misma medida de la inercia
de medir-motor.mjs: para cada día, lo que el motor habría dicho (fase y lo esperado a 3 y 7 días) frente a lo que pasó.
No hay nada de ninguna liga.

Datos: 373 jugadores de 1,5 M o más, del 20 sep al 16 nov, 16.862 jugador-días.

## Lo que sale

Acierta hacia dónde va el 90 % de las veces a 7 días (83 % en los de más de 30 M, 90 % de 10 a 30 M, 93 % de 3 a 10 M).
Error medio a 7 días: 4,4 % del valor (939 mil), frente a 2,1 M de decir «se queda como está» y 1,4 M de «la mitad de lo de
la semana pasada».

| lo que dice | casos | bajó a 7 días | subió | real 7 d | esperado 7 d | real 3 d | esperado 3 d |
|---|---|---|---|---|---|---|---|
| acelera | 2.264 | 9 % | 90 % | +16,1 % | +15,7 % | +7,4 % | +7,3 % |
| sube | 2.313 | 15 % | 85 % | +10,9 % | +10,5 % | +5,3 % | +5,0 % |
| se frena | 771 | 35 % | 63 % | +3,7 % | +4,3 % | +2,3 % | +2,4 % |
| parado | 151 | 60 % | 35 % | −1,7 % | −3,9 % | −0,8 % | −1,4 % |
| ha girado | 797 | 87 % | 12 % | −7,0 % | −7,2 % | −3,4 % | −3,5 % |
| baja | 9.257 | 93 % | 7 % | −9,6 % | −8,2 % | −4,7 % | −4,3 % |
| plano | 1.210 | 53 % | 40 % | +0,5 % | −0,4 % | −0,2 % | −0,3 % |
| rebote | 99 | 55 % | 42 % | +0,8 % | +1,7 % | +0,7 % | +1,0 % |

Errores gordos de dirección: dice que sube y en 7 días ha bajado más de un 3 %, el 7 % de las veces (4.577 casos); dice que
baja y ha subido más de un 3 %, el 5 % (10.054).

## Lo que estaba mal: el primer día de un giro

El día que baja por primera vez uno que venía subiendo (lo de Bernardo Silva el 24 nov: +390, +387, +58 y −169 mil), la
app proyectaba con lo de ese día, y ese día el jugador acaba de cruzar el cero. Con 287 casos:

- ese primer día baja un 0,6 % de media; los siete siguientes, entre un 0,9 % y un 1,2 % cada día;
- la app esperaba −1,6 % en 3 días y −3,4 % en 7, y fueron −3,5 % y −7,4 % (el 93 % y el 87 % bajaron).

La dirección la acertaba; la cantidad se quedaba en la mitad. Desde el segundo día de bajada ya acertaba (sesgo de +0,2 y
−0,2 puntos a 3 días).

Arreglo (motor.js, `r0` en `M.inercia`): el primer día de un giro, el ritmo de partida es lo de hoy más el 70 % de lo que
se ha frenado desde ayer, sin pasar de un 2 % del valor al día. El resto, igual (el 6 % que pierde de ritmo cada día sigue
como se midió el 21 nov con la liga de Carlos).

| primer día de giro | error 3 d | sesgo 3 d | error 7 d | sesgo 7 d |
|---|---|---|---|---|
| antes | 2,08 | +1,50 | 5,42 | +3,19 |
| ahora | 1,39 | −0,01 | 3,94 | +0,05 |

(en puntos del valor). Aguanta partido en dos: hasta el 20 oct, sesgo a 7 días de +3,04 a +0,26; desde el 20 oct, de +2,87 a
−0,14. Y por precio: más de 20 M, de +3,44 a +0,89; menos, de +2,43 a −0,86. Con el motor de verdad, el primer día de giro
pasa de esperar −3,4 % en 7 días a −6,9 % (real −7,4 %), y el total, de 948 a 939 mil de error a 7 días.

Con Bernardo: de «unos −580 mil hasta la jornada» a algo más de 1 M.

## Lo que queda sin tocar

- «Parado» (se estanca después de subir): la app espera −3,9 % en 7 días y son −1,7 %; el 35 % vuelve a subir. Son 151 casos:
  pocos para ajustar nada. Si se toca, medirlo antes con la liga de Carlos (medir-motor.mjs) además de con esto.
- «Baja»: se queda algo corta (−8,2 % esperado, −9,6 % real). El ritmo es el de siempre (pierde un 10 % cada día).
- Los errores más gordos son giros de un día para otro en jugadores caros que subían (Cuti Romero, 19 oct: esperaba +0,9 M
  y fueron −11,2 M; Nico Williams, 2 oct: +1,7 M y −10,1 M). Eso es una lesión, una sanción o un mal partido: la inercia
  sola no lo ve. Esta medida va sin los puntos de cada partido con su hora en la jornada en juego, que el motor de la app
  sí usa.
- No se sabe qué jugador miraba Fran. Si lo dice, se mira su caso con su día.
