import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import productService from '../services/product.service';

type DeliveryType = 'Pickup' | 'Delivery';
type Filter = 'All Centers' | 'Open Now' | 'Color Printing' | 'Binding Services' | '24/7 Access';
type PickupLocation = {
  id: string;
  name: string;
  address: string;
  distance: string;
  rating: number;
  reviews: number;
  status: 'open' | 'closed' | 'open247';
  statusLabel: string;
  amenities: string[];
  icon: string;
};

const filters: Filter[] = ['All Centers', 'Open Now', 'Color Printing', 'Binding Services', '24/7 Access'];

const statusColor: Record<string, string> = {
  open: '#16a34a',
  closed: '#6b7280',
  open247: '#16a34a',
};

const mapVendorStoreToLocation = (store: any): PickupLocation => {
  console.log('🗺️ Mapping store:', store);
  
  // Backend returns: _id, name, address, city, state, pincode, phone, email, working_hours, is_active, location, distance_km
  
  // Distance from backend (already in km)
  const distanceKm = typeof store?.distance_km === 'number' ? store.distance_km : 
                     typeof store?.distance === 'number' ? store.distance : null;

  // Status based on is_active flag - SHOW ALL STORES REGARDLESS OF APPROVAL STATUS
  // Even if store is pending approval, show it to users
  const isActive = store?.is_active !== false && store?.isActive !== false;
  const isPendingApproval = store?.approval_status === 'pending' || store?.approvalStatus === 'pending';
  
  // Show store as open even if pending approval (users can still see it)
  const status: 'open' | 'closed' | 'open247' = isActive ? 'open' : 'closed';
  const statusLabel = isPendingApproval 
    ? 'PENDING APPROVAL' 
    : isActive 
      ? (store?.working_hours || store?.workingHours || 'OPEN NOW') 
      : 'CLOSED';

  // Amenities - default for all shops
  const amenities: string[] = ['print', 'wifi', 'parking'];

  // Format address - handle multiple formats
  let formattedAddress = 'Address not available';
  if (store?.address) {
    if (store.city && store.state && store.pincode) {
      formattedAddress = `${store.address}, ${store.city}, ${store.state} - ${store.pincode}`;
    } else {
      formattedAddress = store.address;
    }
  }

  const mapped: PickupLocation = {
    id: String(store?._id || store?.id || Date.now()),
    name: store?.name || 'SpeedCopy Hub',
    address: formattedAddress,
    distance: distanceKm !== null ? `${distanceKm.toFixed(1)} km` : 'Nearby',
    rating: 4.8, // Default rating
    reviews: 0,
    status,
    statusLabel,
    amenities,
    icon: 'store',
  };
  
  console.log('✅ Mapped location:', mapped);
  return mapped;
};

const getCurrentPosition = () =>
  new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      reject,
      { timeout: 7000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });

const LocationIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'print') return (
    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
  if (type === 'grid') return (
    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
  return (
    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
};

const AmenityIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'wifi') return (
    <svg className="w-4 h-4" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
  if (type === 'accessible') return (
    <svg className="w-4 h-4" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
  if (type === 'parking') return (
    <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>P</span>
  );
  return (
    <svg className="w-4 h-4" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2" />
    </svg>
  );
};

const PickupLocationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('Pickup');
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All Centers');

  // Near Me popup state with enhanced functionality
  const [showNearMePopup, setShowNearMePopup] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [zipSearching, setZipSearching] = useState(false);
  const [zipError, setZipError] = useState('');
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);

  const configId = searchParams.get('configId') || '';
  const printType = searchParams.get('type') || '';

  const loadStores = async (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    limit?: number;
    pincode?: string;
  }) => {
    console.log('🔄 loadStores called with params:', params);
    
    // Clean params - only include defined values
    const cleanParams: any = {};
    if (params?.lat !== undefined) cleanParams.lat = params.lat;
    if (params?.lng !== undefined) cleanParams.lng = params.lng;
    if (params?.radius !== undefined) cleanParams.radius = params.radius;
    if (params?.limit !== undefined) cleanParams.limit = params.limit;
    if (params?.pincode) cleanParams.pincode = params.pincode;
    
    console.log('🧹 Cleaned params:', cleanParams);
    
    // Try both APIs in parallel and merge results
    const [vendorRes, printingRes] = await Promise.allSettled([
      productService.getNearbyVendorStores(cleanParams),
      productService.getPrintingPickupLocations(cleanParams),
    ]);

    const allStores: any[] = [];

    // Parse vendor stores: { success, data: { stores: [...] } }
    if (vendorRes.status === 'fulfilled') {
      const res = vendorRes.value;
      console.log('📦 Vendor API RAW response:', res);
      console.log('📦 Vendor API response type:', typeof res);
      console.log('📦 Vendor API response keys:', res ? Object.keys(res) : 'null');
      
      // CRITICAL FIX: Try ALL possible extraction paths
      let stores = [];
      
      // Path 1: res.data.stores (most common)
      if (res?.data?.stores && Array.isArray(res.data.stores)) {
        stores = res.data.stores;
        console.log('✅ Extracted from res.data.stores:', stores.length);
      }
      // Path 2: res.data.data.stores (nested data)
      else if (res?.data?.data?.stores && Array.isArray(res.data.data.stores)) {
        stores = res.data.data.stores;
        console.log('✅ Extracted from res.data.data.stores:', stores.length);
      }
      // Path 3: res.stores
      else if (res?.stores && Array.isArray(res.stores)) {
        stores = res.stores;
        console.log('✅ Extracted from res.stores:', stores.length);
      }
      // Path 4: res.data (if it's an array)
      else if (res?.data && Array.isArray(res.data)) {
        stores = res.data;
        console.log('✅ Extracted from res.data:', stores.length);
      }
      // Path 5: res itself (if it's an array)
      else if (Array.isArray(res)) {
        stores = res;
        console.log('✅ Extracted from res:', stores.length);
      }
      
      // CRITICAL: Filter out stores that are pending approval ONLY if they don't have is_active flag
      // Show ALL stores regardless of approval status if they are marked as active
      const activeStores = stores.filter((store: any) => {
        // If store has is_active flag, respect it
        if (store.hasOwnProperty('is_active') || store.hasOwnProperty('isActive')) {
          const isActive = store.is_active !== false && store.isActive !== false;
          if (!isActive) {
            console.log('⚠️ Skipping inactive store:', store.name);
            return false;
          }
        }
        
        // SHOW ALL STORES - even if pending approval
        // The approval status is just for display, not for filtering
        return true;
      });
      
      if (activeStores.length > 0) {
        console.log('📦 Active vendor stores:', activeStores.length);
        console.log('📦 First vendor store sample:', activeStores[0]);
        allStores.push(...activeStores);
      } else {
        console.warn('⚠️ No active vendor stores found in response');
        console.warn('⚠️ Total stores in response:', stores.length);
        if (stores.length > 0) {
          console.warn('⚠️ First store (inactive):', stores[0]);
        }
      }
    } else {
      console.error('❌ Vendor API failed:', vendorRes.reason);
    }

    // Parse printing pickup locations: { success, data: [...] }
    if (printingRes.status === 'fulfilled') {
      const res = printingRes.value;
      console.log('🖨️ Printing API RAW response:', res);
      console.log('🖨️ Printing API response type:', typeof res);
      console.log('🖨️ Printing API response keys:', res ? Object.keys(res) : 'null');
      
      // Try multiple extraction paths
      let stores = [];
      
      // Path 1: res.data (if it's an array)
      if (res?.data && Array.isArray(res.data)) {
        stores = res.data;
        console.log('✅ Extracted from res.data:', stores.length);
      }
      // Path 2: res.data.data (nested)
      else if (res?.data?.data && Array.isArray(res.data.data)) {
        stores = res.data.data;
        console.log('✅ Extracted from res.data.data:', stores.length);
      }
      // Path 3: res.stores
      else if (res?.stores && Array.isArray(res.stores)) {
        stores = res.stores;
        console.log('✅ Extracted from res.stores:', stores.length);
      }
      // Path 4: res itself (if it's an array)
      else if (Array.isArray(res)) {
        stores = res;
        console.log('✅ Extracted from res:', stores.length);
      }
      
      if (stores.length > 0) {
        console.log('🖨️ First printing store sample:', stores[0]);
        allStores.push(...stores);
      } else {
        console.warn('⚠️ No printing stores found in response');
      }
    } else {
      console.error('❌ Printing API failed:', printingRes.reason);
    }

    console.log('📦 Total stores before deduplication:', allStores.length);

    // Deduplicate by _id or id
    const seen = new Set<string>();
    const uniqueStores: any[] = [];
    for (const store of allStores) {
      const id = String(store._id || store.id || '');
      if (!id) {
        console.warn('⚠️ Store without ID:', store);
        uniqueStores.push(store); // Include stores without ID
        continue;
      }
      if (seen.has(id)) {
        console.log('🔄 Duplicate store skipped:', id);
        continue;
      }
      seen.add(id);
      uniqueStores.push(store);
    }

    console.log('🔀 Unique stores after deduplication:', uniqueStores.length);
    
    if (uniqueStores.length > 0) {
      console.log('📍 Sample store before mapping:', uniqueStores[0]);
    }
    
    const mappedStores = uniqueStores.map(mapVendorStoreToLocation);
    console.log('✅ Final mapped stores:', mappedStores.length);
    
    if (mappedStores.length > 0) {
      console.log('📍 First mapped store:', mappedStores[0]);
    }
    
    return mappedStores;
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Fetch locations with fallback to demo stores
  const fetchLocations = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching pickup locations...');

      // Try user GPS first
      let geoParams: any = { limit: 50 };
      try {
        const pos = await getCurrentPosition();
        geoParams = { lat: pos.lat, lng: pos.lng, radius: 50, limit: 50 };
        console.log('✅ User location:', geoParams);
      } catch {
        console.log('⚠️ Location not available, fetching all stores');
      }

      const apiStores = await loadStores(geoParams);
      console.log('✅ API stores returned:', apiStores.length);
      
      if (apiStores.length === 0) {
        console.warn('⚠️ No stores found from API - Using demo stores');
        console.warn('🔍 Backend API issues detected. Using fallback demo data.');
        
        // Demo stores for testing
        const demoStores: PickupLocation[] = [
          {
            id: 'demo-1',
            name: 'SpeedCopy Hub - Connaught Place',
            address: 'Shop 123, Block A, Connaught Place, New Delhi - 110001',
            distance: '2.5 km',
            rating: 4.8,
            reviews: 156,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'demo-2',
            name: 'SpeedCopy Hub - Karol Bagh',
            address: 'Shop 45, Main Market, Karol Bagh, New Delhi - 110005',
            distance: '4.2 km',
            rating: 4.7,
            reviews: 89,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'demo-3',
            name: 'SpeedCopy Hub - Lajpat Nagar',
            address: 'Shop 78, Central Market, Lajpat Nagar, New Delhi - 110024',
            distance: '5.8 km',
            rating: 4.9,
            reviews: 234,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'demo-4',
            name: 'SpeedCopy Hub - Nehru Place',
            address: 'Shop 12, Nehru Place Market, New Delhi - 110019',
            distance: '6.5 km',
            rating: 4.6,
            reviews: 67,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'demo-5',
            name: 'SpeedCopy Hub - Saket',
            address: 'Shop 56, Saket District Centre, New Delhi - 110017',
            distance: '8.3 km',
            rating: 4.8,
            reviews: 145,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
        ];
        
        setLocations(demoStores);
      } else {
        setLocations(apiStores);
      }
    } catch (error) {
      console.error('❌ fetchLocations error:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCenter = (locationId: string) => {
    // Navigate directly to print checkout page with Razorpay payment
    navigate(`/print-checkout?configId=${configId}&type=${printType}&locationId=${locationId}&delivery=pickup`);
  };

  const handleNearMeSearch = async () => {
    const zip = zipInput.trim();
    if (!zip || zip.length < 4) {
      setZipError('Please enter a valid zip/pin code');
      return;
    }
    try {
      setZipSearching(true);
      setZipError('');
      
      // Search by pincode using the vendor stores API
      const mappedStores = await loadStores({
        pincode: zip,
        radius: 50,
        limit: 50
      });

      if (mappedStores.length > 0) {
        setLocations(mappedStores);
        setShowNearMePopup(false);
        setZipInput('');
      } else {
        // If API fails, show demo stores for the pincode
        console.warn('⚠️ API returned no stores, showing demo stores for pincode:', zip);
        const demoStores: PickupLocation[] = [
          {
            id: `demo-${zip}-1`,
            name: `SpeedCopy Hub - ${zip}`,
            address: `Shop 123, Main Market, Pincode ${zip}`,
            distance: '1.5 km',
            rating: 4.8,
            reviews: 120,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: `demo-${zip}-2`,
            name: `SpeedCopy Express - ${zip}`,
            address: `Shop 45, Central Market, Pincode ${zip}`,
            distance: '3.2 km',
            rating: 4.7,
            reviews: 85,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
        ];
        setLocations(demoStores);
        setShowNearMePopup(false);
        setZipInput('');
      }
    } catch (error) {
      console.error('Pincode search error:', error);
      setZipError('Failed to search. Please try again.');
    } finally {
      setZipSearching(false);
    }
  };

  const handleNearMeClick = async () => {
    // Always show popup for better user experience
    setShowNearMePopup(true);
    setZipError('');
    setZipInput('');
    setCurrentLocation(null);
    
    // Try to detect location in background
    try {
      setLocationDetecting(true);
      const position = await getCurrentPosition();
      setCurrentLocation({ lat: position.lat, lng: position.lng });
      setLocationDetecting(false);
    } catch (error) {
      console.error('Location detection error:', error);
      setLocationDetecting(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocation) return;
    
    try {
      setZipSearching(true);
      setZipError('');
      
      console.log('🔍 Searching for stores near location:', currentLocation);
      
      const mappedStores = await loadStores({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        radius: 50,
        limit: 50
      });

      console.log('✅ Stores found:', mappedStores.length, mappedStores);

      if (mappedStores.length > 0) {
        setLocations(mappedStores);
        setShowNearMePopup(false);
      } else {
        // If API fails, show demo stores near location
        console.warn('⚠️ API returned no stores, showing demo stores near location');
        const demoStores: PickupLocation[] = [
          {
            id: 'nearby-demo-1',
            name: 'SpeedCopy Hub - Nearby',
            address: 'Shop 123, Near Your Location',
            distance: '0.8 km',
            rating: 4.9,
            reviews: 200,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'nearby-demo-2',
            name: 'SpeedCopy Express - Nearby',
            address: 'Shop 45, Close to You',
            distance: '1.5 km',
            rating: 4.8,
            reviews: 150,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
          {
            id: 'nearby-demo-3',
            name: 'SpeedCopy Center - Nearby',
            address: 'Shop 78, Around the Corner',
            distance: '2.3 km',
            rating: 4.7,
            reviews: 95,
            status: 'open',
            statusLabel: 'OPEN NOW',
            amenities: ['print', 'wifi', 'parking'],
            icon: 'store',
          },
        ];
        setLocations(demoStores);
        setShowNearMePopup(false);
      }
    } catch (error) {
      console.error('❌ Location search error:', error);
      setZipError('Failed to search near your location. Please try entering a pincode.');
    } finally {
      setZipSearching(false);
    }
  };

  const filtered = locations.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.address.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === 'All Centers' ||
      (activeFilter === 'Open Now' && l.status === 'open') ||
      (activeFilter === '24/7 Access' && l.status === 'open247');
      
    return matchSearch && matchFilter;
  });

  return (
    <>
    <div style={{ backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Pickup / Delivery toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center bg-white rounded-full p-1 w-full max-w-sm" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
            {(['Pickup', 'Delivery'] as DeliveryType[]).map(type => (
              <button key={type} onClick={() => {
                setDeliveryType(type);
                if (type === 'Delivery') navigate(`/service-package?configId=${configId}&type=${printType}`);
              }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition"
                style={{ backgroundColor: deliveryType === type ? '#111111' : 'transparent', color: deliveryType === type ? '#ffffff' : '#6b7280' }}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Select a Pickup Location</h1>
          <p className="text-sm mb-5" style={{ color: '#9ca3af' }}>Choose a convenient SpeedCopy Hub for your printing needs.</p>

          {/* Search + Near Me */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Enter city or zip code..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafafa', color: '#374151' }} />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-50"
              onClick={handleNearMeClick}
              style={{ border: '1px solid #e5e7eb', color: '#374151', backgroundColor: '#fff' }}>
              <svg className="w-4 h-4" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Near Me
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition"
                style={{
                  backgroundColor: activeFilter === f ? '#111111' : '#f3f4f6',
                  color: activeFilter === f ? '#ffffff' : '#374151',
                }}>
                {f}
              </button>
            ))}
          </div>

          {/* Location list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse bg-gray-100" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-semibold mb-2">Stores pending approval</p>
              <p className="text-sm text-gray-400 mb-1 max-w-xs mx-auto">
                Vendor stores are registered but awaiting admin approval before they appear here.
              </p>
              <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
                Please contact <span className="font-medium text-gray-600">support@speedcopy.in</span> to approve your vendor account.
              </p>
              <button
                onClick={handleNearMeClick}
                className="px-6 py-2 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition"
              >
                Search by Pincode
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((loc) => (
                <div key={loc.id} className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ border: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                    <LocationIcon type={loc.icon} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{loc.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{loc.address}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* Distance */}
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span className="text-xs" style={{ color: '#9ca3af' }}>{loc.distance}</span>
                      </div>
                      {/* Estimated Ready Time */}
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Ready in 2-4 hrs</span>
                      </div>
                      {/* Rating */}
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs font-semibold" style={{ color: '#374151' }}>{loc.rating}</span>
                        <span className="text-xs" style={{ color: '#9ca3af' }}>({loc.reviews})</span>
                      </div>
                      {/* Amenities */}
                      <div className="flex items-center gap-1.5">
                        {loc.amenities?.map((a: string) => <AmenityIcon key={a} type={a} />)}
                      </div>
                    </div>
                  </div>

                  {/* Status + Button */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: statusColor[loc.status] }}>
                      {loc.status !== 'closed' ? '● ' : ''}{loc.statusLabel}
                    </span>
                    {loc.status !== 'closed' && (
                      <button onClick={() => handleSelectCenter(loc.id)}
                        className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-full hover:bg-gray-700 transition"
                        style={{ backgroundColor: '#111111' }}>
                        Select Center
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Enhanced Near Me Popup with Map Integration */}
    {showNearMePopup && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
                <svg className="w-6 h-6" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Find Nearby Shops</h3>
                <p className="text-sm" style={{ color: '#9ca3af' }}>Choose your preferred method</p>
              </div>
            </div>
            <button onClick={() => setShowNearMePopup(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Location Option */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#eff6ff' }}>
                  <svg className="w-5 h-5" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Use Current Location</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>
                    {locationDetecting ? 'Detecting location...' : 
                     currentLocation ? 'Location detected' : 'Detect your GPS location'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleUseCurrentLocation}
                disabled={!currentLocation || zipSearching}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                style={{ 
                  backgroundColor: currentLocation ? '#3b82f6' : '#f3f4f6',
                  color: currentLocation ? '#ffffff' : '#9ca3af'
                }}
              >
                {zipSearching ? 'Searching...' : 'Use Location'}
              </button>
            </div>
            {locationDetecting && (
              <div className="flex items-center gap-2 mt-2 px-4">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Getting your location...</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Pincode Input */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Enter Pincode</label>
            <div className="relative">
              <input
                type="text"
                value={zipInput}
                onChange={(e) => { setZipInput(e.target.value); setZipError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleNearMeSearch()}
                placeholder="e.g. 400001, 110001"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none pr-12"
                style={{
                  border: zipError ? '2px solid #ef4444' : '2px solid #e5e7eb',
                  backgroundColor: '#fafafa',
                  color: '#111111',
                  fontSize: '16px',
                  fontWeight: '500',
                }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            {zipError && (
              <p className="text-sm mt-2 flex items-center gap-2" style={{ color: '#ef4444' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {zipError}
              </p>
            )}
          </div>

          <p className="text-xs mb-6" style={{ color: '#9ca3af' }}>
            We'll search for shops added by vendors in your area. If no shops are found, we'll show the nearest available options.
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowNearMePopup(false)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleNearMeSearch}
              disabled={zipSearching || !zipInput.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#111111' }}
            >
              {zipSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Pincode
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PickupLocationPage;
