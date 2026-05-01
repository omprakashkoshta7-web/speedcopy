import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import walletService from '../services/wallet.service';
import paymentService from '../services/payment.service';
import productService, { extractStoresFromResponse, getStoreIdentifier } from '../services/product.service';
import orderService from '../services/order.service';

type PaymentMethod = 'razorpay' | 'wallet';

const PrintCheckoutPage: React.FC = () => {
  const [method, setMethod] = useState<PaymentMethod>('razorpay');
  const [wallet, setWallet] = useState<any>(null);
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [printConfig, setPrintConfig] = useState<any>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  
  const locationId = searchParams.get('locationId') || '';
  const configId = searchParams.get('configId') || '';

  useEffect(() => {
    fetchCheckoutData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCheckoutData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching checkout data for locationId:', locationId);
      
      if (isAuthenticated) {
        // Fetch wallet
        const walletRes = await walletService.getBalance();
        setWallet(walletRes.data);
        
        // Fetch location details if locationId exists
        if (locationId) {
          // 1. First try sessionStorage cache (fastest)
          const cachedLocation = sessionStorage.getItem(`pickup_location_${locationId}`);
          if (cachedLocation) {
            try {
              const parsedLocation = JSON.parse(cachedLocation);
              setPickupLocation(parsedLocation);
              console.log('[PrintCheckout] Store loaded from sessionStorage cache');
            } catch (error) {
              console.warn('[PrintCheckout] Failed to parse cached pickup location:', error);
            }
          }

          // 2. If it's the default SpeedCopyHub, set it directly without API call
          if (locationId === 'speedcopyhub-main') {
            setPickupLocation({
              id: 'speedcopyhub-main',
              name: 'SpeedCopyHub',
              address: 'Mumbai, Maharashtra - 400001',
              distance: 'Nearby',
              rating: 4.8,
              reviews: 245,
              status: 'open247',
              statusLabel: '24/7 OPEN',
              amenities: ['print', 'wifi', 'parking'],
              icon: 'store',
              estimatedDeliveryTime: 'Ready in 2-4 hrs',
              readyTime: 'Ready in 2-4 hrs',
            });
          }
          // 3. Only call API if we have a real MongoDB ObjectId (not a default store)
          else if (/^[0-9a-fA-F]{24}$/.test(locationId)) {
            try {
              // Try to get user location for nearby search
              let storeParams: any = { limit: 100 };
              try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                  navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                );
                storeParams = { lat: pos.coords.latitude, lng: pos.coords.longitude, radius: 50, limit: 100 };
              } catch {
                // No location available - skip API call, rely on sessionStorage
                console.log('[PrintCheckout] No location available, skipping store API call');
              }

              if (storeParams.lat) {
                const [vendorRes, printingRes] = await Promise.allSettled([
                  productService.getNearbyVendorStores(storeParams),
                  productService.getPrintingPickupLocations(storeParams),
                ]);

                const allStores: any[] = [];
                if (vendorRes.status === 'fulfilled') allStores.push(...extractStoresFromResponse(vendorRes.value));
                if (printingRes.status === 'fulfilled') allStores.push(...extractStoresFromResponse(printingRes.value));

                const foundStore = allStores.find((store: any) => getStoreIdentifier(store) === locationId);
                if (foundStore) {
                  setPickupLocation(foundStore);
                  console.log('[PrintCheckout] Store loaded from API:', foundStore);
                }
              }
            } catch (error) {
              console.error('[PrintCheckout] Failed to fetch store from API:', error);
            }
          }
        }
        // Get print config from localStorage
        if (configId) {
          const savedConfig = localStorage.getItem(`printConfig_${configId}`);
          if (savedConfig) {
            setPrintConfig(JSON.parse(savedConfig));
            console.log('✅ Print config loaded:', JSON.parse(savedConfig));
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to fetch checkout data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!printConfig) return 0;
    
    // Use the same pricing configuration as PrintConfigPage
    const pricingConfig = {
      basePrice: {
        'B&W': { 'A4': 2, 'A3': 4 },
        'color': { 'A4': 5, 'A3': 8 },
        'Custom': { 'A4': 3, 'A3': 6 }
      },
      printSideMultiplier: {
        'one-sided': 1,
        'Two-sided': 1.5,
        '4 in 1 (2 front+2 Back)': 0.8
      },
      graphSheetPrice: 3,
      processingFee: 5,
      bindingPrice: {
        'None': 0,
        'Soft Binding': 15,
        'Spiral Binding': 25,
        'Thesis Binding': 50
      },
      coverPagePrice: {
        'None': 0,
        'Transparent': 5,
        'Colored': 10,
        'Leather-finish': 20
      }
    };
    
    let total = 0;
    
    // Base printing cost
    const colorMode = printConfig.colorMode || 'B&W';
    const pageSize = printConfig.pageSize || 'A4';
    const printSide = printConfig.printSide || 'one-sided';
    const copies = printConfig.copies || 1;
    const totalPages = printConfig.totalPages || 0;
    const linearSheets = printConfig.linearSheets || 0;
    const semiLog = printConfig.semiLog || 0;
    const bindingType = printConfig.bindingType || 'None';
    const coverPage = printConfig.coverPage || 'None';
    
    if (colorMode && pageSize) {
      const baseRate = pricingConfig.basePrice[colorMode as keyof typeof pricingConfig.basePrice]?.[pageSize as 'A4' | 'A3'] || 2;
      const sideMultiplier = pricingConfig.printSideMultiplier[printSide as keyof typeof pricingConfig.printSideMultiplier] || 1;
      total += baseRate * totalPages * copies * sideMultiplier;
    }
    
    // Graph sheets cost
    total += (linearSheets + semiLog) * pricingConfig.graphSheetPrice;
    
    // Binding cost
    total += pricingConfig.bindingPrice[bindingType as keyof typeof pricingConfig.bindingPrice] || 0;
    
    // Cover page cost
    total += pricingConfig.coverPagePrice[coverPage as keyof typeof pricingConfig.coverPagePrice] || 0;
    
    // Processing fee
    total += pricingConfig.processingFee;
    
    return total;
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);

      // Validation: Check if print config exists
      if (!printConfig) {
        alert('Print configuration not found. Please go back and configure your print job.');
        setProcessing(false);
        return;
      }

      // Validation: Check if pickup location is selected
      if (!pickupLocation || !locationId) {
        alert('Please select a pickup location before proceeding with payment.');
        setProcessing(false);
        return;
      }

      const totalAmount = calculateTotal();

      // Validation: Check amount
      if (totalAmount <= 0) {
        alert('Invalid order amount. Please check your print configuration.');
        setProcessing(false);
        return;
      }

      // Check wallet balance only if wallet payment is selected
      if (method === 'wallet') {
        const walletBalance = wallet?.balance || 0;
        if (walletBalance < totalAmount) {
          alert(`Insufficient wallet balance. You have ₹${walletBalance.toFixed(2)} but need ₹${totalAmount.toFixed(2)}.`);
          setProcessing(false);
          return;
        }
      }

      if (isAuthenticated) {
        // Validate pickup location has required fields
        if (!pickupLocation) {
          alert('Please select a pickup location before proceeding.');
          setProcessing(false);
          return;
        }

        // Ensure phone number is present and valid
        let phoneNumber = pickupLocation?.phone || pickupLocation?.contact || '';
        
        // Clean phone number (remove spaces, dashes, etc.)
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        // If phone is still empty or invalid, use a default
        if (!phoneNumber || phoneNumber.length < 10) {
          phoneNumber = '9999999999';  // Valid default instead of 0000000000
        }
        
        // Ensure address is properly formatted
        let addressLine1 = '';
        
        // Try to get a proper address line
        if (pickupLocation?.address) {
          if (typeof pickupLocation.address === 'string') {
            addressLine1 = pickupLocation.address;
          } else if (pickupLocation.address.line1) {
            addressLine1 = pickupLocation.address.line1;
          } else {
            // Build address from components
            const parts = [
              pickupLocation.address.street,
              pickupLocation.address.area,
              pickupLocation.address.landmark
            ].filter(Boolean);
            addressLine1 = parts.join(', ') || 'Store Address';
          }
        }
        
        // Fallback to store name if no address
        if (!addressLine1 || addressLine1.trim() === '') {
          addressLine1 = pickupLocation?.name || 'Pickup Location';
        }
        
        // Validate address is not just city/state/pincode
        if (addressLine1.includes('Mumbai, Maharashtra') && addressLine1.length < 30) {
          addressLine1 = `${pickupLocation?.name || 'Store'}, ${addressLine1}`;
        }

        // Build order data with only required fields
        const orderData: any = {
          items: [{
            productId: 'print-job',
            productName: 'Document Printing',
            flowType: 'printing' as const,
            quantity: printConfig.copies || 1,
            unitPrice: Math.round(totalAmount / (printConfig.copies || 1)),
            totalPrice: Math.round(totalAmount),
          }],
          shippingAddress: {
            fullName: pickupLocation?.name || 'Pickup Location',
            phone: phoneNumber,
            line1: addressLine1,
            city: pickupLocation?.city || pickupLocation?.address?.city || 'Mumbai',
            state: pickupLocation?.state || pickupLocation?.address?.state || 'Maharashtra',
            pincode: String(pickupLocation?.pincode || pickupLocation?.pinCode || pickupLocation?.address?.pincode || '400001'),
          },
          subtotal: Math.round(totalAmount),
          total: Math.round(totalAmount),
        };

        // Add optional fields only if they have values
        // Only add pickupShopId if it's a valid MongoDB ObjectId (24 hex characters)
        if (locationId && /^[0-9a-fA-F]{24}$/.test(locationId)) {
          orderData.pickupShopId = locationId;
        }
        
        // Add discount and delivery charge (set to 0)
        orderData.discount = 0;
        orderData.deliveryCharge = 0;
        
        // Add payment method
        if (method) {
          orderData.paymentMethod = method;
        }

        console.log('🔍 Order data before sending:', JSON.stringify(orderData, null, 2));
        console.log('🔍 Print config:', printConfig);
        console.log('🔍 Pickup location:', pickupLocation);
        console.log('🔍 Total amount:', totalAmount);

        // Create order based on payment method
        if (method === 'wallet') {
          const response = await orderService.createOrder(orderData);
          const createdOrderId = response.data?._id;
          
          if (createdOrderId) {
            navigate(`/payment-success?orderId=${createdOrderId}`);
          } else {
            throw new Error('Order creation failed');
          }
        } else {
          // Razorpay payment for card, UPI, netbanking
          await handleRazorpayPayment(orderData, totalAmount);
        }
      } else {
        alert('Please login to place an order');
        navigate('/');
      }
    } catch (err: any) {
      console.error('❌ Payment error:', err);
      
      // Extract validation errors if present
      let errorMessage = 'Payment failed. Please try again.';
      if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errors = err.response.data.errors;
        console.error('❌ Validation errors:', errors);
        
        // Show first error to user
        if (errors.length > 0) {
          const firstError = errors[0];
          errorMessage = `Validation failed: ${firstError.field || 'Field'} - ${firstError.message || firstError}`;
        }
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      alert(`Payment failed: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRazorpayPayment = async (orderData: any, totalAmount: number) => {
    try {
      console.log('🎯 Starting Razorpay payment for amount:', totalAmount);

      // 1) Initiate via wallet service
      const initiateRes = await walletService.initiateRazorpay(totalAmount, `print_${Date.now()}`);
      const paymentData = initiateRes.data;

      console.log('🔑 Using Razorpay key:', paymentData.keyId?.substring(0, 8) + '...');
      console.log('📦 Razorpay Order ID:', paymentData.razorpayOrderId);
      console.log('💰 Amount in paise:', paymentData.amount);

      // 2) Open Razorpay checkout via paymentService
      const checkoutResult = await paymentService.openCheckout({
        keyId: paymentData.keyId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'INR',
        orderId: paymentData.razorpayOrderId,
        name: 'SpeedCopy',
        description: `Print Job - ${printConfig?.totalPages || 0} pages`,
      });

      console.log('✅ Payment completed, creating order...');

      // 3) Create order after successful payment
      const response = await orderService.createOrder(orderData);
      const createdOrderId = response.data?._id;

      if (createdOrderId) {
        console.log('✅ Order created successfully:', createdOrderId);
        
        // Store payment details separately for reference
        sessionStorage.setItem(`order_payment_${createdOrderId}`, JSON.stringify({
          razorpayPaymentId: checkoutResult.razorpayPaymentId,
          razorpayOrderId: checkoutResult.razorpayOrderId || paymentData.razorpayOrderId,
          razorpaySignature: checkoutResult.razorpaySignature,
          paymentStatus: 'completed',
        }));
        
        navigate(`/payment-success?orderId=${createdOrderId}&paymentId=${checkoutResult.razorpayPaymentId}`);
      } else {
        throw new Error('Order creation failed after payment');
      }

    } catch (error: any) {
      console.error('❌ Razorpay payment failed:', error);
      
      // Don't show error for user cancellation
      if (error.message === 'Payment cancelled by user') {
        console.log('ℹ️ User cancelled payment');
        return;
      }
      
      // For other errors, show user-friendly message
      throw error;
    }
  };

  const formatStoreAddress = (address: any) => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;

    const parts = [address.line1, address.line2, address.city, address.state, address.pincode]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse">
            <div className="bg-white rounded-2xl h-96" />
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = calculateTotal();

  console.log('🎨 Rendering PrintCheckoutPage with:', {
    locationId,
    configId,
    pickupLocation,
    printConfig,
    loading,
  });

  return (
    <>
    <div style={{ backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold mb-6" style={{ color: '#111111' }}>
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left - Payment Methods & Pickup Location */}
          <div className="w-full lg:w-1/2">
            {/* Pickup Location Section */}
            {pickupLocation ? (
              <div className="mb-8">
                <h2 className="font-bold text-gray-900 mb-1" style={{ fontSize: '20px' }}>Pickup Location</h2>
                <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>Your order will be ready at this location.</p>
                
                <div className="p-5 rounded-2xl bg-white" style={{ border: '1.5px solid #e5e7eb' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f0fdf4' }}>
                      <MapPin size={24} style={{ color: '#16a34a' }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 mb-1">{pickupLocation.name}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{formatStoreAddress(pickupLocation.address)}</p>
                      {pickupLocation.phone && (
                        <p className="text-sm text-gray-500 mt-2">📞 {pickupLocation.phone}</p>
                      )}
                      {/* Display Estimated Delivery Time */}
                      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                        <svg className="w-4 h-4" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-semibold" style={{ color: '#16a34a' }}>
                          {pickupLocation.estimatedDeliveryTime || sessionStorage.getItem(`pickup_delivery_time_${locationId}`) || 'Ready in 2-4 hrs'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : locationId ? (
              <div className="mb-8">
                <h2 className="font-bold text-gray-900 mb-1" style={{ fontSize: '20px' }}>Pickup Location</h2>
                <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>Loading pickup location details...</p>
                
                <div className="p-5 rounded-2xl bg-white" style={{ border: '1.5px solid #e5e7eb' }}>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Payment Method */}
            <h2 className="font-bold text-gray-900 mb-1" style={{ fontSize: '20px' }}>Payment Method</h2>
            <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>All payment options will be available in the next step.</p>

            {/* Single Payment Option - Razorpay handles all methods */}
            <div className="rounded-xl mb-2" style={{ border: '2px solid #111111', backgroundColor: '#fafafa' }}>
              <div className="w-full flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f3f4f6' }}>
                    <svg className="w-3.5 h-3.5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-gray-900" style={{ fontSize: '11px' }}>Pay with Razorpay</p>
                    <p style={{ color: '#9ca3af', fontSize: '9px' }}>UPI, Cards, Net Banking & More</p>
                  </div>
                </div>
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#111111', border: 'none' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </div>

            {/* Wallet Option */}
            <div className="rounded-xl mb-2 mt-4" style={{ border: method === 'wallet' ? '2px solid #111111' : '1.5px solid #e5e7eb', backgroundColor: method === 'wallet' ? '#fafafa' : '#ffffff' }}>
              <button onClick={() => setMethod('wallet')} className="w-full flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f3f4f6' }}>
                    <svg className="w-3.5 h-3.5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-gray-900" style={{ fontSize: '11px' }}>SpeedWallet</p>
                    <p style={{ color: '#9ca3af', fontSize: '9px' }}>Balance: ₹{(wallet?.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: method === 'wallet' ? '#111111' : 'transparent', border: method === 'wallet' ? 'none' : '1.5px solid #d1d5db' }}>
                  {method === 'wallet' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          </div>

          {/* Right - Order Summary */}
          <div className="w-full lg:w-1/2 lg:flex-shrink-0">
            <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <h2 className="font-bold text-gray-900 mb-5" style={{ fontSize: '17px' }}>Order Summary</h2>
              
              {/* Print Details */}
              {printConfig && (
                <div className="space-y-3 mb-4 pb-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Document Printing</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>
                        {printConfig.totalPages} pages × {printConfig.copies} {printConfig.copies > 1 ? 'copies' : 'copy'}
                      </p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>
                        {printConfig.colorMode} • {printConfig.pageSize} • {printConfig.printSide}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">₹{totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Estimated Delivery Time */}
              {pickupLocation && (
                <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f0fdf4' }}>
                    <svg className="w-4 h-4" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>Delivery Time</p>
                      <p className="text-sm font-bold text-gray-900">
                        {pickupLocation.estimatedDeliveryTime || sessionStorage.getItem(`pickup_delivery_time_${locationId}`) || 'Ready in 2-4 hrs'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#9ca3af' }}>Subtotal</span>
                  <span className="text-sm font-semibold text-gray-900">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#9ca3af' }}>Delivery</span>
                  <span className="text-sm font-semibold text-gray-900">₹0.00</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mb-5" style={{ borderTop: '1px solid #f3f4f6' }}>
                <span className="font-bold text-gray-900">Total Payable</span>
                <span className="font-bold text-gray-900" style={{ fontSize: '20px' }}>₹{totalAmount.toFixed(2)}</span>
              </div>

              <button 
                className="w-full flex items-center justify-center gap-2 py-3.5 text-white font-bold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: (!pickupLocation || !printConfig || processing) ? '#9ca3af' : '#111111' }}
                onClick={handlePayment}
                disabled={processing || !pickupLocation || !printConfig}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {processing ? 'Processing...' : 
                 !pickupLocation ? 'Select Pickup Location' :
                 !printConfig ? 'Configure Print Job' :
                 `Pay ₹${totalAmount.toFixed(2)}`}
              </button>

              <p className="text-center text-xs mt-3 font-bold tracking-widest" style={{ color: '#9ca3af' }}>
                {method === 'wallet' ? 'SPEEDCOPY WALLET' : 'POWERED BY RAZORPAY'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Payment Processing Modal */}
    {processing && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl p-8 max-w-sm mx-4 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-2" style={{ fontSize: '18px' }}>Processing Payment</h3>
            <p className="text-sm" style={{ color: '#9ca3af' }}>Please wait while we process your payment...</p>
          </div>
          
          <div className="space-y-3 mb-6 p-4 rounded-2xl" style={{ backgroundColor: '#f9fafb' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#9ca3af' }}>Amount</span>
              <span className="font-bold text-gray-900">₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#9ca3af' }}>Payment Method</span>
              <span className="font-bold text-gray-900 capitalize">{method}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default PrintCheckoutPage;
