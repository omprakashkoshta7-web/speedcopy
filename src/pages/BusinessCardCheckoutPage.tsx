import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CreditCard, Wallet, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import AddressModal from '../components/AddressModal';
import paymentService from '../services/payment.service';
import walletService from '../services/wallet.service';
import orderService from '../services/order.service';
import userService from '../services/user.service';
import { useAuth } from '../context/AuthContext';

interface CardDesign {
  template: string;
  color: string;
  layout: string;
  text: {
    name: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    address: string;
  };
}

const BusinessCardCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [cardDesign, setCardDesign] = useState<CardDesign | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [paperType, setPaperType] = useState<'standard' | 'premium' | 'luxury'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'wallet'>('razorpay');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  
  // Address management
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  // Pricing
  const pricePerCard = {
    standard: 2.5,
    premium: 4.0,
    luxury: 6.5,
  };

  const subtotal = quantity * pricePerCard[paperType];
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Get card design from location state or localStorage
    const design = location.state?.cardDesign || JSON.parse(localStorage.getItem('businessCardDesign') || 'null');
    
    if (!design) {
      alert('No card design found. Please design your card first.');
      navigate('/card-editor');
      return;
    }
    
    setCardDesign(design);
    
    // Fetch addresses
    fetchAddresses();
  }, [isAuthenticated, location.state, navigate]);

  const fetchAddresses = async () => {
    try {
      const response = await userService.getAddresses();
      const addressesData = response?.data || [];
      const parsedAddresses = Array.isArray(addressesData) ? addressesData : [];
      setAddresses(parsedAddresses);
      
      // Auto-select first address
      if (parsedAddresses.length > 0) {
        setSelectedAddress(parsedAddresses[0]);
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      setAddresses([]);
    }
  };

  const handleSaveAddress = async (addressData: any) => {
    setSavingAddress(true);
    const formatted = {
      label: addressData.type || 'Home',
      fullName: addressData.name,
      phone: addressData.phone,
      houseNo: addressData.house || '',
      area: addressData.area || '',
      landmark: addressData.landmark || '',
      line1: `${addressData.house || ''}, ${addressData.area || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
      line2: addressData.landmark || '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: addressData.pincode,
      country: 'India',
      isDefault: addressData.isDefault || false,
    };
    
    try {
      if (editingAddress) {
        const response = await userService.updateAddress(editingAddress._id, formatted);
        const updatedAddress = response.data;
        setAddresses(addresses.map(a => a._id === editingAddress._id ? updatedAddress : a));
        if (selectedAddress?._id === editingAddress._id) {
          setSelectedAddress(updatedAddress);
        }
      } else {
        const response = await userService.addAddress(formatted);
        const newAddress = response.data;
        setAddresses([...addresses, newAddress]);
        setSelectedAddress(newAddress);
      }
    } catch (err) {
      console.error('Failed to save address:', err);
      const localAddress = { ...formatted, _id: editingAddress?._id || `local-${Date.now()}` };
      if (editingAddress) {
        setAddresses(addresses.map(a => a._id === editingAddress._id ? localAddress : a));
        if (selectedAddress?._id === editingAddress._id) {
          setSelectedAddress(localAddress);
        }
      } else {
        setAddresses([...addresses, localAddress]);
        setSelectedAddress(localAddress);
      }
    }
    
    setShowAddressModal(false);
    setEditingAddress(null);
    setSavingAddress(false);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    
    try {
      setDeletingAddressId(addressId);
      await userService.deleteAddress(addressId);
      const updated = addresses.filter(a => a._id !== addressId);
      setAddresses(updated);
      
      if (selectedAddress?._id === addressId) {
        setSelectedAddress(updated.length > 0 ? updated[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete address:', err);
      const updated = addresses.filter(a => a._id !== addressId);
      setAddresses(updated);
      if (selectedAddress?._id === addressId) {
        setSelectedAddress(updated.length > 0 ? updated[0] : null);
      }
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleEditAddress = (address: any) => {
    setEditingAddress(address);
    setShowAddressModal(true);
  };

  const handlePayment = async () => {
    if (!cardDesign) return;
    
    // Validate address
    if (!selectedAddress) {
      alert('Please select or add a delivery address');
      return;
    }

    setLoading(true);

    try {
      if (paymentMethod === 'razorpay') {
        console.log('🚀 Starting Razorpay payment flow for business cards');

        // 1) Initiate via wallet service (same as AddFundsPage)
        const initiateRes = await walletService.initiateRazorpay(total, `card_${Date.now()}`);
        const paymentData = initiateRes.data;

        console.log('💳 Payment data received:', paymentData);

        const keyId = paymentData?.keyId;
        const razorpayOrderId = paymentData?.razorpayOrderId;
        const amountInPaise = paymentData?.amount || Math.round(total * 100);
        const currency = paymentData?.currency || 'INR';

        if (!keyId || !amountInPaise) {
          throw new Error('Payment initialization failed. Missing Razorpay details.');
        }

        // 2) Open Razorpay checkout
        console.log('🎯 Opening Razorpay checkout...');
        const checkoutResult = await paymentService.openCheckout({
          keyId,
          amount: amountInPaise,
          currency,
          orderId: razorpayOrderId,
          receipt: `card_${Date.now()}`,
          name: 'SpeedCopy',
          description: `Business Cards - ${quantity} cards`,
          purpose: 'order_payment',
        });

        console.log('✅ Payment completed:', checkoutResult);

        // Create order in backend after successful payment
        const orderPayload = {
          items: [{
            productId: 'business_card_custom',
            productName: 'Custom Business Card',
            flowType: 'printing' as const,
            quantity,
            unitPrice: pricePerCard[paperType],
            totalPrice: subtotal,
            printConfig: {
              paperSize: 'Business Card',
              paperType,
              colorOption: 'color',
              bindingType: 'None',
              sides: 'Two-sided',
              copies: quantity,
              pages: 1,
            },
          }],
          shippingAddress: {
            fullName: selectedAddress.fullName || selectedAddress.label || 'Customer',
            phone: selectedAddress.phone || '',
            line1: selectedAddress.line1 || '',
            line2: selectedAddress.line2 || '',
            city: selectedAddress.city || 'Mumbai',
            state: selectedAddress.state || 'Maharashtra',
            pincode: selectedAddress.pincode || '400001',
            country: 'India',
          },
          subtotal,
          discount: 0,
          deliveryCharge: 0,
          total,
          paymentMethod: 'razorpay',
          razorpayOrderId: checkoutResult.razorpayOrderId,
          razorpayPaymentId: checkoutResult.razorpayPaymentId,
          razorpaySignature: checkoutResult.razorpaySignature,
          paymentStatus: 'paid',
        };

        console.log('📦 Creating order:', orderPayload);
        const orderResponse = await orderService.createOrder(orderPayload);
        console.log('✅ Order created:', orderResponse);

        // Save order ID and show success
        setOrderId(orderResponse.data.orderNumber || orderResponse.data._id);
        setSuccess(true);
        setLoading(false);
      } else {
        // Wallet payment
        alert('Wallet payment coming soon!');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('❌ Payment failed:', error);
      
      // Don't show error for user cancellation
      if (error.message === 'Payment cancelled by user') {
        setLoading(false);
        return;
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Payment failed. Please try again.';
      alert(`❌ ${errorMessage}`);
      setLoading(false);
    }
  };

  if (!cardDesign) {
    return (
      <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading your design...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/card-editor')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
          >
            <ArrowLeft size={18} />
            Back to Editor
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-bold text-gray-900 text-3xl mb-2">Checkout</h1>
          <p className="text-gray-600">Complete your business card order</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address Section */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Delivery Address</h2>
              <p className="text-sm mb-4 text-gray-600">Select where you'd like your cards delivered</p>
              
              {addresses.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {addresses.map((address, i) => (
                    <button
                      key={address._id || i}
                      onClick={() => setSelectedAddress(address)}
                      className="w-full text-left p-4 rounded-xl transition"
                      style={{
                        border: selectedAddress?._id === address._id ? '2px solid #111111' : '1.5px solid #e5e7eb',
                        backgroundColor: selectedAddress?._id === address._id ? '#fafafa' : '#ffffff',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 mb-1">{address.label || address.fullName}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {address.line1}
                            {address.line2 && <>, {address.line2}</>}
                            <br />
                            {address.city}, {address.state} {address.pincode}
                          </p>
                        </div>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
                          style={{ 
                            border: selectedAddress?._id === address._id ? 'none' : '1.5px solid #d1d5db', 
                            backgroundColor: selectedAddress?._id === address._id ? '#111111' : 'transparent' 
                          }}>
                          {selectedAddress?._id === address._id && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                      
                      {/* Edit and Delete buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #e5e7eb' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAddress(address);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition"
                          style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(address._id);
                          }}
                          disabled={deletingAddressId === address._id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-gray-300 mb-4">
                  <p className="text-gray-500 mb-3">No addresses found</p>
                  <button 
                    onClick={() => setShowAddressModal(true)}
                    className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition"
                  >
                    Add Address
                  </button>
                </div>
              )}

              <button 
                onClick={() => setShowAddressModal(true)}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Address
              </button>
            </div>

            {/* Card Preview */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Your Design</h2>
              <div className="bg-gray-50 rounded-xl p-8 flex items-center justify-center">
                <div
                  className="rounded-xl shadow-lg p-6"
                  style={{
                    width: '350px',
                    height: '210px',
                    backgroundColor: cardDesign.color,
                    color: '#ffffff',
                  }}
                >
                  <div className="h-full flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-2xl mb-1">{cardDesign.text.name}</h3>
                      <p className="text-sm opacity-80">{cardDesign.text.title}</p>
                    </div>
                    <div className="space-y-0.5 text-xs opacity-90">
                      <p>{cardDesign.text.phone}</p>
                      <p>{cardDesign.text.email}</p>
                      <p>{cardDesign.text.website}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity Selection */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Quantity</h2>
              <div className="grid grid-cols-4 gap-3">
                {[100, 250, 500, 1000].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setQuantity(qty)}
                    className={`p-4 rounded-xl border-2 transition ${
                      quantity === qty
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900 text-lg">{qty}</p>
                    <p className="text-xs text-gray-500">cards</p>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Quantity</label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(50, parseInt(e.target.value) || 50))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  placeholder="Enter custom quantity"
                />
              </div>
            </div>

            {/* Paper Type */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Paper Quality</h2>
              <div className="space-y-3">
                {[
                  { id: 'standard', name: 'Standard', desc: '300 GSM Art Card', price: pricePerCard.standard },
                  { id: 'premium', name: 'Premium', desc: '350 GSM Matt Finish', price: pricePerCard.premium },
                  { id: 'luxury', name: 'Luxury', desc: '400 GSM Velvet Touch', price: pricePerCard.luxury },
                ].map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => setPaperType(paper.id as any)}
                    className={`w-full p-4 rounded-xl border-2 transition text-left ${
                      paperType === paper.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{paper.name}</p>
                        <p className="text-sm text-gray-500">{paper.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">₹{paper.price}</p>
                        <p className="text-xs text-gray-500">per card</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h2 className="font-bold text-gray-900 text-sm mb-2.5">Payment Method</h2>
              <div className="space-y-1.5">
                <button
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`w-full p-2.5 rounded-lg border-2 transition text-left ${
                    paymentMethod === 'razorpay'
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs">Razorpay</p>
                      <p className="text-xs text-gray-500">UPI, Cards, Net Banking</p>
                    </div>
                    {paymentMethod === 'razorpay' && (
                      <Check size={16} className="text-green-600 flex-shrink-0" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('wallet')}
                  className={`w-full p-2.5 rounded-lg border-2 transition text-left ${
                    paymentMethod === 'wallet'
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Wallet size={14} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs">Wallet</p>
                      <p className="text-xs text-gray-500">Pay from wallet balance</p>
                    </div>
                    {paymentMethod === 'wallet' && (
                      <Check size={16} className="text-green-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 sticky top-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quantity</span>
                  <span className="font-semibold text-gray-900">{quantity} cards</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paper Type</span>
                  <span className="font-semibold text-gray-900 capitalize">{paperType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price per card</span>
                  <span className="font-semibold text-gray-900">₹{pricePerCard[paperType]}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST (18%)</span>
                  <span className="font-semibold text-gray-900">₹{gst.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-900 text-lg">Total</span>
                  <span className="font-bold text-gray-900 text-2xl">₹{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    Place Order
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                By placing this order, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3xl p-10 text-center w-full"
            style={{ maxWidth: '440px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: '#16a34a', boxShadow: '0 0 0 12px #dcfce7' }}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900 mb-2" style={{ fontSize: '22px' }}>Order Placed Successfully!</h2>
            <p className="text-sm mb-1" style={{ color: '#9ca3af' }}>Your business card order has been confirmed</p>
            <p className="font-bold text-gray-900 mb-2" style={{ fontSize: '18px' }}>Order ID: {orderId}</p>
            <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
              {quantity} cards • {paperType} paper • ₹{total.toFixed(2)}
            </p>
            <div className="space-y-3">
              <button onClick={() => navigate('/orders')}
                className="w-full py-3 text-white font-bold rounded-full hover:bg-gray-700 transition text-sm"
                style={{ backgroundColor: '#111111' }}>
                View My Orders
              </button>
              <button onClick={() => navigate('/')}
                className="w-full py-3 font-bold rounded-full hover:bg-gray-100 transition text-sm"
                style={{ border: '1.5px solid #e5e7eb', color: '#374151' }}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <AddressModal
          onClose={() => {
            setShowAddressModal(false);
            setEditingAddress(null);
          }}
          onSave={handleSaveAddress}
          editingAddress={editingAddress}
          loading={savingAddress}
        />
      )}
    </div>
  );
};

export default BusinessCardCheckoutPage;
