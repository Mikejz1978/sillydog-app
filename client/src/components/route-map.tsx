import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Customer, Route } from "@shared/schema";

interface RouteMapProps {
  routes: Route[];
  customers: Customer[];
  apiKey: string;
}

export function RouteMap({ routes, customers, apiKey }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach(marker => marker.setMap(null));
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [apiKey]);

  // Create/update map when loaded or routes change
  useEffect(() => {
    if (!isLoaded || !mapRef.current || routes.length === 0) return;

    // Get coordinates for all routes
    const routePoints: { lat: number; lng: number; customer: Customer; index: number }[] = [];
    
    routes.forEach((route, index) => {
      const customer = customers.find(c => c.id === route.customerId);
      if (customer?.lat && customer?.lng) {
        routePoints.push({
          lat: parseFloat(customer.lat),
          lng: parseFloat(customer.lng),
          customer,
          index: index + 1,
        });
      }
    });

    if (routePoints.length === 0) {
      setError("No geocoded addresses found");
      return;
    }

    // Initialize or get existing map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        mapTypeId: "roadmap",
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
    }

    const map = mapInstanceRef.current;

    // Clear old markers and polyline
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Create bounds to fit all markers
    const bounds = new window.google.maps.LatLngBounds();

    // Add numbered markers
    routePoints.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);

      // Create custom numbered marker
      const marker = new window.google.maps.Marker({
        position,
        map,
        label: {
          text: String(point.index),
          color: "white",
          fontSize: "14px",
          fontWeight: "bold",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 20,
          fillColor: "#FF6F00",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: `${point.index}. ${point.customer.name}`,
        zIndex: 100 - point.index, // Higher numbers appear on top
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
              ${point.index}. ${point.customer.name}
            </div>
            <div style="font-size: 12px; color: #666;">
              ${point.customer.address}
            </div>
            ${point.customer.gateCode ? `<div style="font-size: 11px; color: #888; margin-top: 4px;">Gate: ${point.customer.gateCode}</div>` : ''}
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Draw route line connecting all points
    if (routePoints.length > 1) {
      const routePath = routePoints.map(p => ({ lat: p.lat, lng: p.lng }));
      
      polylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: "#00BCD4",
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      
      polylineRef.current.setMap(map);
    }

    // Fit map to show all markers
    map.fitBounds(bounds);
    
    // Don't zoom in too much if only one or two points
    const listener = window.google.maps.event.addListener(map, "idle", () => {
      const zoom = map.getZoom();
      if (zoom && zoom > 15) {
        map.setZoom(15);
      }
      window.google.maps.event.removeListener(listener);
    });

  }, [isLoaded, routes, customers]);

  if (error) {
    return (
      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className="aspect-square rounded-lg overflow-hidden"
      data-testid="route-map"
    />
  );
}
