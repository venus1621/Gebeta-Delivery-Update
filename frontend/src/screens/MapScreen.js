import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapScreen({ restaurantLocation, deliveryLocation, routeCoords, fitMarkersTrigger }) {
  const mapRef = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const initialRegion = useMemo(() => {
    const latitude = driverLocation?.lat ?? restaurantLocation?.lat ?? 9.03;
    const longitude = driverLocation?.lng ?? restaurantLocation?.lng ?? 38.74;
    return {
      latitude,
      longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [driverLocation, restaurantLocation]);

  // request location and subscribe once
  useEffect(() => {
    let subscription;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setDriverLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
        (pos) => setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      );
    })();
    return () => { if (subscription) subscription.remove(); };
  }, []);

  // fit markers when triggered (on cooked order)
  useEffect(() => {
    if (!mapRef.current) return;
    const points = [];
    if (driverLocation) points.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
    if (restaurantLocation) points.push({ latitude: restaurantLocation.lat, longitude: restaurantLocation.lng });
    if (deliveryLocation?.lat && deliveryLocation?.lng) points.push({ latitude: deliveryLocation.lat, longitude: deliveryLocation.lng });
    if (points.length >= 2) {
      mapRef.current.fitToCoordinates(points, { edgePadding: { top: 80, right: 80, bottom: 300, left: 80 }, animated: true });
    }
  }, [fitMarkersTrigger, driverLocation, restaurantLocation, deliveryLocation]);

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title="You"
          />
        )}
        {restaurantLocation && (
          <Marker
            coordinate={{ latitude: restaurantLocation.lat, longitude: restaurantLocation.lng }}
            title="Restaurant"
            pinColor="#ef4444"
          />
        )}
        {deliveryLocation?.lat && deliveryLocation?.lng && (
          <Marker
            coordinate={{ latitude: deliveryLocation.lat, longitude: deliveryLocation.lng }}
            title="Delivery"
            pinColor="#10b981"
          />
        )}
        {routeCoords && routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor="#2563eb" strokeWidth={4} />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
});


