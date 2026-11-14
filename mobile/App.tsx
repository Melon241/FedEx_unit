import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { MapDisplay } from './src/components/MapDisplay';
import { apiFetch } from './src/api/client';
import { listPins, type Pin } from './src/api/pins';

type Building = {
  id: string;
  name: string;
  entranceLat?: number;
  entranceLng?: number;
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [destinations, setDestinations] = useState<Building[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Building | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDestinations, setLoadingDestinations] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/search?query=&areaId=area-1').then(res => res.json()),
      listPins()
    ])
      .then(([destData, pinData]) => {
        if (!cancelled) {
          const results = (destData as { results?: Building[] }).results;
          setDestinations(results ?? []);
          setPins(pinData ?? []);
        }
      })
      .catch((err) => {
        console.warn('Could not load data', err);
        if (!cancelled) {
          setLoadError('Could not load data.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDestinations(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const refreshPins = async () => {
    try {
      setPins(await listPins());
    } catch (err) {
      console.warn('Could not refresh pins', err);
    }
  };

  const searchResults = useMemo(
    () =>
      normalizedQuery
        ? [
            ...destinations.filter(
              (d) =>
                d.name.toLowerCase().includes(normalizedQuery) ||
                d.id.toLowerCase().includes(normalizedQuery)
            ),
            ...pins.filter(
              (p) =>
                p.name.toLowerCase().includes(normalizedQuery) ||
                (p.address ?? '').toLowerCase().includes(normalizedQuery)
            )
          ]
        : [],
    [destinations, pins, normalizedQuery]
  );

  const zipCodes = {
    '91364': { latitude: 34.1683, longitude: -118.6041 },
    '91365': { latitude: 34.1750, longitude: -118.5950 },
    '91367': { latitude: 34.1718, longitude: -118.6015 },
    '91371': { latitude: 34.1780, longitude: -118.6000 },
  };

  useEffect(() => {
    if (zipFilter && zipCodes[zipFilter as keyof typeof zipCodes]) {
      const coords = zipCodes[zipFilter as keyof typeof zipCodes];
      setSelectedDestination({
        id: `zip-${zipFilter}`,
        name: `Area ${zipFilter}`,
        entranceLat: coords.latitude,
        entranceLng: coords.longitude,
      });
      setSelectedPin(null);
    }
  }, [zipFilter]);

  const showResults = normalizedQuery.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Search destination name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.zipFilterContainer}>
        {Object.keys(zipCodes).map((zip) => (
          <TouchableOpacity
            key={zip}
            style={[styles.zipButton, zipFilter === zip && styles.zipButtonActive]}
            onPress={() => setZipFilter(zipFilter === zip ? '' : zip)}
          >
            <Text style={[styles.zipText, zipFilter === zip && styles.zipTextActive]}>{zip}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showResults && (
        <View style={styles.resultsContainer}>
          {loadingDestinations ? (
            <Text style={styles.emptyText}>Loading destinations…</Text>
          ) : loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => {
                    // Check if it's a pin (has 'latitude' property) or destination
                    if ('entranceLat' in item) {
                      setSelectedDestination(item as Building);
                      setSelectedPin(null);
                    } else {
                      setSelectedPin(item as Pin);
                      setSelectedDestination(null);
                    }
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.resultText}>{item.name}</Text>
                  {'entranceLat' in item && item.entranceLat != null && item.entranceLng != null ? (
                    <Text style={styles.resultSubtext}>
                      {item.entranceLat.toFixed(5)}, {item.entranceLng.toFixed(5)}
                    </Text>
                  ) : 'latitude' in item ? (
                    <Text style={styles.resultSubtext}>
                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={styles.emptyText}>No matching destinations</Text>
          )}
        </View>
      )}

      {(selectedDestination || selectedPin) && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Target: {selectedDestination?.name ?? selectedPin?.name}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSelectedDestination(null);
              setSelectedPin(null);
            }}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <MapDisplay
        destination={selectedDestination}
        selectedPin={selectedPin}
        query={searchQuery}
        pins={pins}
        onPinsChanged={refreshPins}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchContainer: { flexDirection: 'row', padding: 10, paddingTop: 50, backgroundColor: '#eee', zIndex: 10 },
  zipFilterContainer: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 10, justifyContent: 'space-around', backgroundColor: '#eee', zIndex: 10 },
  zipButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' },
  zipButtonActive: { backgroundColor: '#155724', borderColor: '#155724' },
  zipText: { fontSize: 13, color: '#333' },
  zipTextActive: { color: '#fff', fontWeight: 'bold' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, paddingHorizontal: 8, backgroundColor: '#fff' },
  resultsContainer: { position: 'absolute', top: 95, left: 10, right: 10, backgroundColor: '#fff', elevation: 5, zIndex: 20, maxHeight: 200, borderWidth: 1, borderColor: '#ccc' },
  resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  resultText: { fontSize: 16 },
  resultSubtext: { fontSize: 12, color: '#777', marginTop: 2 },
  emptyText: { padding: 12, fontSize: 14, color: '#777', textAlign: 'center' },
  errorText: { padding: 12, fontSize: 13, color: '#b00020', textAlign: 'center' },
  infoBanner: {
    padding: 10,
    backgroundColor: '#d4edda',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  infoText: { color: '#155724', fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#c8e6c9', padding: 5, borderRadius: 4 },
  cancelButtonText: { color: '#155724', fontSize: 12, fontWeight: 'bold' }
});
