import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import walletService from '../services/wallet.service';
import paymentService from '../services/payment.service';
import productService from '../services/product.service';
import orderService from '../services/order.service';

type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet';

const PrintCheckoutPage: React.FC = () => {
  const [method, setMethod] = useState<PaymentMethod>('upi');
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
          // Check if it's a default store (starts with 'default-')
          if (locationId.startsWith('default-')) {
            console.log('📍 Using default store for locationId:', locationId);
            
            // Default stores mapping - matches PickupLocationPage
            const defaultStores: Record<string, any> = {
              'default-1': {
                _id: 'default-1',
                name: 'SpeedCopy Hub - Jabalpur',
                address: {
                  line1: 'Shop No. 15, Gole Market',
                  line2: 'Near Railway Station',
                  city: 'Jabalpur',
                  state: 'Madhya Pradesh',
                  pincode: '482001',
                },
                phone: '+91-9876543210',
              },
              'default-2': {
                _id: 'default-2',
                name: 'SpeedCopy Express - Delhi',
                address: {
                  line1: 'A-123, Connaught Place',
                  line2: 'Central Delhi',
                  city: 'New Delhi',
                  state: 'Delhi',
                  pincode: '110001',
                },
                phone: '+91-9876543211',
              },
              'default-3': {
                _id: 'default-3',
                name: 'SpeedCopy Center - Mumbai',
                address: {
                  line1: 'Shop 45, Linking Road',
                  line2: 'Bandra West',
                  city: 'Mumbai',
                  state: 'Maharashtra',
                  pincode: '400050',
                },
                phone: '+91-9876543212',
              },
              'default-4': {
                _id: 'default-4',
                name: 'SpeedCopy Plus - Bangalore',
                address: {
                  line1: '12th Main, Koramangala 4th Block',
                  line2: '',
                  city: 'Bangalore',
                  state: 'Karnataka',
                  pincode: '560034',
                },
                phone: '+91-9876543213',
              },
              'default-5': {
                _id: 'default-5',
                name: 'SpeedCopy Station - Chennai',
                address: {
                  line1: 'No. 78, T. Nagar Main Road',
                  line2: '',
                  city: 'Chennai',
                  state: 'Tamil Nadu',
                  pincode: '600017',
                },
                phone: '+91-9876543214',
              },
            };
            
            const defaultStore = defaultStores[locationId];
            if (defaultStore) {
              setPickupLocation(defaultStore);
              console.log('✅ Default store loaded:', defaultStore);
              console.log('✅ Store name:', defaultStore.name);
              console.log('✅ Store address:', defaultStore.address);
              console.log('✅ Store phone:', defaultStore.phone);
            } else {
              console.error('❌ Default store not found for locationId:', locationId);
              console.log('Available default store IDs:', Object.keys(defaultStores));
            }
          } else {
            // Fetch from API for real store IDs
            try {
              const response = await productService.getNearbyVendorStores({ limit: 50 });
              const stores = response?.data?.stores || response?.stores || [];
              const foundStore = stores.find((s: any) => String(s._id || s.id) === locationId);
              
              if (foundStore) {
                setPickupLocation(foundStore);
                console.log('✅ Store loaded from API:', foundStore);
              }
            } catch (error) {
              console.error('❌ Failed to fetch store from API:', error);
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
      processingFee: 5
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
    
    if (colorMode && pageSize) {
      const baseRate = pricingConfig.basePrice[colorMode as keyof typeof pricingConfig.basePrice]?.[pageSize as 'A4' | 'A3'] || 2;
      const sideMultiplier = pricingConfig.printSideMultiplier[printSide as keyof typeof pricingConfig.printSideMultiplier] || 1;
      total += baseRate * totalPages * copies * sideMultiplier;
    }
    
    // Graph sheets cost
    total += (linearSheets + semiLog) * pricingConfig.graphSheetPrice;
    
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

      if (method === 'wallet') {
        const walletBalance = wallet?.balance || 0;
        if (walletBalance < totalAmount) {
          alert(`Insufficient wallet balance. You have ₹${walletBalance.toFixed(2)} but need ₹${totalAmount.toFixed(2)}.`);
          setProcessing(false);
          return;
        }
      }

      if (isAuthenticated) {
        const orderData = {
          items: [{
            productId: 'print-job',
            productName: 'Document Printing',
            flowType: 'printing' as const,
            quantity: printConfig.copies || 1,
            unitPrice: totalAmount / (printConfig.copies || 1),
            totalPrice: totalAmount,
            printConfig: {
              paperSize: printConfig.pageSize || 'A4',
              paperType: printConfig.paperType || 'Standard',
              colorOption: printConfig.colorMode || 'B&W',
              bindingType: printConfig.bindingType || 'None',
              sides: printConfig.printSide || 'one-sided',
              copies: printConfig.copies || 1,
              pages: printConfig.totalPages || 0,
            },
          }],
          shippingAddress: pickupLocation ? {
            fullName: pickupLocation.name || 'Pickup Location',
            phone: pickupLocation.phone || '',
            line1: formatStoreAddress(pickupLocation.address),
            line2: '',
            city: pickupLocation.address?.city || 'Mumbai',
            state: pickupLocation.address?.state || 'Maharashtra',
            pincode: pickupLocation.address?.pincode || '400001',
            country: 'India',
          } : {
            fullName: 'Pickup Location',
            phone: '',
            line1: 'Store Pickup',
            line2: '',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            country: 'India',
          },
          pickupShopId: locationId || undefined,
          subtotal: totalAmount,
          discount: 0,
          deliveryCharge: 0,
          total: totalAmount,
          paymentMethod: method,
          notes: `Pickup at: ${pickupLocation?.name || 'Store'} | Print Config: ${printConfig?.totalPages || 0} pages, ${printConfig?.copies || 1} copies, ${printConfig?.colorMode || 'B&W'}`,
        };

        if (method === 'wallet') {
          const response = await orderService.createOrder(orderData);
          const createdOrderId = response.data?._id;
          
          if (createdOrderId) {
            navigate(`/payment-success?orderId=${createdOrderId}`);
          } else {
            throw new Error('Order creation failed');
          }
        } else {
          await handleRazorpayPayment(orderData, totalAmount);
        }
      } else {
        alert('Please login to place an order');
        navigate('/');
      }
    } catch (err: any) {
      console.error('❌ Payment error:', err);
      
      // Don't show error for user cancellation
      if (err.message === 'Payment cancelled by user') {
        // User cancelled, just return without showing error
        return;
      }
      
      // Show user-friendly error message
      const errorMessage = err.message || 'Payment failed. Please try again.';
      alert(`Payment failed: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRazorpayPayment = async (orderData: any, totalAmount: number) => {
    try {
      console.log('🎯 Starting Razorpay payment for amount:', totalAmount);

      // 1) Initiate via wallet service (same as AddFundsPage)
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

      // 3) Create order with payment details
      const finalOrderData = {
        ...orderData,
        razorpayPaymentId: checkoutResult.razorpayPaymentId,
        razorpayOrderId: checkoutResult.razorpayOrderId || paymentData.razorpayOrderId,
        razorpaySignature: checkoutResult.razorpaySignature,
        paymentStatus: 'completed',
      };

      const response = await orderService.createOrder(finalOrderData);
      const createdOrderId = response.data?._id;

      if (createdOrderId) {
        console.log('✅ Order created successfully:', createdOrderId);
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
            <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>Choose your preferred payment method.</p>

            {/* Card Payment */}
            <div className="rounded-2xl mb-3" style={{ border: method === 'card' ? '2px solid #111111' : '1.5px solid #e5e7eb', backgroundColor: method === 'card' ? '#fafafa' : '#ffffff' }}>
              <button onClick={() => setMethod('card')} className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
                    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900" style={{ fontSize: '14px' }}>Credit / Debit Card</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Visa, Mastercard, RuPay</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: method === 'card' ? '#111111' : 'transparent', border: method === 'card' ? 'none' : '1.5px solid #d1d5db' }}>
                  {method === 'card' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>

            {/* UPI Payment */}
            <div className="rounded-2xl mb-3" style={{ border: method === 'upi' ? '2px solid #111111' : '1.5px solid #e5e7eb', backgroundColor: method === 'upi' ? '#fafafa' : '#ffffff' }}>
              <button onClick={() => setMethod('upi')} className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
                    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900" style={{ fontSize: '14px' }}>UPI</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Google Pay, PhonePe, Paytm</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: method === 'upi' ? '#111111' : 'transparent', border: method === 'upi' ? 'none' : '1.5px solid #d1d5db' }}>
                  {method === 'upi' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>

            {/* Wallet */}
            <div className="rounded-2xl mb-3" style={{ border: method === 'wallet' ? '2px solid #111111' : '1.5px solid #e5e7eb', backgroundColor: method === 'wallet' ? '#fafafa' : '#ffffff' }}>
              <button onClick={() => setMethod('wallet')} className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
                    <svg className="w-5 h-5" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900" style={{ fontSize: '14px' }}>SpeedWallet</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Balance: ₹{(wallet?.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: method === 'wallet' ? '#111111' : 'transparent', border: method === 'wallet' ? 'none' : '1.5px solid #d1d5db' }}>
                  {method === 'wallet' && <div className="w-2 h-2 rounded-full bg-white" />}
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
