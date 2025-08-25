// Simple OSRM polyline fetcher using the public demo server

export async function fetchRoutePolyline({ origin, destination, mode = 'driving' }) {
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    throw new Error('Invalid coordinates');
  }
  const url = `https://router.project-osrm.org/route/v1/${mode}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline6`;
  const resp = await fetch(url);
  const data = await resp.json();
  const route = data?.routes?.[0];
  if (!route) return null;
  return {
    polyline: route.geometry,
    distance: route.distance,
    duration: route.duration,
  };
}

// Polyline6 decoder (OSRM polyline6)
// Adapted minimal decoder for RN maps Polyline
export function decodePolyline6(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0, coordinates = [];
  const shift = 0, result = 0;

  const factor = 1e-6;
  while (index < encoded.length) {
    let b, shiftLocal = 0, resultLat = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      resultLat |= (b & 0x1f) << shiftLocal;
      shiftLocal += 5;
    } while (b >= 0x20);
    const deltaLat = (resultLat & 1) ? ~(resultLat >> 1) : (resultLat >> 1);
    lat += deltaLat;

    shiftLocal = 0;
    let resultLng = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      resultLng |= (b & 0x1f) << shiftLocal;
      shiftLocal += 5;
    } while (b >= 0x20);
    const deltaLng = (resultLng & 1) ? ~(resultLng >> 1) : (resultLng >> 1);
    lng += deltaLng;

    coordinates.push({ latitude: lat * factor, longitude: lng * factor });
  }
  return coordinates;
}


