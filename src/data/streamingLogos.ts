/**
 * Sprite de logos de streaming: public/Logos_Streaming.png contiene los 7 logos
 * en una fila sobre fondo negro.
 *
 * Las cajas se midieron sobre los píxeles del PNG (columnas no negras, agrupadas
 * con tolerancia de hueco para no partir "HBO/max" ni la manzana de "tv"), no a ojo.
 *
 * Si cambias la imagen, actualiza SPRITE_WIDTH/SPRITE_HEIGHT y las cajas juntas:
 * son coordenadas en píxeles del archivo, no proporciones.
 */

export const SPRITE_SRC = '/Logos_Streaming.png';
export const SPRITE_WIDTH = 887;
export const SPRITE_HEIGHT = 90;

export interface LogoRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Clave = `streaming_accounts.name` exacto. */
export const STREAMING_LOGO_SPRITE: Record<string, LogoRect> = {
	'Netflix': { x: 36, y: 2, w: 49, h: 87 },
	'Disney+': { x: 112, y: 5, w: 144, h: 79 },
	'Crunchyroll': { x: 274, y: 0, w: 84, h: 90 },
	'HBO Max': { x: 389, y: 13, w: 90, h: 68 },
	'Amazon Prime Video': { x: 512, y: 18, w: 92, h: 65 },
	'Apple TV+': { x: 636, y: 17, w: 99, h: 52 },
	'Paramount+': { x: 751, y: 7, w: 112, h: 76 },
};

export interface SpriteStyle {
	/** Ancho final del elemento, ya escalado. */
	width: number;
	/** Alto final del elemento, ya escalado. */
	height: number;
	/** Valor listo para el atributo style. */
	css: string;
}

/**
 * Calcula el recorte para encajar un logo dentro de boxW x boxH.
 *
 * El elemento se dimensiona **exactamente** al recorte escalado en vez de
 * ocupar toda la caja: si sobrara espacio, el background dejaría ver los logos
 * contiguos del sprite. Centrarlo es cosa del contenedor (flex).
 */
export function getLogoSprite(name: string, boxW: number, boxH: number): SpriteStyle | null {
	const rect = STREAMING_LOGO_SPRITE[name];
	if (!rect) return null;

	const scale = Math.min(boxW / rect.w, boxH / rect.h);
	const round = (n: number) => Math.round(n * 100) / 100;

	const width = round(rect.w * scale);
	const height = round(rect.h * scale);

	const css = [
		`width:${width}px`,
		`height:${height}px`,
		`background-image:url('${SPRITE_SRC}')`,
		`background-size:${round(SPRITE_WIDTH * scale)}px ${round(SPRITE_HEIGHT * scale)}px`,
		`background-position:-${round(rect.x * scale)}px -${round(rect.y * scale)}px`,
		'background-repeat:no-repeat',
	].join(';');

	return { width, height, css };
}
