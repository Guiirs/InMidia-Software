function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isValidLatitude(value) {
  return value !== null && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return value !== null && value >= -180 && value <= 180;
}

function normalizePair(latitude, longitude, source) {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { latitude: lat, longitude: lng, hasCoordinates: true, source };
}

function normalizeObject(input, sourcePrefix) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const latLng = normalizePair(input.lat, input.lng ?? input.lon, `${sourcePrefix}.lat/lng`);
  if (latLng) return latLng;

  return normalizePair(input.latitude, input.longitude, `${sourcePrefix}.latitude/longitude`);
}

function normalizeGeoJsonArray(input, source) {
  if (!Array.isArray(input) || input.length < 2) return null;
  return normalizePair(input[1], input[0], source);
}

function normalizeCoordinateString(input, source) {
  if (typeof input !== 'string' || !input.includes(',')) return null;
  const [latitude, longitude] = input.split(',').map((part) => part.trim());
  return normalizePair(latitude, longitude, source);
}

export function normalizeBoardCoordinates(board = {}) {
  const direct = normalizePair(board.latitude, board.longitude, 'latitude/longitude');
  if (direct) return direct;

  const short = normalizePair(board.lat, board.lng ?? board.lon, 'lat/lng');
  if (short) return short;

  const coordinates = normalizeObject(board.coordinates, 'coordinates');
  if (coordinates) return coordinates;

  const coordenadasObject = normalizeObject(board.coordenadas, 'coordenadas');
  if (coordenadasObject) return coordenadasObject;

  const coordenadasString = normalizeCoordinateString(board.coordenadas, 'coordenadas:string');
  if (coordenadasString) return coordenadasString;

  const localizacaoGeoJson = normalizeGeoJsonArray(board.localizacao?.coordinates, 'localizacao.coordinates');
  if (localizacaoGeoJson) return localizacaoGeoJson;

  const locationGeoJson = normalizeGeoJsonArray(board.location?.coordinates, 'location.coordinates');
  if (locationGeoJson) return locationGeoJson;

  const geoGeoJson = normalizeGeoJsonArray(board.geo?.coordinates, 'geo.coordinates');
  if (geoGeoJson) return geoGeoJson;

  return { latitude: null, longitude: null, hasCoordinates: false, source: null };
}

export function formatBoardCoordinates(board = {}) {
  const coords = normalizeBoardCoordinates(board);
  return coords.hasCoordinates ? `${coords.latitude},${coords.longitude}` : null;
}
