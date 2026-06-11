export function parsePlateCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePlateCoordinatePair(latitude, longitude) {
  const lat = parsePlateCoordinate(latitude);
  const lng = parsePlateCoordinate(longitude);
  const hasLatitude = latitude !== null && latitude !== undefined && String(latitude).trim() !== '';
  const hasLongitude = longitude !== null && longitude !== undefined && String(longitude).trim() !== '';

  if (!hasLatitude && !hasLongitude) {
    return { latitude: null, longitude: null, hasCoordinates: false, error: null };
  }

  if (lat === null || lng === null) {
    return {
      latitude: null,
      longitude: null,
      hasCoordinates: false,
      error: 'Informe latitude e longitude validas.',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      latitude: null,
      longitude: null,
      hasCoordinates: false,
      error: 'Latitude deve estar entre -90 e 90.',
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      latitude: null,
      longitude: null,
      hasCoordinates: false,
      error: 'Longitude deve estar entre -180 e 180.',
    };
  }

  return { latitude: lat, longitude: lng, hasCoordinates: true, error: null };
}

export function getPlateCoordinateFormValues(plate = {}) {
  const direct = normalizePlateCoordinatePair(plate.latitude, plate.longitude);
  if (direct.hasCoordinates) {
    return {
      latitude: String(direct.latitude),
      longitude: String(direct.longitude),
      coordenadas: `${direct.latitude},${direct.longitude}`,
    };
  }

  if (typeof plate.coordenadas === 'string' && plate.coordenadas.includes(',')) {
    const [latitude, longitude] = plate.coordenadas.split(',').map((part) => part.trim());
    const legacy = normalizePlateCoordinatePair(latitude, longitude);
    if (legacy.hasCoordinates) {
      return {
        latitude: String(legacy.latitude),
        longitude: String(legacy.longitude),
        coordenadas: `${legacy.latitude},${legacy.longitude}`,
      };
    }
  }

  return { latitude: '', longitude: '', coordenadas: '' };
}

export function appendPlateCoordinatesToFormData(formData, data) {
  const coords = normalizePlateCoordinatePair(data?.latitude, data?.longitude);
  if (coords.error) {
    throw new Error(coords.error);
  }

  if (!coords.hasCoordinates) return coords;

  formData.append('latitude', String(coords.latitude));
  formData.append('longitude', String(coords.longitude));
  formData.append('coordenadas', `${coords.latitude},${coords.longitude}`);
  return coords;
}

export function buildPlacaFormData(data, options = {}) {
  const formData = new FormData();
  const textFields = ['numero_placa', 'endereco', 'nomeDaRua', 'tamanho', 'regiaoId', 'regionalLot', 'notes', 'statusOperacional'];

  textFields.forEach((key) => {
    if (data?.[key] != null && data[key] !== '') formData.append(key, data[key]);
  });

  appendPlateCoordinatesToFormData(formData, data);

  const imageFile = data?.imagem?.[0];
  if (typeof File !== 'undefined' && imageFile instanceof File) {
    formData.append('imagem', imageFile);
  } else if (options.isEditMode && !options.imagePreview && options.initialImageUrl) {
    formData.append('imagem', '');
  }

  return formData;
}

export function invalidatePlacaCoordinateQueries(queryClient, placaId) {
  queryClient.invalidateQueries({ queryKey: ['placas'] });
  queryClient.invalidateQueries({ queryKey: ['placaLocations'] });
  queryClient.invalidateQueries({ queryKey: ['inventory'] });
  queryClient.invalidateQueries({ queryKey: ['inventory-v4'] });
  if (placaId) queryClient.invalidateQueries({ queryKey: ['placa', placaId] });
}
