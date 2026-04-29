import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import productService from '../services/product.service';
import orderService from '../services/order.service';
import { useAuth } from '../context/AuthContext';

interface ProductRecord {
  _id?: string;
  id?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  images?: string[];
  basePrice?: number;
  discountedPrice?: number;
  mrp?: number;
  sale_price?: number;
}

interface UserPhoto {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface SavedDesign {
  id: string;
  name: string;
  productId: string;
  productName: string;
  thumbnail: string;       // base64 preview
  photos: UserPhoto[];
  activeImageIndex: number;
  savedAt: string;
}

const SimpleFrameEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ photoId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [userPhotos, setUserPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const productId = searchParams.get('productId');

  const salePrice = product?.sale_price ?? product?.discountedPrice ?? product?.basePrice ?? 0;
  const mrp = product?.mrp ?? product?.basePrice ?? salePrice;
  const displayPrice = salePrice || mrp || 0;

  const selectedPhoto = userPhotos.find(p => p.id === selectedPhotoId) || null;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    void init();
    loadSavedDesigns();
  }, []); // eslint-disable-line

  // ── Saved Designs (localStorage) ─────────────────────────────────────────
  const STORAGE_KEY = 'speedcopy_saved_designs';

  const loadSavedDesigns = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedDesigns(JSON.parse(raw));
    } catch { /* ignore */ }
  };

  const saveDesign = async () => {
    if (!product) return;

    // Generate thumbnail from editor
    let thumbnail = productImages[activeImageIndex] || '';
    try {
      const { default: html2canvas } = await import('html2canvas');
      if (editorRef.current) {
        const canvas = await html2canvas(editorRef.current, { useCORS: true, allowTaint: true, scale: 0.5 });
        thumbnail = canvas.toDataURL('image/jpeg', 0.6);
      }
    } catch { /* use product image as fallback */ }

    const design: SavedDesign = {
      id: `design_${Date.now()}`,
      name: `${product.name || 'Design'} - ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      productId: (product._id || product.id || productId || ''),
      productName: product.name || 'Design',
      thumbnail,
      photos: userPhotos,
      activeImageIndex,
      savedAt: new Date().toISOString(),
    };

    const updated = [design, ...savedDesigns].slice(0, 20); // max 20 designs
    setSavedDesigns(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveMsg('Design saved!');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const loadDesign = (design: SavedDesign) => {
    setUserPhotos(design.photos);
    setActiveImageIndex(design.activeImageIndex);
    setSelectedPhotoId(null);
    setShowSavedPanel(false);
  };

  const deleteDesign = (id: string) => {
    const updated = savedDesigns.filter(d => d.id !== id);
    setSavedDesigns(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const init = async () => {
    try {
      if (!productId) { navigate('/gifting'); return; }
      setLoading(true);

      let data: ProductRecord | null = null;
      try {
        const r = await productService.getGiftingProductById(productId);
        data = (r?.data || r) as ProductRecord;
      } catch {
        const r = await productService.getProductById(productId);
        data = (r?.data || r) as ProductRecord;
      }
      setProduct(data || null);

      const imgs: string[] = [];
      if (Array.isArray(data?.images) && data!.images.length > 0) imgs.push(...data!.images);
      else if (data?.thumbnail) imgs.push(data.thumbnail);
      else if (data?.image) imgs.push(data.image);
      setProductImages(imgs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // ── Upload photo ──────────────────────────────────────────────────────────
  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      // Get natural dimensions
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 300, h: 300 });
        img.src = dataUrl;
      });

      // Default size: 40% of editor width
      const editorW = editorRef.current?.clientWidth || 600;
      const editorH = editorRef.current?.clientHeight || 500;
      const maxW = editorW * 0.45;
      const maxH = editorH * 0.45;
      const scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
      const w = dims.w * scale;
      const h = dims.h * scale;

      const photo: UserPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        dataUrl,
        x: (editorW - w) / 2,
        y: (editorH - h) / 2,
        width: dims.w,
        height: dims.h,
        scale,
        rotation: 0,
      };

      setUserPhotos(prev => [...prev, photo]);
      setSelectedPhotoId(photo.id);
    }
  };

  // ── Drag to move ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent, photoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPhotoId(photoId);
    const photo = userPhotos.find(p => p.id === photoId);
    if (!photo) return;
    dragRef.current = { photoId, startX: e.clientX, startY: e.clientY, origX: photo.x, origY: photo.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setUserPhotos(prev => prev.map(p =>
        p.id === dragRef.current!.photoId
          ? { ...p, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }
          : p
      ));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Scale selected ────────────────────────────────────────────────────────
  const scalePhoto = (factor: number) => {
    if (!selectedPhotoId) return;
    setUserPhotos(prev => prev.map(p =>
      p.id === selectedPhotoId ? { ...p, scale: Math.max(0.05, p.scale * factor) } : p
    ));
  };

  const fitPhoto = () => {
    if (!selectedPhotoId || !editorRef.current) return;
    const editorW = editorRef.current.clientWidth;
    const editorH = editorRef.current.clientHeight;
    setUserPhotos(prev => prev.map(p => {
      if (p.id !== selectedPhotoId) return p;
      const scale = Math.min((editorW * 0.7) / p.width, (editorH * 0.7) / p.height);
      const w = p.width * scale;
      const h = p.height * scale;
      return { ...p, scale, x: (editorW - w) / 2, y: (editorH - h) / 2 };
    }));
  };

  const deletePhoto = (id: string) => {
    setUserPhotos(prev => prev.filter(p => p.id !== id));
    if (selectedPhotoId === id) setSelectedPhotoId(null);
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadDesign = async () => {
    if (!editorRef.current) return;

    // Use html2canvas if available, else just download product image
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(editorRef.current, { useCORS: true, allowTaint: true, scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${product?.name || 'design'}.png`;
      link.click();
    } catch {
      alert('Download failed. Please take a screenshot.');
    }
  };

  // ── Add to cart ───────────────────────────────────────────────────────────
  const addToCart = async () => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      navigate('/');
      return;
    }
    if (!product) {
      alert('Product not loaded. Please refresh.');
      return;
    }

    try {
      const pid = (product._id || product.id || productId || '').toString();
      if (!pid) {
        alert('Product ID missing. Please go back and try again.');
        return;
      }

      const thumbnailUrl = productImages[activeImageIndex] || '';

      const payload = {
        productId: pid,
        productName: product.name || 'Design',
        flowType: 'gifting' as const,
        quantity,
        unitPrice: displayPrice,
        totalPrice: displayPrice * quantity,
        variantId: undefined as undefined,
        designId: `simple-${pid}-${Date.now()}`,
        thumbnail: thumbnailUrl,
        designPreview: thumbnailUrl,
        designJson: '',
        designName: `${product.name || 'Design'} - Editor`,
        options: { source: 'simple-frame-editor' },
      };

      console.log('🛒 Adding to cart with payload:', { ...payload, thumbnail: thumbnailUrl ? '[URL]' : 'empty' });

      await orderService.addToCart(payload);
      console.log('✅ Added to cart successfully');
      navigate('/cart');
    } catch (e: any) {
      console.error('❌ Add to cart failed:', e);
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to add to cart';
      alert(`Error: ${msg}`);
    }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">Loading editor...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg p-8 text-center shadow-lg max-w-md">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="bg-gray-800 text-white px-6 py-2 rounded-lg">Go Back</button>
      </div>
    </div>
  );

  const activeProductImage = productImages[activeImageIndex] || '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { void handleUpload(e.target.files); e.currentTarget.value = ''; }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 text-sm">← Back</button>
            <div>
              <h1 className="text-base font-bold text-gray-900">Design Editor</h1>
              <p className="text-xs text-gray-500">{product?.name || 'Product'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-base font-bold text-orange-600">₹{displayPrice.toFixed(2)}</p>
              {mrp > displayPrice && <p className="text-xs text-gray-400 line-through">₹{mrp.toFixed(2)}</p>}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded bg-white flex items-center justify-center font-bold text-gray-600 text-sm">−</button>
              <span className="w-7 text-center text-sm font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="w-7 h-7 rounded bg-white flex items-center justify-center font-bold text-gray-600 text-sm">+</button>
            </div>
            <button onClick={saveDesign} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5">
              💾 Save
              {saveMsg && <span className="text-green-600 text-xs font-semibold">{saveMsg}</span>}
            </button>
            <button
              onClick={() => setShowSavedPanel(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition flex items-center gap-1.5"
              style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#374151' }}
            >
              🗂 My Designs
              {savedDesigns.length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {savedDesigns.length}
                </span>
              )}
            </button>
            <button onClick={addToCart} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600">Add To Cart</button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Panel */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">

          {/* Upload */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Add Your Photo</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-orange-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition"
            >
              <span className="text-3xl">📁</span>
              <span className="text-sm font-semibold text-orange-600">Upload Image</span>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
            </button>
          </div>

          {/* Uploaded photos */}
          {userPhotos.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Your Photos ({userPhotos.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                {userPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <button
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition ${selectedPhotoId === photo.id ? 'border-orange-500' : 'border-gray-200 hover:border-orange-300'}`}
                    >
                      <img src={photo.dataUrl} alt="upload" className="w-full h-full object-cover" />
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjust controls */}
          {selectedPhoto && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Adjust Photo</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button onClick={() => scalePhoto(0.9)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200">− Smaller</button>
                  <button onClick={() => scalePhoto(1.1)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200">+ Larger</button>
                </div>
                <button onClick={fitPhoto} className="w-full py-2 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200">⊡ Fit to Center</button>
                <button onClick={() => deletePhoto(selectedPhoto.id)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">🗑 Remove</button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Drag photo to reposition</p>
            </div>
          )}

          {/* Actions */}
          <div className="p-4">
            <button onClick={downloadDesign} className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100">💾 Download Design</button>
          </div>
        </div>

        {/* Center — Editor Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-6 overflow-auto">
          <p className="text-xs text-gray-500 mb-3">
            {userPhotos.length === 0 ? 'Upload your photo from the left panel' : 'Drag your photo to reposition it'}
          </p>

          {/* Editor container */}
          <div
            ref={editorRef}
            className="relative bg-white shadow-2xl rounded-lg overflow-hidden select-none"
            style={{ width: '600px', height: '500px', cursor: 'default' }}
            onClick={() => setSelectedPhotoId(null)}
          >
            {/* Product image — fills the editor */}
            {activeProductImage ? (
              <img
                src={activeProductImage}
                alt={product?.name || 'Product'}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                crossOrigin="anonymous"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <p className="text-gray-400 text-sm">No product image</p>
              </div>
            )}

            {/* User photos — draggable, on top */}
            {userPhotos.map(photo => {
              const w = photo.width * photo.scale;
              const h = photo.height * photo.scale;
              const isSelected = selectedPhotoId === photo.id;
              return (
                <div
                  key={photo.id}
                  onMouseDown={e => onMouseDown(e, photo.id)}
                  onClick={e => { e.stopPropagation(); setSelectedPhotoId(photo.id); }}
                  style={{
                    position: 'absolute',
                    left: photo.x,
                    top: photo.y,
                    width: w,
                    height: h,
                    cursor: 'move',
                    border: isSelected ? '2px solid #ff6a3d' : '2px solid transparent',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    zIndex: isSelected ? 10 : 5,
                  }}
                >
                  <img
                    src={photo.dataUrl}
                    alt="user photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '2px' }}
                    draggable={false}
                  />
                  {/* Delete button on selected */}
                  {isSelected && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                      style={{
                        position: 'absolute', top: -10, right: -10,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#ef4444', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 20,
                      }}
                    >×</button>
                  )}
                  {/* Scale handles on selected */}
                  {isSelected && (
                    <>
                      <div
                        onMouseDown={e => { e.stopPropagation(); scalePhoto(0.9); }}
                        style={{
                          position: 'absolute', bottom: -10, left: -10,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#ff6a3d', color: '#fff',
                          cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 20,
                        }}
                      >−</div>
                      <div
                        onMouseDown={e => { e.stopPropagation(); scalePhoto(1.1); }}
                        style={{
                          position: 'absolute', bottom: -10, right: -10,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#ff6a3d', color: '#fff',
                          cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 20,
                        }}
                      >+</div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Empty state overlay */}
            {userPhotos.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.03)' }}
              >
                <span className="text-4xl mb-2">📸</span>
                <p className="text-gray-500 text-sm font-medium">Upload your photo</p>
                <p className="text-gray-400 text-xs mt-1">It will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Product Images */}
        {productImages.length > 0 && (
          <div className="w-52 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Product Images</h3>
              <div className="space-y-3">
                {productImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-full rounded-xl overflow-hidden border-2 transition ${activeImageIndex === i ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300'}`}
                  >
                    <div className="aspect-square bg-gray-50">
                      <img
                        src={img}
                        alt={`Design ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className={`py-1.5 text-xs font-medium text-center ${activeImageIndex === i ? 'bg-orange-500 text-white' : 'text-gray-600'}`}>
                      Design {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ── Saved Designs Panel ─────────────────────────────────────────── */}
      {showSavedPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSavedPanel(false)}
        >
          <div
            className="bg-white rounded-2xl w-full overflow-hidden"
            style={{ maxWidth: '680px', maxHeight: '80vh', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">My Saved Designs</h2>
                <p className="text-xs text-gray-400 mt-0.5">{savedDesigns.length} design{savedDesigns.length !== 1 ? 's' : ''} saved</p>
              </div>
              <button
                onClick={() => setShowSavedPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Designs Grid */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 80px)' }}>
              {savedDesigns.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-5xl mb-4 block">🎨</span>
                  <p className="text-gray-500 font-medium mb-1">No saved designs yet</p>
                  <p className="text-gray-400 text-sm">Click "Save" in the editor to save your design</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {savedDesigns.map(design => (
                    <div
                      key={design.id}
                      className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 hover:border-orange-300 transition group"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        {design.thumbnail ? (
                          <img
                            src={design.thumbnail}
                            alt={design.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🖼</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-gray-800 text-xs truncate mb-0.5">{design.productName}</p>
                        <p className="text-gray-400 text-xs truncate mb-3">
                          {new Date(design.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadDesign(design)}
                            className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => deleteDesign(design.id)}
                            className="w-8 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition text-sm"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleFrameEditorPage;
