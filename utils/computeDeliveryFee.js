import axios from 'axios';

export const computeDeliveryFee = async ({ restaurantLocation, destinationLocation, deliveryVehicle }) => {
  if (!destinationLocation?.lat || !destinationLocation?.lng) {
    throw new Error('Delivery coordinates are required.');
  }

  const origins = `${restaurantLocation.lng},${restaurantLocation.lat}`; // OSRM uses lng,lat
  const destinations = `${destinationLocation.lng},${destinationLocation.lat}`;
  const mode = deliveryVehicle === 'Bicycle' ? 'bike' : 'driving'; // OSRM modes: driving, bike, foot
  const osrmUrl = `https://router.project-osrm.org/route/v1/${mode}/${origins};${destinations}?overview=false`;
  const osrmResponse = await axios.get(osrmUrl);
  const distanceInMeters = osrmResponse?.data?.routes?.[0]?.distance;
  const durationInSeconds = osrmResponse?.data?.routes?.[0]?.duration;
  if (!distanceInMeters) {
    throw new Error('Failed to calculate delivery distance.');
  }
  const distanceKm = distanceInMeters / 1000;

  const rateConfig = {
    Car: {
      base: parseFloat(process.env.CAR_BASE_FARE || '150'),
      perKm: parseFloat(process.env.CAR_PER_KM || '13'),
    },
    Motor: {
      base: parseFloat(process.env.MOTOR_BASE_FARE || '100'),
      perKm: parseFloat(process.env.MOTOR_PER_KM || '10'),
    },
    Bicycle: {
      base: parseFloat(process.env.BICYCLE_BASE_FARE || '50'),
      perKm: parseFloat(process.env.BICYCLE_PER_KM || '10'),
    },
  };
  const selectedRate = rateConfig[deliveryVehicle];
  if (!selectedRate) {
    console.log('Available vehicle types:', Object.keys(rateConfig));
    console.log('Requested vehicle type:', deliveryVehicle, 'Type:', typeof deliveryVehicle);
    throw new Error(`Invalid vehicle type: ${deliveryVehicle}. Allowed types: ${Object.keys(rateConfig).join(', ')}`);
  }
  const rawFee = selectedRate.base + selectedRate.perKm * distanceKm;
  const deliveryFee = Math.ceil(rawFee);

  return { deliveryFee, distanceKm, durationInSeconds, distanceInMeters, rate: selectedRate, destination: destinationLocation };
};