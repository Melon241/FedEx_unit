import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, type MapPressEvent, type MapType } from 'react-native-maps';
import * as Location from 'expo-location';
import { createPin, deletePin, listPins, updatePin, type Pin } from '../api/pins';

type Destination = {
  id: string;
  name?: string;
  entranceLat?: number;
  entranceLng?: number;
};

type Coords = { latitude: number; longitude: number };

type Draft = {
  id?: string;
  latitude: number;
  longitude: number;
  name: string;
  notes: string;
  address: string;
  createdAt?: string;
  updatedAt?: string;
};

const formatAddress = (place?: Location.LocationGeocodedAddress) => {
  if (!place) return '';
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  const parts = [place.name, street, place.city, place.region, place.postalCode, place.country]
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(parts)).join(', ');
};

const distanceMeters = (a: Coords, b: Coords) => {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;

const formatTimestamp = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

type MapDisplayProps = {
  destination?: Destination | null;
  selectedPin?: Pin | null;
  query?: string;
  pins: Pin[];
  onPinsChanged?: () => Promise<void> | void;
};

export const MapDisplay = ({
  destination,
  selectedPin,
  query = '',
  pins,
  onPinsChanged,
}: MapDisplayProps) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [arrivalStatus, setArrivalStatus] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [isPinMode, setIsPinMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ignoreMapPress = useRef(false);
  const mapRef = useRef<MapView>(null);
  const focusedSelectionKey = useRef<string | null>(null);
  const destinationId = destination?.id;

  const initialRegion = {
    latitude: location?.coords.latitude ?? 0,
    longitude: location?.coords.longitude ?? 0,
    latitudeDelta: 0.05, // Wider view on initial load
    longitudeDelta: 0.05,
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visiblePins = normalizedQuery
    ? pins.filter(
        (pin) =>
          pin.name.toLowerCase().includes(normalizedQuery) ||
          (pin.address ?? '').toLowerCase().includes(normalizedQuery) ||
          pin.id === selectedPin?.id
      )
    : pins;

  const refreshPins = async () => {
    try {
      await onPinsChanged?.();
    } catch (err) {
      console.warn('Could not refresh saved pins', err);
      setError('Could not refresh saved pins. Is the server running?');
    }
  };

  const checkArrival = (coords: Coords) => {
    if (destination?.entranceLat == null || destination?.entranceLng == null) return;
    const dist = Math.sqrt(
      Math.pow(coords.latitude - destination.entranceLat, 2) +
        Math.pow(coords.longitude - destination.entranceLng, 2)
    );
    if (dist < 0.0001) {
      setArrivalStatus('Arrived at Destination!');
    }
  };

  const focusOnCoords = (coords: Coords) => {
    mapRef.current?.animateToRegion(
      {
        ...coords,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      },
      700
    );
  };

  const selectionKey = destination?.id
    ? `destination:${destination.id}`
    : selectedPin
      ? `pin:${selectedPin.id}`
      : null;

  // When a destination or saved pin is selected, pan and zoom the map to it.
  useEffect(() => {
    if (!selectionKey) {
      focusedSelectionKey.current = null;
      return;
    }
    if (!mapRef.current) return;
    if (focusedSelectionKey.current === selectionKey) return;

    if (destination && destination.entranceLat != null && destination.entranceLng != null) {
      focusedSelectionKey.current = selectionKey;
      focusOnCoords({ latitude: destination.entranceLat, longitude: destination.entranceLng });
      return;
    }

    if (selectedPin) {
      focusedSelectionKey.current = selectionKey;
      focusOnCoords({ latitude: selectedPin.latitude, longitude: selectedPin.longitude });
    }
  }, [selectionKey, destination, selectedPin, location]);


  // Enhanced location tracking
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    setArrivalStatus('');
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setLocation(loc);
          checkArrival(loc.coords);
        }
      );
    })();
    return () => subscription?.remove();
  }, [destinationId]);

  const geocode = async (coords: Coords) => {
    try {
      const [place] = await Location.reverseGeocodeAsync(coords);
      return formatAddress(place);
    } catch (err) {
      console.warn('Reverse geocoding failed', err);
      return '';
    }
  };

  const startDraft = async (coords: Coords) => {
    setIsPinMode(false);
    setError(null);
    focusOnCoords(coords);
    setDraft({
      latitude: coords.latitude,
      longitude: coords.longitude,
      name: '',
      notes: '',
      address: '',
    });
    setGeocoding(true);
    const address = await geocode(coords);
    setDraft((prev) =>
      prev &&
      prev.id == null &&
      prev.latitude === coords.latitude &&
      prev.longitude === coords.longitude
        ? { ...prev, address }
        : prev
    );
    setGeocoding(false);
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (ignoreMapPress.current) {
      ignoreMapPress.current = false;
      return;
    }
    if (!isPinMode) return;
    if (event.nativeEvent.action === 'marker-press') return;
    startDraft(event.nativeEvent.coordinate);
  };

  const pinAtCurrentLocation = () => {
    if (!location) return;
    startDraft({ latitude: location.coords.latitude, longitude: location.coords.longitude });
  };

  const openSavedPin = (pin: Pin) => {
    ignoreMapPress.current = true;
    setError(null);
    focusOnCoords({ latitude: pin.latitude, longitude: pin.longitude });
    setDraft({
      id: pin.id,
      latitude: pin.latitude,
      longitude: pin.longitude,
      name: pin.name,
      notes: pin.notes ?? '',
      address: pin.address ?? '',
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: draft.name.trim() || 'Untitled pin',
        notes: draft.notes.trim(),
        address: draft.address.trim(),
        latitude: draft.latitude,
        longitude: draft.longitude,
      };
      const saved = draft.id ? await updatePin(draft.id, input) : await createPin(input);
      setDraft({
        id: saved.id,
        latitude: saved.latitude,
        longitude: saved.longitude,
        name: saved.name,
        notes: saved.notes ?? '',
        address: saved.address ?? '',
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });
      await refreshPins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save pin');
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    setSaving(true);
    setError(null);
    try {
      await deletePin(draft.id);
      setDraft(null);
      await refreshPins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete pin');
    } finally {
      setSaving(false);
    }
  };

  const closeDraft = () => {
    if (!saving) setDraft(null);
  };

  if (!location) {
    return (
      <View style={styles.container}>
        {permissionDenied ? (
          <Text style={styles.errorText}>
            Location permission is required to show the map.
          </Text>
        ) : (
          <ActivityIndicator style={styles.map} />
        )}
      </View>
    );
  }

  const distance =
    draft && location
      ? distanceMeters(
          { latitude: location.coords.latitude, longitude: location.coords.longitude },
          { latitude: draft.latitude, longitude: draft.longitude }
        )
      : null;
  const createdLabel = formatTimestamp(draft?.createdAt);
  const updatedLabel = formatTimestamp(draft?.updatedAt);

  return (
    <View style={styles.container}>
      {arrivalStatus ? <Text style={styles.arrivalText}>{arrivalStatus}</Text> : null}
      {error && !draft ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        onPress={handleMapPress}
        initialRegion={initialRegion}
        zoomEnabled
        scrollEnabled
      >
        <Marker coordinate={location.coords} title="Your Position" pinColor="blue" />

        {destination && destination.entranceLat != null && destination.entranceLng != null ? (
          <Marker
            coordinate={{ latitude: destination.entranceLat, longitude: destination.entranceLng }}
            title={destination.name ?? 'Destination'}
            pinColor="orange"
          />
        ) : null}

        {visiblePins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.name}
            description={pin.address ?? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
            pinColor="green"
            onPress={() => openSavedPin(pin)}
          />
        ))}

        {draft && !draft.id && (
          <Marker
            coordinate={{ latitude: draft.latitude, longitude: draft.longitude }}
            title={draft.name || 'New pin'}
            description={draft.address || `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`}
            pinColor="red"
          />
        )}
      </MapView>

      <View style={styles.mapTypeToggle}>
        <Pressable
          onPress={() => setMapType('satellite')}
          style={[styles.toggleButton, mapType === 'satellite' && styles.toggleButtonActive]}
        >
          <Text style={[styles.toggleText, mapType === 'satellite' && styles.toggleTextActive]}>
            Satellite
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMapType('terrain')}
          style={[styles.toggleButton, mapType === 'terrain' && styles.toggleButtonActive]}
        >
          <Text style={[styles.toggleText, mapType === 'terrain' && styles.toggleTextActive]}>
            Terrain
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomControls}>
        <Pressable
          onPress={() => setIsPinMode((prev) => !prev)}
          style={[styles.controlButton, isPinMode && styles.controlButtonActive]}
        >
          <Text style={[styles.controlText, isPinMode && styles.controlTextActive]}>
            {isPinMode ? 'Tap map to pin' : 'Drop a pin'}
          </Text>
        </Pressable>
        <Pressable onPress={pinAtCurrentLocation} style={styles.controlButton}>
          <Text style={styles.controlText}>Pin my location</Text>
        </Pressable>
      </View>

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={closeDraft}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={closeDraft} />
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{draft?.id ? 'Edit pin' : 'New pin'}</Text>
                <Text style={styles.sheetSubtitle}>
                  {draft?.id ? 'Saved to database' : 'Not saved yet'}
                </Text>
              </View>

              {error ? <Text style={styles.formError}>{error}</Text> : null}

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Front entrance"
                value={draft?.name ?? ''}
                onChangeText={(text) =>
                  setDraft((prev) => (prev ? { ...prev, name: text } : prev))
                }
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder={geocoding ? 'Looking up address…' : 'Address'}
                value={draft?.address ?? ''}
                onChangeText={(text) =>
                  setDraft((prev) => (prev ? { ...prev, address: text } : prev))
                }
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Add extra details about this pin"
                value={draft?.notes ?? ''}
                multiline
                onChangeText={(text) =>
                  setDraft((prev) => (prev ? { ...prev, notes: text } : prev))
                }
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoLine}>
                  Coordinates: {draft?.latitude.toFixed(6)}, {draft?.longitude.toFixed(6)}
                </Text>
                {distance != null ? (
                  <Text style={styles.infoLine}>Distance from you: {formatDistance(distance)}</Text>
                ) : null}
                {createdLabel ? (
                  <Text style={styles.infoLine}>Created: {createdLabel}</Text>
                ) : null}
                {updatedLabel ? (
                  <Text style={styles.infoLine}>Updated: {updatedLabel}</Text>
                ) : null}
                {draft?.id ? <Text style={styles.infoLine}>ID: {draft.id}</Text> : null}
              </View>

              <Pressable
                onPress={saveDraft}
                disabled={saving || geocoding}
                style={[styles.saveButton, (saving || geocoding) && styles.buttonDisabled]}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving…' : draft?.id ? 'Save changes' : 'Save pin'}
                </Text>
              </Pressable>

              <View style={styles.secondaryRow}>
                <Pressable onPress={closeDraft} style={styles.secondaryButton} disabled={saving}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                {draft?.id ? (
                  <Pressable
                    onPress={removeDraft}
                    style={[styles.secondaryButton, styles.deleteButton]}
                    disabled={saving}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  arrivalText: { position: 'absolute', top: 64, zIndex: 100, backgroundColor: 'green', color: 'white', padding: 10, alignSelf: 'center', fontWeight: 'bold' },
  errorText: { margin: 20, fontSize: 16, color: '#b00020', textAlign: 'center' },
  errorBanner: { position: 'absolute', top: 64, left: 12, right: 12, zIndex: 100, backgroundColor: '#fdecea', color: '#b00020', padding: 10, borderRadius: 8 },
  mapTypeToggle: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: 3, zIndex: 100, elevation: 4 },
  toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleButtonActive: { backgroundColor: '#155724' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#155724' },
  toggleTextActive: { color: '#fff' },
  bottomControls: { position: 'absolute', bottom: 30, left: 12, right: 12, flexDirection: 'row', gap: 10, zIndex: 100 },
  controlButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingVertical: 12, alignItems: 'center', elevation: 4 },
  controlButtonActive: { backgroundColor: '#155724' },
  controlText: { fontSize: 14, fontWeight: '600', color: '#155724' },
  controlTextActive: { color: '#fff' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  sheetSubtitle: { fontSize: 12, color: '#777' },
  formError: { backgroundColor: '#fdecea', color: '#b00020', padding: 8, borderRadius: 6, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  infoBox: { marginTop: 14, backgroundColor: '#f5f7f5', borderRadius: 8, padding: 12 },
  infoLine: { fontSize: 13, color: '#444', marginBottom: 4 },
  saveButton: { marginTop: 16, backgroundColor: '#155724', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#eee' },
  secondaryText: { color: '#333', fontSize: 15, fontWeight: '600' },
  deleteButton: { backgroundColor: '#fdecea' },
  deleteText: { color: '#b00020', fontSize: 15, fontWeight: '700' },
});
