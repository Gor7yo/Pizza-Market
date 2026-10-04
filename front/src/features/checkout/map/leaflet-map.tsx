'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { MAP_PROVIDER } from '@/lib/env';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_PROVIDERS } from './map-providers';

export interface LatLng {
  lat: number;
  lng: number;
}

const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="36" height="44" viewBox="0 0 36 44" aria-hidden="true"><path d="M18 0C8 0 0 8 0 18c0 13 18 26 18 26s18-13 18-26C36 8 28 0 18 0z" fill="#c2410c"/><circle cx="18" cy="18" r="7" fill="#fff"/></svg>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
});

/** Imperative Leaflet map (loaded client-side only). Click or drag the pin to choose a point. */
export default function LeafletMap({
  value,
  onChange,
  label,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const provider = TILE_PROVIDERS[MAP_PROVIDER] ?? TILE_PROVIDERS.osm!;
    const start = value ?? DEFAULT_CENTER;
    const instance = L.map(container.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([start.lat, start.lng], value ? 16 : DEFAULT_ZOOM);
    L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(instance);

    const place = (latlng: L.LatLng) => {
      if (!marker.current) {
        marker.current = L.marker(latlng, {
          icon: pinIcon,
          draggable: true,
          keyboard: true,
          title: label,
        }).addTo(instance);
        marker.current.on('dragend', () => {
          const p = marker.current?.getLatLng();
          if (p) onChangeRef.current({ lat: p.lat, lng: p.lng });
        });
      } else {
        marker.current.setLatLng(latlng);
      }
    };

    if (value) place(L.latLng(value.lat, value.lng));
    instance.on('click', (e: L.LeafletMouseEvent) => {
      place(e.latlng);
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once
  }, []);

  // external value changes (geolocation, search) move the pin
  useEffect(() => {
    if (!map.current || !value) return;
    const latlng = L.latLng(value.lat, value.lng);
    if (marker.current) marker.current.setLatLng(latlng);
    else
      marker.current = L.marker(latlng, { icon: pinIcon, draggable: true, title: label }).addTo(
        map.current,
      );
    map.current.setView(latlng, Math.max(map.current.getZoom(), 16));
  }, [value, label]);

  return (
    <div
      ref={container}
      role="application"
      aria-label={label}
      style={{ height: '100%', width: '100%' }}
    />
  );
}
